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
      // Sugerir el próximo número de recibo desde histórico (global) => MAX(Vale) + 1
      const [histRows] = await pool.query('SELECT MAX(Vale) AS maxVale FROM liquidaciones_historico');
      const maxHist = histRows && histRows[0] && histRows[0].maxVale != null ? Number(histRows[0].maxVale) : null;
      siguienteVale = Number.isFinite(maxHist) && maxHist > 0 ? (maxHist + 1) : 1;
    } catch (e) {
      console.warn('No se pudo consultar liquidaciones_historico:', e.message);
      siguienteVale = 1;
    }
    try {
      // Indicar si ya existen liquidaciones de trabajo para este período (para rotular "Reliquidar")
      const [existeRows] = await pool.query('SELECT COUNT(*) AS total FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);
      yaExiste = (existeRows && existeRows[0] && Number(existeRows[0].total) > 0);
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

    // Aplicar ajustes: recalcular total del empleado (sin redondeo original), sumar ajuste y redondear a decena.
    // Solo se modifica el primer registro (MIN(Vale)) por empleado del período y se agrega leyenda con el importe del ajuste.
    try {
      await conn.query(
        `UPDATE liquidaciones l
         JOIN (
           SELECT e.Id AS IdNovedadesE, r.IdEmpleado, SUM(COALESCE(r.Monto,0)) AS TotalBase
           FROM novedadesr r
           INNER JOIN novedadese e ON e.Id = r.IdNovedadesE
           WHERE e.Id = ? AND r.IdEstado IN (5,6)
           GROUP BY e.Id, r.IdEmpleado
         ) base ON base.IdNovedadesE = l.IdNovedadesE AND base.IdEmpleado = l.IdEmpleado
         JOIN (
           SELECT IdEmpleado, SUM(Monto) AS Ajuste
           FROM ajustes
           GROUP BY IdEmpleado
         ) aj ON aj.IdEmpleado = l.IdEmpleado
         JOIN (
           SELECT IdEmpleado, MIN(Vale) AS ValeMin
           FROM liquidaciones
           WHERE Periodo = ?
           GROUP BY IdEmpleado
         ) prim ON prim.IdEmpleado = l.IdEmpleado AND prim.ValeMin = l.Vale
         JOIN (
           SELECT IdEmpleado, SUM(Monto) AS TotalActual
           FROM liquidaciones
           WHERE Periodo = ?
           GROUP BY IdEmpleado
         ) act ON act.IdEmpleado = l.IdEmpleado
         SET 
           l.Monto = l.Monto + (CAST(CEIL((base.TotalBase + COALESCE(aj.Ajuste,0)) / 10) * 10 AS DECIMAL(12,2)) - act.TotalActual),
           l.Detalle = CASE 
             WHEN COALESCE(aj.Ajuste,0) = 0 THEN l.Detalle
             WHEN l.Detalle LIKE '%Se incluye ajuste por $%' THEN l.Detalle
             WHEN l.Detalle LIKE '%Se incluye ajuste%' THEN REPLACE(l.Detalle, 'Se incluye ajuste', CONCAT('Se incluye ajuste por $ ', FORMAT(aj.Ajuste,2)))
             ELSE CONCAT(COALESCE(l.Detalle,''), ' - Se incluye ajuste por $ ', FORMAT(aj.Ajuste,2))
           END
         WHERE l.Periodo = ? AND COALESCE(aj.Ajuste,0) <> 0`,
        [actual.Id, actual.Periodo, actual.Periodo, actual.Periodo]
      );
    } catch (e) {
      console.warn('No se pudieron aplicar ajustes/redondeo en la liquidación:', e.message);
    }

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

// Sanitiza nombres de archivo para cabecera Content-Disposition
function sanitizeFilename(name, fallback) {
  const raw = String(name || '').trim();
  if (!raw) return fallback;
  // quitar rutas y caracteres peligrosos
  let s = raw.replace(/[\\\/\r\n\t\0]/g, '');
  // evitar directorios relativos
  s = s.replace(/\.+/g, '.');
  // aplicar extensión .pdf si falta
  if (!/\.pdf$/i.test(s)) s = s + '.pdf';
  // longitud razonable
  if (s.length > 180) s = s.slice(0, 176) + '.pdf';
  return s;
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

// Conversión básica de números a letras en español (solo parte entera, pesos)
function numeroALetras(numero) {
  const n = Math.floor(Number(numero) || 0);
  if (n === 0) return 'CERO';
  const unidades = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
  const decenas = ['','DIEZ','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const centenas = ['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];

  function seccion(nro) {
    if (nro < 20) return unidades[nro];
    if (nro < 100) {
      const d = Math.floor(nro / 10);
      const r = nro % 10;
      if (nro === 20) return 'VEINTE';
      if (nro > 20 && nro < 30) return 'VEINTI' + unidades[r].toLowerCase();
      return decenas[d] + (r ? ' Y ' + unidades[r] : '');
    }
    if (nro < 1000) {
      const c = Math.floor(nro / 100);
      const r = nro % 100;
      if (nro === 100) return 'CIEN';
      return (c === 1 ? 'CIENTO' : centenas[c]) + (r ? ' ' + seccion(r) : '');
    }
    if (nro < 1000000) {
      const miles = Math.floor(nro / 1000);
      const r = nro % 1000;
      let pref = miles === 1 ? 'MIL' : seccion(miles) + ' MIL';
      return pref + (r ? ' ' + seccion(r) : '');
    }
    if (nro < 1000000000) {
      const mill = Math.floor(nro / 1000000);
      const r = nro % 1000000;
      let pref = mill === 1 ? 'UN MILLÓN' : seccion(mill) + ' MILLONES';
      return pref + (r ? ' ' + seccion(r) : '');
    }
    return String(nro); // fallback para números muy grandes
  }
  return seccion(n);
}

// Generación de PDF de recibos por Área (4 recibos verticales por página)
async function generarRecibosArea({ periodoStr, area, grupos }) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const hoy = new Date();
  const fechaStr = hoy.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  // Armar lista plana de items por sector/persona conservando vale y detalle
  const recibos = [];
  for (const sector of grupos) {
    for (const it of (sector.items || [])) {
      recibos.push({
        vale: padVale(it.vale),
        apellidoYNombre: (it.apellidoYNombre || '').toUpperCase(),
        detalle: (it.detalle || '').toUpperCase(),
        monto: Number(it.monto) || 0,
        sectorNombre: sector.sectorNombre || 'SIN SECTOR',
        area: area
      });
    }
  }

  const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const altoPagina = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  // Distribución: 4 recibos verticales ocupando todo el ancho; seccionamos alto en 4 bloques
  const recibosPorPagina = 4;
  const bloqueAlto = altoPagina / recibosPorPagina;

  function dibujarMarco(x, y, w, h) {
    doc.save();
    doc.lineWidth(0.5).rect(x, y, w, h).stroke();
    doc.restore();
  }

  function dibujarRecibo(r, idxEnPagina) {
    const x = doc.page.margins.left;
    const y = doc.page.margins.top + idxEnPagina * bloqueAlto;
    const w = anchoPagina;
    const h = bloqueAlto;
    dibujarMarco(x, y, w, h);
    const padding = 8;
    let cursorY = y + padding;
    const labelFont = 'Helvetica-Bold';
  // Fila 1: Fecha a la izquierda, Recibo Nº a la derecha (font 14)
  doc.font(labelFont).fontSize(14);
  doc.text(`FECHA: ${fechaStr}`, x + padding, cursorY, { width: (w - padding * 2) / 2, align: 'left' });
  doc.text(`RECIBO Nº ${r.vale}`, x + padding + (w - padding * 2) / 2, cursorY, { width: (w - padding * 2) / 2, align: 'right' });
    cursorY += 20;
  // Fila 2: Periodo + Área + Sector centrado font 14
  doc.font(labelFont).fontSize(14);
    const tituloLinea2 = `${periodoStr.toUpperCase()} - ÁREA ${r.area.toUpperCase()} - SECTOR ${r.sectorNombre.toUpperCase()}`;
    doc.text(tituloLinea2, x + padding, cursorY, { width: w - padding * 2, align: 'center' });
  cursorY += 20;
  // Línea 3: Apellido y Nombre a la izquierda (font 16)
  doc.font('Helvetica-Bold').fontSize(16).text(r.apellidoYNombre, x + padding, cursorY, { width: w - padding * 2, align: 'left' });
  cursorY += 26;
    // Tabla Detalle / Importe (header + datos) con altura dinámica
    const montoStr = formatoMonedaARS(r.monto);
    let tablaFontSize = 14;
    const tablaAncho = w - padding * 2;
    const colDetalleW = tablaAncho * 0.7;
    const colImporteW = tablaAncho - colDetalleW; // 30%
    const tablaX = x + padding;
    let yTabla = cursorY;
    const headerPaddingV = 4;
    const cellPaddingV = 4;
    const cellPaddingH = 4;

    // Función para medir altura requerida de la fila de datos dada la fuente actual
    function medirAlturas(fontSize) {
      doc.font('Helvetica').fontSize(fontSize);
      const hDetalle = doc.heightOfString(r.detalle, { width: colDetalleW - cellPaddingH * 2, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(fontSize);
      const hImporte = doc.heightOfString(montoStr, { width: colImporteW - cellPaddingH * 2, align: 'right' });
      const contenido = Math.max(hDetalle, hImporte);
      const fila = contenido + cellPaddingV * 2;
      return { hDetalle, hImporte, fila };
    }

    let medidas = medirAlturas(tablaFontSize);
    const maxFilaAlto = (h - (cursorY - y) - 60); // margen razonable para no invadir firma y letras
    while (medidas.fila > maxFilaAlto && tablaFontSize > 9) {
      tablaFontSize -= 1;
      medidas = medirAlturas(tablaFontSize);
    }

    const headerHeight = tablaFontSize + headerPaddingV * 2;
    const rowHeight = medidas.fila;

    // Header
    doc.save();
    doc.rect(tablaX, yTabla, colDetalleW, headerHeight).stroke();
    doc.rect(tablaX + colDetalleW, yTabla, colImporteW, headerHeight).stroke();
    doc.font('Helvetica-Bold').fontSize(tablaFontSize)
      .text('DETALLE', tablaX + cellPaddingH, yTabla + headerPaddingV, { width: colDetalleW - cellPaddingH * 2, align: 'left' });
    doc.text('IMPORTE', tablaX + colDetalleW + cellPaddingH, yTabla + headerPaddingV, { width: colImporteW - cellPaddingH * 2, align: 'right' });
    doc.restore();
    yTabla += headerHeight;

    // Datos
    doc.rect(tablaX, yTabla, colDetalleW, rowHeight).stroke();
    doc.rect(tablaX + colDetalleW, yTabla, colImporteW, rowHeight).stroke();
    doc.font('Helvetica').fontSize(tablaFontSize)
      .text(r.detalle, tablaX + cellPaddingH, yTabla + cellPaddingV, { width: colDetalleW - cellPaddingH * 2, align: 'left' });
    doc.font('Helvetica-Bold').fontSize(tablaFontSize)
      .text(montoStr, tablaX + colDetalleW + cellPaddingH, yTabla + cellPaddingV, { width: colImporteW - cellPaddingH * 2, align: 'right' });

    cursorY = yTabla + rowHeight + 14;
    // Línea 5: Importe en letras
    const letras = numeroALetras(r.monto);
    doc.font('Helvetica').fontSize(8).text(`SON PESOS ${letras}`, x + padding, cursorY, { width: w - padding * 2, align: 'left' });
    cursorY += 20;
    // Línea 6: firma (línea) y siguiente línea "Firma" centrado con la línea
    // Línea de firma alineada a la derecha con mayor espacio para firmar
    // Reservar padding inferior para no chocar con el borde del recibo
    const bottomPadding = 10; // espacio libre debajo de la firma
    const firmaEspacioNecesario = 12 /*espacio previo*/ + 1 /*línea*/ + 6 /*gap*/ + 9 /*texto*/ + 2;
    const bordeInferior = y + h - bottomPadding;
    // Si no hay espacio suficiente, reubicar cursorY más arriba antes de agregar la firma
    if (cursorY + firmaEspacioNecesario > bordeInferior) {
      cursorY = Math.max(y + 40, bordeInferior - firmaEspacioNecesario); // 40px de margen superior mínimo dentro del bloque
    }
    cursorY += 12; // espacio antes de la línea de firma
    const lineaAncho = Math.min(180, w - padding * 2);
    const xLinea = x + padding + (w - padding * 2) - lineaAncho; // alinear a derecha
    const yLinea = cursorY;
    doc.moveTo(xLinea, yLinea).lineTo(xLinea + lineaAncho, yLinea).stroke();
    cursorY += 6;
    doc.font('Helvetica').fontSize(9).text('RECIBÍ CONFORME', xLinea, cursorY, { width: lineaAncho, align: 'center' });
  }

  recibos.forEach((r, idx) => {
    const idxEnPagina = idx % recibosPorPagina;
    if (idx > 0 && idxEnPagina === 0) {
      doc.addPage();
    }
    dibujarRecibo(r, idxEnPagina);
  });
  return doc;
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
    const paddingY = options.paddingY || 2;
    const bgColor = options.bgColor || null; // permitir fondo para resaltar subtotales
    const drawTopLine = options.drawTopLine || false;
    const drawBottomLine = options.drawBottomLine || false;
    const topLineColor = options.topLineColor || '#888';
    const bottomLineColor = options.bottomLineColor || '#aaa';
    // Altura estimada de la línea (una sola) + padding
    const contentHeight = fontSize + paddingY * 2;
    ensureSpace(contentHeight + 2);
    const y = doc.y;
    if (drawTopLine) {
      doc.save().strokeColor(topLineColor).moveTo(marginLeft, y).lineTo(marginLeft + usableWidth, y).stroke().restore();
    }
    // Fondo
    if (bgColor) {
      doc.save();
      doc.rect(marginLeft, y + (drawTopLine ? 1 : 0), usableWidth, contentHeight).fill(bgColor);
      doc.restore();
    }
    const baseY = y + paddingY + (drawTopLine ? 1 : 0);
    doc.font(options.boldLabel ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .fillColor(options.labelColor || '#000')
      .text(label, marginLeft + 4, baseY, { width: labelColWidth - 8, align: 'right' });
    doc.font(options.boldValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .fillColor(options.valueColor || '#000')
      .text(valor, marginLeft + labelColWidth, baseY, { width: valueColWidth - 4, align: 'right' });
    if (drawBottomLine) {
      const yBottom = y + contentHeight + (drawTopLine ? 1 : 0);
      doc.save().strokeColor(bottomLineColor).moveTo(marginLeft, yBottom).lineTo(marginLeft + usableWidth, yBottom).stroke().restore();
    }
    doc.y = y + contentHeight + (drawTopLine ? 1 : 0) + 2;
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
    // Subtotal sector resaltado: fondo gris claro y líneas superior/inferior suaves
    drawTwoCol('Subtotal sector:', formatoMonedaARS(subtotalSector), {
      boldLabel: true,
      boldValue: true,
      fontSize: 11,
      bgColor: '#f0f0f0',
      drawTopLine: true,
      drawBottomLine: true,
      topLineColor: '#bbb',
      bottomLineColor: '#bbb'
    });
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
      const nombrePorDefecto = `Liquidación ${periodoLargo} Area ${areaSel.area}.pdf`;
      const nombre = sanitizeFilename(req.query.filename, nombrePorDefecto);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
      const doc = await generarPdfArea({ periodoStr: periodoLargo, area: areaSel.area, grupos: areaSel.grupos, subtotalArea: areaSel.subtotalArea });
      doc.pipe(res);
      doc.end();
      return;
    }

    // Renderizar selector de descarga (permite elegir nombre) para una o múltiples áreas
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

// GET: exportar Recibos (4 por página) por Área de la liquidación actual
router.get('/resultado/export/recibos', logueado, async (req, res) => {
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
    const areaQuery = (req.query.area || '').toString();
    if (areaQuery) {
      const areaSel = datos.areas.find((a) => String(a.area).toLowerCase() === areaQuery.toLowerCase());
      if (!areaSel) {
        return render(req, res, 'liquidacionesResultado', { ...datos, Mensaje: { title: 'Atención', text: 'El área solicitada no existe en la liquidación actual.', icon: 'warning' } });
      }
      const nombrePorDefecto = `Recibos Liquidación ${periodoLargo} Área ${areaSel.area}.pdf`;
      const nombre = sanitizeFilename(req.query.filename, nombrePorDefecto);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
      const doc = await generarRecibosArea({ periodoStr: periodoLargo, area: areaSel.area, grupos: areaSel.grupos });
      doc.pipe(res);
      doc.end();
      return;
    }
    const opciones = datos.areas.map((a) => ({
      area: a.area,
      url: `/liquidacionesProcesar/resultado/export/recibos?area=${encodeURIComponent(a.area)}`,
      nombreArchivo: `Recibos Liquidación ${periodoLargo} Área ${a.area}.pdf`
    }));
    return render(req, res, 'liquidacionesExportarRecibos', { periodo: periodoLargo, opciones });
  } catch (err) {
    console.error('Error al exportar Recibos:', err);
    const datos = { Mensaje: { title: 'Error', text: 'No fue posible exportar los recibos.', icon: 'error' } };
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
