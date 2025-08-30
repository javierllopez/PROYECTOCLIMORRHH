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
            // Gráfico de torta: minutos trabajados agrupados por estado para el período actual
            let graficoTorta = {
                labels: ['Cargadas', 'Rechazadas por supervisor', 'Aceptadas por supervisor', 'Rechazadas por RRHH', 'Ok'],
                data: [0, 0, 0, 0, 0]
            };
            let graficoTortaSectores = { labels: [], data: [] };
            if (periodoRows.length > 0) {
                // Obtener el Id del período actual
                const idNovedadesE = await pool.query("SELECT Id FROM novedadese WHERE Actual = 1 LIMIT 1");
                if (idNovedadesE[0].length > 0) {
                    const idPeriodo = idNovedadesE[0][0].Id;
                    // Sumar minutos agrupados por IdEstado
                    const [minutosRows] = await pool.query(`
                        SELECT IdEstado, 
                            SUM(COALESCE(MinutosAl50,0) + COALESCE(MinutosAl100,0) + COALESCE(MinutosGd,0) + COALESCE(MinutosGN,0)) AS totalMinutos
                        FROM novedadesr
                        WHERE IdNovedadesE = ?
                        GROUP BY IdEstado
                    `, [idPeriodo]);
                    minutosRows.forEach(row => {
                        if (row.IdEstado >= 1 && row.IdEstado <= 5) {
                            graficoTorta.data[row.IdEstado - 1] = Number(row.totalMinutos) || 0;
                        }
                    });

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
            // Calcular total de minutos para la tabla del gráfico de torta
            dashboard.totalMinutos = graficoTorta.data.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
            dashboard.graficoTorta = graficoTorta;
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
        return render(req, res, 'index', { dashboard });
    }

});


module.exports = router;
