const router = require('express').Router();
const { logueado } = require('../Middleware/validarUsuario');
const { pool } = require('../conexion');
const { render } = require('../Middleware/render');

// GET: formulario de consulta
router.get('/', logueado, async (req, res) => {
  if (req.session.nivelUsuario != 1) return res.redirect('/');
  return render(req, res, 'liquidacionesPorPeriodo', {});
});

// GET: resultados por período mm/yyyy desde liquidaciones_historico
router.get('/resultado', logueado, async (req, res) => {
  if (req.session.nivelUsuario != 1) return res.redirect('/');
  try {
    const periodo = (req.query.periodo || '').trim();
    const m = periodo.match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);
    if (!m) {
      return render(req, res, 'liquidacionesPorPeriodo', { Mensaje: { title: 'Dato inválido', text: 'Indicá un período válido en formato mm/yyyy.', icon: 'warning' }, periodo });
    }
    const mm = m[1].padStart(2, '0');
    const yyyy = m[2];
    const periodoDate = `${yyyy}-${mm}-01`; // se mantiene para posibles usos, pero se filtra por YEAR/MONTH

    const sql = `
      SELECT 
        h.Area,
        h.Sector,
        s.Descripcion AS SectorNombre,
        h.IdEmpleado,
        p.ApellidoYNombre,
        h.Detalle,
        h.Monto,
        h.Vale
      FROM liquidaciones_historico h
      LEFT JOIN sectores s ON s.Id = h.Sector
      LEFT JOIN personal p ON p.Id = h.IdEmpleado
      WHERE YEAR(h.Periodo) = ? AND MONTH(h.Periodo) = ?
      ORDER BY FIELD(h.Area,'Administrativa','Operativa'), s.Descripcion, p.ApellidoYNombre`;
    const [rows] = await pool.query(sql, [Number(yyyy), Number(mm)]);

    const areas = [];
    const areasMap = new Map();
    const totalesPorArea = [];
    let totalGeneral = 0;

    for (const r of rows) {
      const areaKey = r.Area || 'Sin área';
      if (!areasMap.has(areaKey)) {
        const areaObj = { area: areaKey, grupos: [], subtotalArea: 0 };
        areaObj._sectoresMap = new Map();
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

    for (const a of areas) {
      totalesPorArea.push({ area: a.area, total: a.subtotalArea });
      delete a._sectoresMap;
    }

    let periodoLargo = `${mm}/${yyyy}`;
    try {
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const nombreMes = meses[parseInt(mm,10)-1];
      if (nombreMes) periodoLargo = `${nombreMes} de ${yyyy}`;
    } catch {}

    return render(req, res, 'liquidacionesPorPeriodoResultado', { periodoLargo, areas, totalesPorArea, totalGeneral });
  } catch (e) {
    return render(req, res, 'liquidacionesPorPeriodo', { Mensaje: { title: 'Error', text: 'No fue posible consultar el período solicitado.', icon: 'error' } });
  }
});

module.exports = router;
