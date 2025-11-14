const express = require('express');
const { logueado } = require('../Middleware/validarUsuario');
const { render } = require('../Middleware/render');
const { pool } = require('../conexion');
const PDFDocument = require('pdfkit-table');

const router = express.Router();

// Solo administrador
router.get('/', logueado, async (req, res) => {
  if (req.session.nivelUsuario !== 1) return res.redirect('/');
  const titulo = 'Novedades por período';
  // Siempre renderiza el formulario aquí
  return render(req, res, 'consultaNovedadesPorPeriodo', { titulo });
});

// Vista de resultados independiente
router.get('/resultado', logueado, async (req, res) => {
  if (req.session.nivelUsuario !== 1) return res.redirect('/');
  const titulo = 'Novedades por período';
  const periodo = typeof req.query.periodo === 'string' ? req.query.periodo.trim() : '';
  const agrupar = (req.query.agrupar || 'sector').toString();
  const mostrar = (req.query.mostrar || '5').toString();
  if (!/^\d{2}\/\d{4}$/.test(periodo)) {
    return render(req, res, 'consultaNovedadesPorPeriodo', { titulo, Mensaje: { title:'Atención', text:'Ingresá un período válido (mm/aaaa).', icon:'warning' } });
  }

  const limites = { '5': 5, '10': 10 };
  const limit = limites[mostrar] || null; // null => todos
  const params = [periodo];

  const sqlSectorBase = `
    SELECT s.Descripcion AS Nombre,
           SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) AS Min50,
           SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0)) AS Min100,
           (SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) + SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0))) AS TotalMin,
           SUM(COALESCE(h.Monto,0)) AS Monto
    FROM novedadesr_historico h
    INNER JOIN novedadese e ON e.Id = h.IdNovedadesE
    INNER JOIN sectores s ON s.Id = h.IdSector
    WHERE DATE_FORMAT(e.Periodo, '%m/%Y') = ?
    GROUP BY h.IdSector, s.Descripcion
    ORDER BY TotalMin DESC`;
  const sqlMotivoBase = `
    SELECT m.Descripcion AS Nombre,
           SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) AS Min50,
           SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0)) AS Min100,
           (SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) + SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0))) AS TotalMin,
           SUM(COALESCE(h.Monto,0)) AS Monto
    FROM novedadesr_historico h
    INNER JOIN novedadese e ON e.Id = h.IdNovedadesE
    INNER JOIN motivos m ON m.Id = h.IdMotivo
    WHERE DATE_FORMAT(e.Periodo, '%m/%Y') = ?
    GROUP BY h.IdMotivo, m.Descripcion
    ORDER BY TotalMin DESC`;

  const sumarFilas = (rows) => rows.reduce((acc, r) => ({
    Min50: (acc.Min50 || 0) + Number(r.Min50 || 0),
    Min100: (acc.Min100 || 0) + Number(r.Min100 || 0),
    TotalMin: (acc.TotalMin || 0) + Number(r.TotalMin || 0),
    Monto: (acc.Monto || 0) + Number(r.Monto || 0)
  }), { Min50:0, Min100:0, TotalMin:0, Monto:0 });

  const armarResultados = async (baseSql, etiquetaOtros) => {
    const [todos] = await pool.query(baseSql, params);
    const total = sumarFilas(todos || []);
    let filasMostrar = todos || [];
    if (limit) {
      const [top] = await pool.query(baseSql + ' LIMIT ?', [...params, limit]);
      const topSuma = sumarFilas(top || []);
      const otrosMin50 = Math.max(0, total.Min50 - topSuma.Min50);
      const otrosMin100 = Math.max(0, total.Min100 - topSuma.Min100);
      const otrosTotal = Math.max(0, total.TotalMin - topSuma.TotalMin);
      const otrosMonto = Math.max(0, total.Monto - topSuma.Monto);
      filasMostrar = top || [];
      if (otrosMin50 > 0 || otrosMin100 > 0 || otrosMonto > 0) {
        filasMostrar = [...filasMostrar, { Nombre: etiquetaOtros, Min50: otrosMin50, Min100: otrosMin100, TotalMin: otrosTotal, Monto: otrosMonto }];
      }
    }
    return { filasMostrar, total };
  };

  try {
    let sector = null, motivo = null;
    let chartSector = null, chartMotivo = null;
    if (agrupar === 'sector' || agrupar === 'ambos') {
      sector = await armarResultados(sqlSectorBase, 'Otros sectores');
      const filas = sector.filasMostrar || [];
      chartSector = {
        labels: filas.map(f => f.Nombre),
        horas: filas.map(f => Number(f.TotalMin) || 0),
        importes: filas.map(f => Number(f.Monto) || 0)
      };
    }
    if (agrupar === 'motivo' || agrupar === 'ambos') {
      motivo = await armarResultados(sqlMotivoBase, 'Otros motivos');
      const filas = motivo.filasMostrar || [];
      chartMotivo = {
        labels: filas.map(f => f.Nombre),
        horas: filas.map(f => Number(f.TotalMin) || 0),
        importes: filas.map(f => Number(f.Monto) || 0)
      };
    }

    // Título período: 'mmmm de yyyy'
    const [mm, yyyy] = periodo.split('/');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const tituloPeriodo = `${meses[Number(mm)-1]} de ${yyyy}`;

    return render(req, res, 'consultaNovedadesPorPeriodoResultado', {
      titulo,
      periodo,
      tituloPeriodo,
      agrupar,
      mostrar,
      sector,
      motivo,
      chartSector,
      chartMotivo
    });
  } catch (e) {
    return render(req, res, 'consultaNovedadesPorPeriodo', { titulo, error: e.message });
  }
});

// Exportar a PDF (placeholder)
router.get('/exportar', logueado, async (req, res) => {
  if (req.session.nivelUsuario !== 1) return res.redirect('/');
  const titulo = 'Exportar a PDF — Novedades por período';
  const periodo = typeof req.query.periodo === 'string' ? req.query.periodo.trim() : '';
  const agrupar = (req.query.agrupar || 'sector').toString();
  const mostrar = (req.query.mostrar || '5').toString();
  if (!/^[0-9]{2}\/[0-9]{4}$/.test(periodo)) {
    return render(req, res, 'consultaNovedadesPorPeriodo', { titulo: 'Novedades por período', Mensaje: { title:'Atención', text:'Ingresá un período válido (mm/aaaa).', icon:'warning' } });
  }
  const [mm, yyyy] = periodo.split('/');
  const nombreSugerido = `Novedades-${yyyy}-${mm}`;
  return render(req, res, 'consultaNovedadesPorPeriodoExportar', { titulo, periodo, agrupar, mostrar, nombreSugerido });
});

router.post('/exportar', logueado, async (req, res) => {
  if (req.session.nivelUsuario !== 1) return res.redirect('/');
  const periodo = typeof req.body.periodo === 'string' ? req.body.periodo.trim() : '';
  const agrupar = (req.body.agrupar || 'sector').toString();
  const mostrar = (req.body.mostrar || '5').toString();
  const nombreArchivo = (req.body.nombreArchivo || '').toString().trim() || 'Novedades';
  if (!/^[0-9]{2}\/[0-9]{4}$/.test(periodo)) {
    return res.status(400).send('Período inválido');
  }
  const limites = { '5': 5, '10': 10 };
  const limit = limites[mostrar] || null;
  const params = [periodo];

  const sqlSectorBase = `
    SELECT s.Descripcion AS Nombre,
           SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) AS Min50,
           SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0)) AS Min100,
           (SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) + SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0))) AS TotalMin,
           SUM(COALESCE(h.Monto,0)) AS Monto
    FROM novedadesr_historico h
    INNER JOIN novedadese e ON e.Id = h.IdNovedadesE
    INNER JOIN sectores s ON s.Id = h.IdSector
    WHERE DATE_FORMAT(e.Periodo, '%m/%Y') = ?
    GROUP BY h.IdSector, s.Descripcion
    ORDER BY TotalMin DESC`;
  const sqlMotivoBase = `
    SELECT m.Descripcion AS Nombre,
           SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) AS Min50,
           SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0)) AS Min100,
           (SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) + SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0))) AS TotalMin,
           SUM(COALESCE(h.Monto,0)) AS Monto
    FROM novedadesr_historico h
    INNER JOIN novedadese e ON e.Id = h.IdNovedadesE
    INNER JOIN motivos m ON m.Id = h.IdMotivo
    WHERE DATE_FORMAT(e.Periodo, '%m/%Y') = ?
    GROUP BY h.IdMotivo, m.Descripcion
    ORDER BY TotalMin DESC`;

  const sumarFilas = (rows) => rows.reduce((acc, r) => ({
    Min50: (acc.Min50 || 0) + Number(r.Min50 || 0),
    Min100: (acc.Min100 || 0) + Number(r.Min100 || 0),
    TotalMin: (acc.TotalMin || 0) + Number(r.TotalMin || 0),
    Monto: (acc.Monto || 0) + Number(r.Monto || 0)
  }), { Min50:0, Min100:0, TotalMin:0, Monto:0 });

  const armarResultados = async (baseSql, etiquetaOtros) => {
    const [todos] = await pool.query(baseSql, params);
    const total = sumarFilas(todos || []);
    let filasMostrar = todos || [];
    if (limit) {
      const [top] = await pool.query(baseSql + ' LIMIT ?', [...params, limit]);
      const topSuma = sumarFilas(top || []);
      const otrosMin50 = Math.max(0, total.Min50 - topSuma.Min50);
      const otrosMin100 = Math.max(0, total.Min100 - topSuma.Min100);
      const otrosTotal = Math.max(0, total.TotalMin - topSuma.TotalMin);
      const otrosMonto = Math.max(0, total.Monto - topSuma.Monto);
      filasMostrar = top || [];
      if (otrosMin50 > 0 || otrosMin100 > 0 || otrosMonto > 0) {
        filasMostrar = [...filasMostrar, { Nombre: etiquetaOtros, Min50: otrosMin50, Min100: otrosMin100, TotalMin: otrosTotal, Monto: otrosMonto }];
      }
    }
    return { filasMostrar, total };
  };

  function minutosAHoras(minutos){
    minutos = Number(minutos)||0;
    const h = Math.floor(minutos/60);
    const m = minutos%60;
    if (h < 100) return `${h}:${String(m).padStart(2,'0')}`;
    if (h < 1000) return `${String(h).padStart(3,'0')}:${String(m).padStart(2,'0')}`;
    return `${String(h).padStart(4,'0')}:${String(m).padStart(2,'0')}`;
  }
  const formatoMoneda = (v)=> new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(Number(v)||0);
  const porcentaje = (parte,total)=>{
    const p = Number(parte)||0; const t = Number(total)||0; if (!t) return '0%';
    return `${new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(p*100/t)}%`;
  }

  function drawPie(doc, cx, cy, radius, valores, colores){
    const total = valores.reduce((a,b)=>(Number(a)||0)+(Number(b)||0),0);
    const toRad = (deg)=> deg * Math.PI / 180;
    const polar = (deg)=> ({
      x: cx + radius * Math.cos(toRad(deg)),
      y: cy + radius * Math.sin(toRad(deg)),
    });
    if (!total) {
      doc.save();
      const outline = `M ${ (cx + radius).toFixed(3)} ${cy.toFixed(3)} `+
        `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 1 1 ${ (cx - radius).toFixed(3)} ${cy.toFixed(3)} `+
        `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 1 1 ${ (cx + radius).toFixed(3)} ${cy.toFixed(3)}`;
      doc.path(outline).strokeColor('#cccccc').lineWidth(0.8).stroke();
      doc.restore();
      return;
    }
    let inicio = -90;
    valores.forEach((v, i)=>{
      const valor = Number(v) || 0;
      if (valor <= 0) return;
      let angulo = (valor / total) * 360;
      if (angulo >= 360) angulo = 359.999; // evita arco completo que cierra mal
      const fin = inicio + angulo;
      const pInicio = polar(inicio);
      const pFin = polar(fin);
      const grande = angulo > 180 ? 1 : 0;
      const color = colores[i % colores.length] || '#999';
      const d = `M ${cx.toFixed(3)} ${cy.toFixed(3)} ` +
        `L ${pInicio.x.toFixed(3)} ${pInicio.y.toFixed(3)} ` +
        `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${grande} 1 ${pFin.x.toFixed(3)} ${pFin.y.toFixed(3)} Z`;
      doc.save();
      doc.lineWidth(0.5);
      doc.strokeColor('#ffffff');
      doc.fillColor(color);
      doc.path(d).fillAndStroke(color, '#ffffff');
      doc.restore();
      inicio = fin;
    });
    const borde = `M ${ (cx + radius).toFixed(3)} ${cy.toFixed(3)} `+
      `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 1 1 ${ (cx - radius).toFixed(3)} ${cy.toFixed(3)} `+
      `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 1 1 ${ (cx + radius).toFixed(3)} ${cy.toFixed(3)}`;
    doc.save();
    doc.lineWidth(0.8).strokeColor('#333333').path(borde).stroke();
    doc.restore();
  }

  function drawLegend(doc, x, y, labels, valores, colores, ancho=220){
    const total = (valores || []).reduce((a,b)=>(Number(a)||0)+(Number(b)||0),0);
    let yy = y;
    (labels || []).forEach((l, i)=>{
      const color = colores[i % colores.length] || '#999';
      const valor = Number((valores || [])[i]) || 0;
      const pct = total ? (valor * 100) / total : 0;
      const pctStr = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pct);
      doc.save();
      doc.rect(x, yy, 12, 12).fill(color);
      doc.restore();
      doc.fillColor('#000').fontSize(9).text(`${l} — ${pctStr}%`, x + 18, yy + 1, { width: ancho, align: 'left' });
      yy += 18;
    });
    doc.font('Helvetica');
    return yy;
  }

  function drawPieLabels(doc, cx, cy, radius, valores, labels, colores){
    const total = (valores || []).reduce((a,b)=>(Number(a)||0)+(Number(b)||0),0);
    if (!total) return;
    const toRad = (deg)=> deg * Math.PI / 180;
    let inicio = -90;
    (valores || []).forEach((valor, i)=>{
      const val = Number(valor) || 0;
      if (val <= 0) return;
      let angulo = (val / total) * 360;
      if (angulo >= 360) angulo = 359.999;
      const mitad = inicio + (angulo / 2);
      const radioTexto = radius * 0.62;
      const x = cx + radioTexto * Math.cos(toRad(mitad));
      const y = cy + radioTexto * Math.sin(toRad(mitad));
      const etiqueta = labels && labels[i] ? labels[i] : '';
      const pct = (val / total) * 100;
      const pctStr = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pct);
      doc.save();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(`${etiqueta}
${pctStr}%`, x - 40, y - 10, { width: 80, align: 'center' });
      doc.restore();
      inicio += angulo;
    });
  }

  try {
    let sector = null, motivo = null;
    let chartSector = null, chartMotivo = null;
    if (agrupar === 'sector' || agrupar === 'ambos') {
      sector = await armarResultados(sqlSectorBase, 'Otros sectores');
      const filas = sector.filasMostrar || [];
      chartSector = {
        labels: filas.map(f => f.Nombre),
        horas: filas.map(f => Number(f.TotalMin) || 0),
        importes: filas.map(f => Number(f.Monto) || 0)
      };
    }
    if (agrupar === 'motivo' || agrupar === 'ambos') {
      motivo = await armarResultados(sqlMotivoBase, 'Otros motivos');
      const filas = motivo.filasMostrar || [];
      chartMotivo = {
        labels: filas.map(f => f.Nombre),
        horas: filas.map(f => Number(f.TotalMin) || 0),
        importes: filas.map(f => Number(f.Monto) || 0)
      };
    }

    const [mm, yyyy] = periodo.split('/');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const tituloPeriodo = `${meses[Number(mm)-1]} de ${yyyy}`;

    res.setHeader('Content-Type', 'application/pdf');
    const nombreFinal = nombreArchivo.toLowerCase().endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${nombreFinal}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 36, autoFirstPage: true });
    doc.info.Title = `Novedades por período — ${tituloPeriodo}`;
    doc.pipe(res);

    // Hoja 1: Tablas
    doc.fontSize(16).text(`Novedades por período — ${tituloPeriodo}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555').text(`Agrupar por: ${agrupar} • Mostrar: ${mostrar}`);
    doc.fillColor('#000');
    doc.moveDown(0.5);

    async function renderTabla(titulo, data){
      if (!data) return;
      doc.moveDown(0.8); // más espacio previo al título
      const anchoContenido = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.font('Helvetica-Bold').fontSize(12).text(titulo, doc.page.margins.left, doc.y, {
        underline: true,
        align: 'center',
        width: anchoContenido
      });
      doc.moveDown(0.8); // más separación entre título y tabla
      const headers = [
        { label: 'Nombre', property: 'Nombre', width: 170 },
        { label: 'Horas 50%', property: 'Min50', width: 70 },
        { label: 'Horas 100%', property: 'Min100', width: 70 },
        { label: 'Total horas', property: 'TotalMin', width: 70 },
        { label: 'Monto', property: 'Monto', width: 80 },
        { label: '%', property: 'Porc', width: 50 }
      ];
      const datas = (data.filasMostrar||[]).map(f=>({
        Nombre: f.Nombre,
        Min50: minutosAHoras(f.Min50),
        Min100: minutosAHoras(f.Min100),
        TotalMin: minutosAHoras(f.TotalMin),
        Monto: formatoMoneda(f.Monto),
        Porc: porcentaje(f.Monto, data.total.Monto)
      }));
      // Agrego fila de totales como última fila para asegurar alineación automática
      datas.push({
        Nombre: 'Totales',
        Min50: minutosAHoras(data.total.Min50),
        Min100: minutosAHoras(data.total.Min100),
        TotalMin: minutosAHoras(data.total.TotalMin),
        Monto: formatoMoneda(data.total.Monto),
        Porc: '100%'
      });
      const table = {
        headers,
        datas,
      };
      await doc.table(table, {
        columnsSize: headers.map(h=>h.width),
        prepareHeader: () => doc.fontSize(9),
        prepareRow: (row, columnIndex, rowIndex, rectRow) => {
          doc.fontSize(9);
          if (rowIndex === datas.length - 1) {
            if (columnIndex === 0 && rectRow) {
              doc.save();
              doc.rect(rectRow.x, rectRow.y, rectRow.width, rectRow.height).fill('#e9ecef');
              doc.restore();
            }
            doc.font('Helvetica-Bold');
            doc.fillColor('#000000');
          } else if (columnIndex === 0) {
            doc.font('Helvetica');
            doc.fillColor('#000000');
          }
        }
      });
      doc.moveDown(1.2);
    }

    if (agrupar === 'sector') {
      await renderTabla('Tabla por sector', sector);
    } else if (agrupar === 'motivo') {
      await renderTabla('Tabla por motivo', motivo);
    } else {
      await renderTabla('Tabla por sector', sector);
      doc.moveDown(0.5);
      await renderTabla('Tabla por motivo', motivo);
    }

    // Paleta de colores coherente con el front
    const colores = ['#0d6efd','#6f42c1','#198754','#dc3545','#fd7e14','#20c997','#0dcaf0','#6c757d','#6610f2','#ffc107','#1982C4','#8AC926'];

    // Hojas de gráficos
    function paginaGraficos(tituloPagina, chart){
      if (!chart || !Array.isArray(chart.labels) || chart.labels.length === 0) return;
      doc.addPage();
      const anchoContenido = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.font('Helvetica-Bold').fontSize(16).text(`${tituloPagina} (${tituloPeriodo})`, doc.page.margins.left, doc.y, {
        align: 'center',
        width: anchoContenido
      });
      doc.moveDown(0.8);

      const margenIzq = doc.page.margins.left;
      const margenDer = doc.page.margins.right;
      const anchoUtil = doc.page.width - margenIzq - margenDer;
      const radio = 120;
      const centroX = margenIzq + radio + 10; // dejamos margen y colocamos leyenda a la derecha
      const xLeyenda = centroX + radio + 30;
      const anchoLeyenda = doc.page.width - xLeyenda - margenDer;

      const seccion = (titulo, datos)=>{
        doc.font('Helvetica-Bold').fontSize(12).text(titulo, margenIzq, doc.y, {
          width: anchoUtil,
          align: 'center'
        });
        const tituloY = doc.y;
        const centroY = tituloY + radio + 14;
        drawPie(doc, centroX, centroY, radio, datos || [], colores);
        drawPieLabels(doc, centroX, centroY, radio, datos || [], chart.labels || [], colores);
        const leyendaAltura = ((chart.labels || []).length * 18) || 0;
        const leyendaY = centroY - (leyendaAltura / 2);
        const leyendaFin = drawLegend(doc, xLeyenda, leyendaY, chart.labels || [], datos || [], colores, anchoLeyenda);
        const baseY = Math.max(centroY + radio, leyendaFin) + 24;
        doc.y = baseY;
      };

      seccion('Distribución por horas', chart.horas);
      const separacion = 32;
      doc.y += separacion;
      seccion('Distribución por montos', chart.importes);
    }
    if (agrupar === 'sector' || agrupar === 'ambos') paginaGraficos('Gráficos — Sector', chartSector);
    if (agrupar === 'motivo' || agrupar === 'ambos') paginaGraficos('Gráficos — Motivo', chartMotivo);

    doc.end();
  } catch (e) {
    console.error('Error exportando PDF:', e);
    return res.status(500).send('Error generando PDF');
  }
});

module.exports = router;
