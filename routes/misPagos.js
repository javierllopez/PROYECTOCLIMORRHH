const router = require('express').Router();
const { logueado } = require('../Middleware/validarUsuario');
const { render } = require('../Middleware/render');
const { pool } = require('../conexion');

// Pagos del usuario logueado (todos los niveles)
router.get('/', logueado, async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    const sql = `
      SELECT * FROM (
        SELECT DATE_FORMAT(l.Periodo, '%Y-%m-%d') AS Periodo,
               DATE_FORMAT(l.Periodo, '%m/%Y') AS PeriodoMMYY,
               l.Detalle AS Detalle,
               COALESCE(l.Monto,0) AS Monto,
               CAST(COALESCE(l.Vale,0) AS SIGNED) AS Vale
        FROM liquidaciones l
        WHERE l.IdEmpleado = ?
        UNION ALL
        SELECT DATE_FORMAT(h.Periodo, '%Y-%m-%d') AS Periodo,
               DATE_FORMAT(h.Periodo, '%m/%Y') AS PeriodoMMYY,
               h.Detalle AS Detalle,
               COALESCE(h.Monto,0) AS Monto,
               CAST(COALESCE(h.Vale,0) AS SIGNED) AS Vale
        FROM liquidaciones_historico h
        WHERE h.IdEmpleado = ?
      ) u
      ORDER BY u.Periodo DESC`;
    const [rows] = await pool.query(sql, [idUsuario, idUsuario]);
    const pagos = Array.isArray(rows) ? rows : [];
    return render(req, res, 'misPagos', { pagos });
  } catch (e) {
    return render(req, res, 'misPagos', { pagos: [], error: e.message });
  }
});

module.exports = router;
