const express = require('express');
const {logueado} = require('../Middleware/validarUsuario')
const {render} = require('../Middleware/render');
const { pool } = require('../conexion');
const router = express.Router();
const nivelAceptado = [1,2,3];

router.get('/', logueado, async (req, res) => {
    let dashboard = {};
    if (req.session.nivelUsuario == 1) {
        try {
            // Total de personal en actividad: FechaBaja IS NULL o ''
            const [rows] = await pool.query("SELECT COUNT(*) as total FROM personal WHERE FechaBaja IS NULL");
            dashboard.usuariosActivos = rows[0].total;
            // Período de liquidación actual y observaciones
            const [periodoRows] = await pool.query("SELECT DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo, Observaciones FROM novedadese WHERE Actual = 1 LIMIT 1");
            if (periodoRows.length > 0) {
                // Formatear periodo: campo DATE de MySQL
                let periodo = periodoRows[0].Periodo; // 'YYYY-MM-DD'
                let periodoFormateado = '';
                if (typeof periodo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
                    const [y, m] = periodo.split('-');
                    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                    const mesNombre = meses[Number(m) - 1];
                    periodoFormateado = mesNombre + ' de ' + y;
                } else {
                    periodoFormateado = 'No definido';
                }
                dashboard.periodoActual = periodoFormateado;
                dashboard.observacionesPeriodo = periodoRows[0].Observaciones;
            } else {
                dashboard.periodoActual = 'No definido';
                dashboard.observacionesPeriodo = '';
            }
            let graficoTortaSectores = { labels: [], data: [] };
            if (periodoRows.length > 0) {
                // Obtener el Id del período actual
                const idNovedadesE = await pool.query("SELECT Id FROM novedadese WHERE Actual = 1 LIMIT 1");
                if (idNovedadesE[0].length > 0) {
                    const idPeriodo = idNovedadesE[0][0].Id;

                    // Sumar minutos agrupados por sector
                    const [minutosSectoresRows] = await pool.query(`
                        SELECT s.Descripcion as sector, SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGd,0) + COALESCE(n.MinutosGN,0)) as totalMinutos
                        FROM novedadesr n
                        INNER JOIN sectores s ON n.IdSector = s.Id
                        WHERE n.IdNovedadesE = ?
                        GROUP BY n.IdSector, s.Descripcion
                        ORDER BY s.Descripcion
                    `, [idPeriodo]);
                    graficoTortaSectores.labels = minutosSectoresRows.map(r => r.sector);
                    graficoTortaSectores.data = minutosSectoresRows.map(r => Number(r.totalMinutos) || 0);
                }
            }
            dashboard.totalMinutos = graficoTortaSectores.data.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
            dashboard.graficoTortaSectores = graficoTortaSectores;
        } catch (err) {
            dashboard.usuariosActivos = 0;
            dashboard.periodoActual = 'No definido';
            dashboard.observacionesPeriodo = '';
        }
    }

    if (req.device.type === 'phone') {
        if (req.session.nivelUsuario == 1) {
            return render(req, res, 'partials/menuAdmin', { dashboard });
        }
        if (req.session.nivelUsuario == 2) {
            return render(req, res, 'partials/menuSupervisor');
        }
        if (req.session.nivelUsuario == 3) {
            return render(req, res, 'partials/menuUsuario');
        }
    } else {
        return render(req, res, 'index', { dashboard, nivelUsuario: req.session.nivelUsuario });
    }

});

// Detalle de horas por sector (admin)
router.get('/detalleHorasSectores', logueado, async (req, res) => {
    if (req.session.nivelUsuario != 1) return res.redirect('/');
    try {
        const [rowsE] = await pool.query('SELECT Id FROM novedadese WHERE Actual = 1 LIMIT 1');
        if (!rowsE.length) return render(req, res, 'detalleHorasSectores', { detalle: [], total: { min50:0, min100:0, monto:0 } });
        const idPeriodo = rowsE[0].Id;
        const [rows] = await pool.query(`
            SELECT s.Descripcion AS Sector,
                   SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosGd,0)) AS Min50,
                   SUM(COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGN,0)) AS Min100,
                   SUM(COALESCE(n.Monto,0)) AS Monto
            FROM novedadesr n
            INNER JOIN sectores s ON n.IdSector = s.Id
            WHERE n.IdNovedadesE = ?
            GROUP BY n.IdSector, s.Descripcion
            ORDER BY s.Descripcion
        `, [idPeriodo]);
        const tot = rows.reduce((acc, r) => ({
            min50: acc.min50 + Number(r.Min50 || 0),
            min100: acc.min100 + Number(r.Min100 || 0),
            monto: acc.monto + Number(r.Monto || 0)
        }), { min50:0, min100:0, monto:0 });
        return render(req, res, 'detalleHorasSectores', { detalle: rows, total: tot });
    } catch (e) {
        return render(req, res, 'detalleHorasSectores', { detalle: [], total: { min50:0, min100:0, monto:0 }, error: e.message });
    }
});


module.exports = router;
