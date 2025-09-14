const router = require('express').Router();
const PDFDocument = require('pdfkit');
const { logueado } = require('../Middleware/validarUsuario');
const { pool } = require('../conexion');
const { render, confirmar } = require('../Middleware/render');
const sqlResultado = `
  SELECT 
    l.Area,
    l.Sector,
    s.Descripcion AS SectorNombre,
    l.IdEmpleado,
    p.ApellidoYNombre,
    l.Detalle,
    l.Monto,
    l.Vale
  FROM liquidaciones l
  LEFT JOIN sectores s ON s.Id = l.Sector
  LEFT JOIN personal p ON p.Id = l.IdEmpleado
  WHERE l.IdNovedadesE = ?
  ORDER BY FIELD(l.Area,'Administrativa','Operativa'), s.Descripcion, p.ApellidoYNombre
`;

async function obtenerResultado(actual) {
  const [rows] = await pool.query(sqlResultado, [actual.Id]);
  // Agrupar en memoria por Área y dentro de cada área por sector; calcular subtotales y totales
  const areas = [];
  const areasMap = new Map();
  const totalesPorArea = [];
  let totalGeneral = 0;

  for (const r of rows) {
    const areaKey = r.Area || 'Sin área';
    if (!areasMap.has(areaKey)) {
      const areaObj = { area: areaKey, grupos: [], subtotalArea: 0 };
      areaObj._sectoresMap = new Map(); // interno para acumular por sector
      areasMap.set(areaKey, areaObj);
      areas.push(areaObj);
    }
    const areaObj = areasMap.get(areaKey);

    const sectorKey = r.Sector || 0;
    if (!areaObj._sectoresMap.has(sectorKey)) {
      const sectorObj = { sectorId: sectorKey, sectorNombre: r.SectorNombre || 'Sin sector', items: [], subtotal: 0 };
      areaObj._sectoresMap.set(sectorKey, sectorObj);
      areaObj.grupos.push(sectorObj);
    }
    const g = areaObj._sectoresMap.get(sectorKey);
    const montoNum = Number(r.Monto) || 0;
    g.items.push({
      idEmpleado: r.IdEmpleado,
      apellidoYNombre: r.ApellidoYNombre || '-',
      detalle: r.Detalle || '',
      monto: montoNum,
      vale: r.Vale
    });
    g.subtotal += montoNum;
    areaObj.subtotalArea += montoNum;
    totalGeneral += montoNum;
  }

  // Armar totales por área y limpiar mapas internos
  for (const a of areas) {
    totalesPorArea.push({ area: a.area, total: a.subtotalArea });
    delete a._sectoresMap;
  }

  return { actual, areas, totalesPorArea, totalGeneral };
}

async function cargarModelo() {
  try {
    // Traer Periodo como string 'YYYY-MM-DD' para evitar corrimiento por huso horario
    const [rows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo, Observaciones FROM novedadese WHERE Actual = 1 LIMIT 1");
    if (!rows || rows.length === 0) {
      return { sinActual: true };
    }
    const actual = rows[0];
    let yaExiste = false;
    let siguienteVale = null;
    try {
      const [existeRows] = await pool.query('SELECT COUNT(*) AS total FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);
      yaExiste = (existeRows && existeRows[0] && Number(existeRows[0].total) > 0);
      if (yaExiste) {
        const [maxRows] = await pool.query('SELECT MAX(Vale) AS maxVale FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);
        const maxVale = maxRows && maxRows[0] && maxRows[0].maxVale ? Number(maxRows[0].maxVale) : null;
        if (Number.isFinite(maxVale)) siguienteVale = maxVale + 1;
      }
    } catch (e) {
      console.warn('No se pudo verificar liquidaciones existentes:', e.message);
    }
    return { actual, yaExiste, siguienteVale };
  } catch (err) {
    console.error(err);
    return { sinActual: true };
  }
}

async function procesarLiquidacion(actual, primerVale) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Evitar truncado de GROUP_CONCAT si hay muchas fechas
    try { await conn.query('SET SESSION group_concat_max_len = 4096'); } catch { }

    // Borrar liquidaciones existentes para el período (reliquidación)
    await conn.query('DELETE FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);

    // Validar primer vale
    const inicioVale = Number(primerVale);
    if (!Number.isFinite(inicioVale) || inicioVale <= 0) {
      throw new Error('Debés indicar un número válido de primer vale (mayor a 0).');
    }

    // Preparar contador de vales (compatible con MySQL < 8, sin window functions)
    await conn.query('SET @rn := ? - 1', [inicioVale]);
    // Insertar agregados desde novedadesr del período actual, solo aceptadas (IdEstado = 5)
    await conn.query(
      `INSERT INTO liquidaciones (IdNovedadesE, Area, Periodo, Sector, IdEmpleado, Detalle, Monto, Vale)
       SELECT 
         t.IdNovedadesE,
         t.Area,
         t.Periodo,
         t.Sector,
         t.IdEmpleado,
         t.Detalle,
         t.Monto,
         (@rn := @rn + 1) AS Vale
       FROM (
         SELECT 
           e.Id AS IdNovedadesE,
           MIN(r.Area) AS Area,
           e.Periodo AS Periodo,
           r.IdSector AS Sector,
           r.IdEmpleado AS IdEmpleado,
           MIN(s.Descripcion) AS SectorNombre,
           MIN(p.ApellidoYNombre) AS ApellidoYNombre,
           CONCAT(
             GROUP_CONCAT(DATE_FORMAT(r.Fecha, '%d/%m') ORDER BY r.Fecha SEPARATOR ', '),
             CASE WHEN SUM(COALESCE(r.MinutosAl50,0)) > 0 
                  THEN CONCAT(' | Hs50: ', TIME_FORMAT(SEC_TO_TIME(SUM(COALESCE(r.MinutosAl50,0))*60), '%H:%i')) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.MinutosAl100,0)) > 0 
                  THEN CONCAT(' | Hs100: ', TIME_FORMAT(SEC_TO_TIME(SUM(COALESCE(r.MinutosAl100,0))*60), '%H:%i')) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.GuardiasDiurnas,0)) > 0 
                  THEN CONCAT(' | GD: ', ROUND(SUM(COALESCE(r.GuardiasDiurnas,0)),2)) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.GuardiasNocturnas,0)) > 0 
                  THEN CONCAT(' | GN: ', ROUND(SUM(COALESCE(r.GuardiasNocturnas,0)),2)) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.GuardiasPasivas,0)) > 0 
                  THEN CONCAT(' | GP: ', ROUND(SUM(COALESCE(r.GuardiasPasivas,0)),2)) 
                  ELSE '' END
           ) AS Detalle,
           CAST(CEIL(SUM(COALESCE(r.Monto, 0)) / 10) * 10 AS DECIMAL(12,2)) AS Monto
         FROM novedadesr r
         INNER JOIN novedadese e ON e.Id = r.IdNovedadesE
         LEFT JOIN sectores s ON s.Id = r.IdSector
         LEFT JOIN personal p ON p.Id = r.IdEmpleado
         WHERE e.Id = ? AND r.IdEstado IN (5, 6)
         GROUP BY e.Id, e.Periodo, r.IdSector, r.IdEmpleado
       ) AS t
       ORDER BY FIELD(t.Area,'Administrativa','Operativa'), t.SectorNombre, t.ApellidoYNombre, t.Sector, t.IdEmpleado`,
      [actual.Id]
    );

    // Marcar como liquidadas (IdEstado = 6) las novedades aceptadas (5) del período actual
    await conn.query(
      'UPDATE novedadesr SET IdEstado = 6 WHERE IdNovedadesE = ? AND IdEstado = 5',
      [actual.Id]
    );

    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch { }
    // Propagar error más claro si falta la columna
    if (e && e.code === 'ER_BAD_FIELD_ERROR') {
      throw new Error('La tabla liquidaciones necesita la columna IdNovedadesE (y Periodo DATE). Ejecutá el script de alter en /sql para continuar.');
    }
    throw e;
  } finally {
    conn.release();
  }
}

// Helpers de formato para exportación
function padVale(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  return String(n).padStart(5, '0');
}

function formatoMonedaARS(valor) {
  const n = Number(valor) || 0;
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    // Fallback simple
    return `$ ${n.toFixed(2)}`;
  }
}

function formatearPeriodoLargo(periodoYYYYMMDD) {
  // Construir Date en UTC para evitar corrimientos
  const [y, m, d] = String(periodoYYYYMMDD || '').split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return String(periodoYYYYMMDD || '');
  const fecha = new Date(Date.UTC(y, m - 1, d));
  try {
    return fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    // Fallback MySQL-like: MM/YYYY
    return `${String(m).padStart(2, '0')}/${y}`;
  }
}

/**
 * Genera un PDF de liquidación para un Área y lo devuelve como stream (doc) ya iniciado.
 * El caller debe hacer doc.end() al finalizar.
 */
async function generarPdfArea({ periodoStr, area, grupos, subtotalArea }) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  // Config columnas
  const colWidths = [170, 200, 80, 60];
  const headers = ['APELLIDO Y NOMBRE', 'DETALLE', 'MONTO', 'VALE'];
  const marginLeft = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lineHeight = 12; // base

  function ensureSpace(required) {
    if (doc.y + required > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeaderArea();
      drawTableHeader();
    }
  }

  function drawHeaderArea() {
    doc.font('Helvetica-Bold').fontSize(16).text(`Liquidación ${periodoStr} - Área ${area}`, { align: 'left' });
    doc.moveDown(0.5);
  }

  function drawTableHeader() {
    doc.save();
  doc.font('Helvetica-Bold').fontSize(11);
    const yStart = doc.y;
    // Primer pasada: calcular alturas
    const headerHeights = headers.map((h, idx) => {
      const w = colWidths[idx];
      return doc.heightOfString(h, { width: w - 4, align: idx >= 2 ? 'right' : 'left' });
    });
    const maxH = Math.max(...headerHeights);
    const y0 = yStart - 2; // línea superior
    const y1 = yStart + maxH + 4; // línea inferior
    const rowHeight = y1 - y0; // alto total del renglón de encabezado (incluye padding visual)
    // Dibujar líneas primero
    doc.moveTo(marginLeft, y0).lineTo(marginLeft + usableWidth, y0).stroke();
    doc.moveTo(marginLeft, y1).lineTo(marginLeft + usableWidth, y1).stroke();
    // Segunda pasada: colocar cada header centrado verticalmente
    let x = marginLeft;
    headers.forEach((h, idx) => {
      const w = colWidths[idx];
      const hTxt = headerHeights[idx];
      const opt = { width: w - 4, align: idx >= 2 ? 'right' : 'left' };
      const yText = y0 + (rowHeight - hTxt) / 2; // centrado vertical
      doc.text(h, x + 2, yText, opt);
      x += w;
    });
    doc.y = y1 + 2; // avanzar debajo del header
    doc.restore();
  }

  function drawFullWidthRow(texto, opts = {}) {
    const paddingY = 3;
    const fontSize = opts.fontSize || 9;
    const bold = opts.bold || false;
    const bgColor = opts.bgColor || null;
    const textColor = opts.textColor || '#000';
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const h = doc.heightOfString(texto, { width: usableWidth - 8 }) + paddingY * 2; // ajustar width para padding
    ensureSpace(h + 4);
    const yTop = doc.y;
    if (bgColor) {
      doc.save();
      doc.rect(marginLeft, yTop, usableWidth, h).fill(bgColor);
      doc.fillColor(textColor);
      doc.text(texto, marginLeft + 4, yTop + paddingY, { width: usableWidth - 8, align: opts.align || 'left' });
      doc.restore();
      // Líneas sobre fondo oscuro (ligeramente más claras para contraste)
      doc.save();
      doc.strokeColor('#555').moveTo(marginLeft, yTop).lineTo(marginLeft + usableWidth, yTop).stroke();
      doc.strokeColor('#555').moveTo(marginLeft, yTop + h).lineTo(marginLeft + usableWidth, yTop + h).stroke();
      doc.restore();
    } else {
      // Línea superior
      doc.moveTo(marginLeft, yTop).lineTo(marginLeft + usableWidth, yTop).strokeColor('#999').stroke();
      // Texto
      doc.text(texto, marginLeft + 4, yTop + paddingY, { width: usableWidth - 8, align: opts.align || 'left' });
      // Línea inferior
      doc.moveTo(marginLeft, yTop + h).lineTo(marginLeft + usableWidth, yTop + h).strokeColor('#ccc').stroke();
    }
    doc.y = yTop + h + 1;
  }

  function drawRow(cols) {
  doc.font('Helvetica').fontSize(10);
    // Calcular alto de la fila (detalle puede envolver)
    let heights = cols.map((c, idx) => {
      return doc.heightOfString(c.text, { width: colWidths[idx] - 4, align: idx >= 2 ? 'right' : 'left' });
    });
    let rowH = Math.max(...heights) + 4; // padding vertical global
    ensureSpace(rowH + 4);
    let x = marginLeft;
    const yTop = doc.y;
    cols.forEach((c, idx) => {
      const w = colWidths[idx];
      const cellHeight = heights[idx];
      // y para inicio del texto centrado verticalmente dentro de la fila
      const yCell = yTop + (rowH - cellHeight) / 2;
      doc.text(c.text, x + 2, yCell, { width: w - 4, align: idx >= 2 ? 'right' : 'left' });
      x += w;
    });
    // Líneas horizontales
    doc.moveTo(marginLeft, yTop).lineTo(marginLeft + usableWidth, yTop).strokeColor('#999').stroke();
    doc.moveTo(marginLeft, yTop + rowH).lineTo(marginLeft + usableWidth, yTop + rowH).strokeColor('#ccc').stroke();
    doc.y = yTop + rowH + 1;
  }

  function drawTwoCol(label, valor, options = {}) {
    const valueColWidth = options.valueColWidth || 120;
    const labelColWidth = usableWidth - valueColWidth;
    const fontSize = options.fontSize || 9;
    const verticalSpace = options.verticalSpace || (lineHeight * 1.5);
    ensureSpace(verticalSpace + 2);
    const y = doc.y;
    doc.font(options.boldLabel ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .text(label, marginLeft, y, { width: labelColWidth, align: 'right' });
    doc.font(options.boldValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .text(valor, marginLeft + labelColWidth, y, { width: valueColWidth, align: 'right' });
    doc.y = y + fontSize + 4; // avance controlado sin moveDown grande
  }

  function drawTotal(label, valor) {
    // Reusar lógica de dos columnas con mismo estilo que subtotales pero destacando total área
    drawTwoCol(label, valor, { boldLabel: true, boldValue: true, fontSize: 11 });
  }

  drawHeaderArea();
  // Encabezado de columnas inicial (una vez por página)
  drawTableHeader();

  for (const sector of grupos) {
    // Fila de sector de ancho completo
  drawFullWidthRow(`Sector: ${sector.sectorNombre}`, { bold: true, fontSize: 10, bgColor: '#333333', textColor: '#FFFFFF' });
    const items = sector.items || [];
    if (items.length === 0) {
      drawRow([
        { text: 'Sin registros' },
        { text: '' },
        { text: '' },
        { text: '' }
      ]);
    } else {
      for (const it of items) {
        // Si falta espacio para una fila + subtotal potencial, se fuerza salto con reimpresión de encabezados
        ensureSpace(30);
        drawRow([
          { text: it.apellidoYNombre || '-' },
          { text: it.detalle || '' },
          { text: formatoMonedaARS(Number(it.monto) || 0) },
          { text: padVale(it.vale) }
        ]);
      }
    }
    const subtotalSector = items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
  // Subtotal sector en dos columnas para menor altura
  drawTwoCol('Subtotal sector:', formatoMonedaARS(subtotalSector), { boldLabel: true, boldValue: true, fontSize: 11 });
    // Antes de cambiar de página se reimprime encabezado (ensureSpace ya lo maneja); si la siguiente fila inicia página nueva, encabezado ya estará.
  }

  // Totales usando dos columnas para alinear correctamente
  drawTotal(`Total Área ${area}:`, formatoMonedaARS(subtotalArea));
  return doc;
}

// Genera y devuelve un Buffer con el contenido PDF de un área
async function generarPdfBufferArea({ periodoStr, area, grupos, subtotalArea }) {
  const doc = await generarPdfArea({ periodoStr, area, grupos, subtotalArea });
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// GET: pantalla principal de liquidación (formulario para generar)
router.get('/', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para liquidar.', icon: 'warning' } });
  }
  return render(req, res, 'liquidacionesProcesar', modelo);
});

// GET: consulta de la liquidación actual (solo visualizar resultados)
router.get('/resultado', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para consultar.', icon: 'warning' } });
  }
  try {
    const datos = await obtenerResultado(modelo.actual);
    return render(req, res, 'liquidacionesResultado', datos);
  } catch (err) {
    console.error('Error al obtener resultados de liquidación actual:', err);
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Error', text: 'No fue posible obtener la liquidación actual.', icon: 'error' } });
  }
});

// GET: exportar PDFs por Área de la liquidación actual
router.get('/resultado/export/pdf', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para exportar.', icon: 'warning' } });
  }
  try {
    const datos = await obtenerResultado(modelo.actual);
    const periodoLargo = formatearPeriodoLargo(modelo.actual.Periodo); // ej: agosto de 2025

    if (!datos.areas || datos.areas.length === 0) {
      return render(req, res, 'liquidacionesResultado', { ...datos, Mensaje: { title: 'Atención', text: 'No hay datos para exportar.', icon: 'warning' } });
    }

    // Si viene ?area=... exportar solo esa área
    const areaQuery = (req.query.area || '').toString();
    if (areaQuery) {
      const areaSel = datos.areas.find((a) => String(a.area).toLowerCase() === areaQuery.toLowerCase());
      if (!areaSel) {
        return render(req, res, 'liquidacionesResultado', { ...datos, Mensaje: { title: 'Atención', text: 'El área solicitada no existe en la liquidación actual.', icon: 'warning' } });
      }
      const nombre = `Liquidación ${periodoLargo} Area ${areaSel.area}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
      const doc = await generarPdfArea({ periodoStr: periodoLargo, area: areaSel.area, grupos: areaSel.grupos, subtotalArea: areaSel.subtotalArea });
      doc.pipe(res);
      doc.end();
      return;
    }

    // Si hay una sola área, descargar PDF directo. Si hay varias, mostrar opciones (dos links) para descargar cada PDF.
    if (datos.areas.length === 1) {
      const a = datos.areas[0];
      const nombre = `Liquidación ${periodoLargo} Area ${a.area}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
      const doc = await generarPdfArea({ periodoStr: periodoLargo, area: a.area, grupos: a.grupos, subtotalArea: a.subtotalArea });
      doc.pipe(res);
      doc.end();
      return;
    }

    // Varias áreas => renderizar una vista con los links de descarga individuales
    const opciones = datos.areas.map((a) => ({
      area: a.area,
      url: `/liquidacionesProcesar/resultado/export/pdf?area=${encodeURIComponent(a.area)}`,
      nombreArchivo: `Liquidación ${periodoLargo} Area ${a.area}.pdf`
    }));
    return render(req, res, 'liquidacionesExportarPDF', { periodo: periodoLargo, opciones });

  } catch (err) {
    console.error('Error al exportar PDF:', err);
    const datos = { Mensaje: { title: 'Error', text: 'No fue posible exportar el PDF.', icon: 'error' } };
    return render(req, res, 'liquidacionesProcesar', datos);
  }
});

// GET: confirmar cierre de la liquidación actual
router.get('/cerrar', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para cerrar.', icon: 'warning' } });
  }
  const { actual } = modelo;
  confirmar(
    req,
    res,
    `Vas a cerrar la liquidación del período ${actual.Periodo}. Se archivarán datos y no se podrá modificar. ¿Confirmás?`,
    `/liquidacionesProcesar/cerrar/confirmar`,
    '/liquidacionesProcesar'
  );
  return render(req, res, 'liquidacionesProcesar', modelo);
});

// GET: ejecutar cierre confirmado
router.get('/cerrar/confirmar', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para cerrar.', icon: 'warning' } });
  }
  const { actual } = modelo;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Reafirmar Periodo como string
    const perStr = actual.Periodo;
    // 1) Pasar liquidaciones a histórico
    await conn.query(
      `INSERT INTO liquidaciones_historico (IdNovedadesE, Area, Periodo, Sector, IdEmpleado, Detalle, Monto, Vale)
       SELECT IdNovedadesE, Area, Periodo, Sector, IdEmpleado, Detalle, Monto, Vale
       FROM liquidaciones WHERE IdNovedadesE = ?`,
      [actual.Id]
    );
    // 2) Marcar novedadesr del período como liquidadas y volcar a histórico opcional
    try {
      await conn.query(`UPDATE novedadesr SET Liquidado = 1 WHERE IdNovedadesE = ?`, [actual.Id]);
    } catch { }
    // Si existiera tabla novedadesr_historico, insertar copia
    try {
      await conn.query(
        `INSERT INTO novedadesr_historico (IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, GuardiasPasivas, Monto, IdGuardia, IdParcial, IdNomina, IdTurno, IdCategoria, IdEstado, ObservacionesEstado, IdSupervisor, MinutosAl50, MinutosAl100, MinutosGD, MinutosGN, Inicio, Fin, IdMotivo, IdReemplazo, Observaciones, CreadoPorAdmin)
         SELECT IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, GuardiasPasivas, Monto, IdGuardia, IdParcial, IdNomina, IdTurno, IdCategoria, IdEstado, ObservacionesEstado, IdSupervisor, MinutosAl50, MinutosAl100, MinutosGD, MinutosGN, Inicio, Fin, IdMotivo, IdReemplazo, Observaciones, CreadoPorAdmin
         FROM novedadesr WHERE IdNovedadesE = ?`,
        [actual.Id]
      );
    } catch { }
    // 3) Eliminar liquidaciones de trabajo del período actual
    await conn.query(`DELETE FROM liquidaciones WHERE IdNovedadesE = ?`, [actual.Id]);
    // 4) Marcar el período como no-Actual en novedadese
    await conn.query(`UPDATE novedadese SET Actual = 0 WHERE Id = ?`, [actual.Id]);

    await conn.commit();
    // Mostrar resultados en modo consulta ya archivados
    return render(req, res, 'liquidacionesProcesar', { Mensaje: { title: 'Listo', text: `Liquidación del período ${perStr} cerrada correctamente.`, icon: 'success' } });
  } catch (err) {
    try { await conn.rollback(); } catch { }
    console.error('Error al cerrar liquidación:', err);
    return render(req, res, 'liquidacionesProcesar', { Mensaje: { title: 'Error', text: 'No fue posible cerrar la liquidación.', icon: 'error' } });
  } finally {
    conn.release();
  }
});

// POST: procesa liquidación agrupando por Sector y Legajo y acumulando Monto
router.post('/', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para liquidar.', icon: 'warning' } });
  }

  const { actual } = modelo;

  // Verificar si hay novedades pendientes (IdEstado < 5)
  const [pendRows] = await pool.query('SELECT COUNT(*) AS total FROM novedadesr WHERE IdNovedadesE = ? AND IdEstado < 5', [actual.Id]);
  const pendientes = pendRows && pendRows[0] ? Number(pendRows[0].total) : 0;
  const forzar = req.query.forzar === '1' || req.body.forzar === '1';
  const primerVale = req.body.primerVale;
  if (pendientes > 0 && !forzar) {
    confirmar(
      req,
      res,
      `Existen ${pendientes} novedades con estado pendiente (IdEstado < 5). ¿Deseás continuar con la liquidación igualmente?`,
      `/liquidacionesProcesar?accion=liquidar&forzar=1${req.body.primerVale ? `&primerVale=${encodeURIComponent(req.body.primerVale)}` : ''}`,
      '/liquidacionesProcesar'
    );
    // Render inmediato para mostrar el diálogo de confirmación sin perder el primerVale
    return render(req, res, 'liquidacionesProcesar', modelo);
  }

  try {
    if (!primerVale) {
      // Mostrar alerta para pedir primer vale desde POST también
      return render(req, res, 'liquidacionesProcesar', { ...modelo, pedirVale: true, Mensaje: { title: 'Falta dato', text: 'Indicá el número del primer vale.', icon: 'warning' } });
    }
    await procesarLiquidacion(actual, primerVale);
    const datos = await obtenerResultado(actual);
    return render(req, res, 'liquidacionesResultado', { ...datos, Mensaje: { title: 'Listo', text: 'Liquidación generada correctamente.', icon: 'success' } });
  } catch (err) {
    console.error('Error al procesar liquidación:', err);
    const modeloError = await cargarModelo();
    const texto = err && err.message ? err.message : 'Ocurrió un problema al generar la liquidación.';
    return render(req, res, 'liquidacionesProcesar', { ...modeloError, Mensaje: { title: 'Error', text: texto, icon: 'error' } });
  }
});

module.exports = router;
