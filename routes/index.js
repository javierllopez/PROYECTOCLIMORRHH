const express = require('express');
const {logueado} = require('../Middleware/validarUsuario')
const {render} = require('../Middleware/render');
const { pool } = require('../conexion');
const router = express.Router();
const nivelAceptado = [1,2,3];

router.get('/', logueado, async (req, res) => {
    let dashboard = {};
    // Datos para vista de supervisor (nivel 2)
    let supervisorNombre = null;
    let supervisorSectores = [];
    // Datos para vista de usuario final (nivel 3)
    let usuarioPerfil = null;
    if (req.session.nivelUsuario == 1) {
        try {
            // Personal vigente al día de hoy: Ingreso <= hoy y Baja NULL o >= hoy
                        const [vigRows] = await pool.query(
                                `SELECT COUNT(*) AS total
                                 FROM personal
                                 WHERE FechaIngreso <= CURDATE()
                                     AND (FechaBaja IS NULL OR UNIX_TIMESTAMP(FechaBaja) IS NULL OR FechaBaja >= CURDATE())`
                        );
            dashboard.personalVigente = (vigRows && vigRows[0] && Number(vigRows[0].total)) ? Number(vigRows[0].total) : 0;
            // Por compatibilidad con código previo
            dashboard.usuariosActivos = dashboard.personalVigente;
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
            let graficoTortaMotivos = { labels: [], data: [] };
            let graficoLineaHoras = { labels: [], min50: [], min100: [], total: [] };
            let graficoLineaImportes = { labels: [], importes: [] };
            if (periodoRows.length > 0) {
                // Obtener el Id del período actual
                const idNovedadesE = await pool.query("SELECT Id FROM novedadese WHERE Actual = 1 LIMIT 1");
                if (idNovedadesE[0].length > 0) {
                    const idPeriodo = idNovedadesE[0][0].Id;
                    // Empleados con horas cargadas (DISTINCT IdEmpleado) en el período actual
                    const [empHorasRows] = await pool.query(
                        "SELECT COUNT(DISTINCT IdEmpleado) AS cant FROM novedadesr WHERE IdNovedadesE = ?",
                        [idPeriodo]
                    );
                    dashboard.empleadosConHoras = (empHorasRows && empHorasRows[0] && Number(empHorasRows[0].cant)) ? Number(empHorasRows[0].cant) : 0;
                    // Monto total a pagar en el período actual
                    const [montoRows] = await pool.query(
                        "SELECT SUM(COALESCE(Monto,0)) AS total FROM novedadesr WHERE IdNovedadesE = ?",
                        [idPeriodo]
                    );
                    dashboard.montoTotalPagar = (montoRows && montoRows[0] && Number(montoRows[0].total)) ? Number(montoRows[0].total) : 0;

                    // Sumar minutos agrupados por sector
                    const [minutosSectoresRows] = await pool.query(`
                        SELECT s.Descripcion as sector, SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGD,0) + COALESCE(n.MinutosGN,0)) as totalMinutos
                        FROM novedadesr n
                        INNER JOIN sectores s ON n.IdSector = s.Id
                        WHERE n.IdNovedadesE = ?
                        GROUP BY n.IdSector, s.Descripcion
                        ORDER BY s.Descripcion
                    `, [idPeriodo]);
                    // Ordenar por total de minutos desc y agrupar "Otros sectores" a partir del 6to
                    const ordenados = minutosSectoresRows
                        .map(r => ({ sector: r.sector, total: Number(r.totalMinutos) || 0 }))
                        .sort((a, b) => b.total - a.total);
                    const top5 = ordenados.slice(0, 5);
                    const resto = ordenados.slice(5);
                    const sumaResto = resto.reduce((acc, it) => acc + it.total, 0);
                    graficoTortaSectores.labels = top5.map(it => it.sector);
                    graficoTortaSectores.data = top5.map(it => it.total);
                    if (sumaResto > 0) {
                        graficoTortaSectores.labels.push('Otros sectores');
                        graficoTortaSectores.data.push(sumaResto);
                    }

                    // Sumar minutos agrupados por motivo
                    const [minutosMotivosRows] = await pool.query(`
                        SELECT m.Descripcion as motivo, SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGD,0) + COALESCE(n.MinutosGN,0)) as totalMinutos
                        FROM novedadesr n
                        INNER JOIN motivos m ON n.IdMotivo = m.Id
                        WHERE n.IdNovedadesE = ?
                        GROUP BY n.IdMotivo, m.Descripcion
                        ORDER BY m.Descripcion
                    `, [idPeriodo]);
                    const ordenadosM = minutosMotivosRows
                        .map(r => ({ motivo: r.motivo, total: Number(r.totalMinutos) || 0 }))
                        .sort((a, b) => b.total - a.total);
                    const top5M = ordenadosM.slice(0, 5);
                    const restoM = ordenadosM.slice(5);
                    const sumaRestoM = restoM.reduce((acc, it) => acc + it.total, 0);
                    graficoTortaMotivos.labels = top5M.map(it => it.motivo);
                    graficoTortaMotivos.data = top5M.map(it => it.total);
                    if (sumaRestoM > 0) {
                        graficoTortaMotivos.labels.push('Otros motivos');
                        graficoTortaMotivos.data.push(sumaRestoM);
                    }
                }
            }
            dashboard.totalMinutos = graficoTortaSectores.data.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
            dashboard.graficoTortaSectores = graficoTortaSectores;
            dashboard.graficoTortaMotivos = graficoTortaMotivos;

            // Serie de líneas: últimos 5 meses (Min50, Min100, Total) desde histórico
            try {
                const [periodosRows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese ORDER BY Periodo DESC LIMIT 5");
                if (periodosRows && periodosRows.length) {
                    const ids = periodosRows.map(r => r.Id);
                    // Sumas por IdNovedadesE en histórico
                    let sumasMap = new Map();
                    try {
                        const [sumasRows] = await pool.query(
                            `SELECT IdNovedadesE,
                                    SUM(COALESCE(MinutosAl50,0) + COALESCE(MinutosGD,0)) AS Min50,
                                    SUM(COALESCE(MinutosAl100,0) + COALESCE(MinutosGN,0)) AS Min100
                             FROM novedadesr_historico
                             WHERE IdNovedadesE IN (${ids.map(() => '?').join(',')})
                             GROUP BY IdNovedadesE`, ids
                        );
                        for (const r of sumasRows) {
                            sumasMap.set(r.IdNovedadesE, { min50: Number(r.Min50) || 0, min100: Number(r.Min100) || 0 });
                        }
                    } catch (e) {
                        // Si no existe la tabla histórico o falla, dejar los datos en cero
                        sumasMap = new Map();
                    }

                    // Sumas de importes pagados por período desde liquidaciones_historico
                    let importesMap = new Map();
                    try {
                        const [impRows] = await pool.query(
                            `SELECT IdNovedadesE, SUM(COALESCE(Monto,0)) AS Total
                             FROM liquidaciones_historico
                             WHERE IdNovedadesE IN (${ids.map(() => '?').join(',')})
                             GROUP BY IdNovedadesE`, ids
                        );
                        for (const r of impRows) {
                            importesMap.set(r.IdNovedadesE, Number(r.Total) || 0);
                        }
                    } catch (e) {
                        importesMap = new Map();
                    }
                    // Ordenar cronológicamente ascendente para el gráfico
                    const mesesAsc = [...periodosRows].sort((a, b) => (a.Periodo < b.Periodo ? -1 : 1));
                    const labels = [];
                    const serie50 = [];
                    const serie100 = [];
                    const serieTotal = [];
                    const serieImportes = [];
                    for (const p of mesesAsc) {
                        const [y, m] = String(p.Periodo).split('-');
                        labels.push(`${m}/${y}`);
                        const s = sumasMap.get(p.Id) || { min50: 0, min100: 0 };
                        const v50 = Number(s.min50) || 0;
                        const v100 = Number(s.min100) || 0;
                        serie50.push(v50);
                        serie100.push(v100);
                        serieTotal.push(v50 + v100);
                        const imp = importesMap.get(p.Id) || 0;
                        serieImportes.push(imp);
                    }
                    graficoLineaHoras = { labels, min50: serie50, min100: serie100, total: serieTotal };
                    graficoLineaImportes = { labels, importes: serieImportes };
                }
            } catch (e) {
                // Ignorar si no hay datos históricos
            }
            dashboard.graficoLineaHoras = graficoLineaHoras;
            dashboard.graficoLineaImportes = graficoLineaImportes;
            // Defaults si no hubo período
            if (dashboard.empleadosConHoras == null) dashboard.empleadosConHoras = 0;
            if (dashboard.montoTotalPagar == null) dashboard.montoTotalPagar = 0;
        } catch (err) {
            console.log(err);
            dashboard.usuariosActivos = 0;
            dashboard.personalVigente = 0;
            dashboard.empleadosConHoras = 0;
            dashboard.montoTotalPagar = 0;
            dashboard.periodoActual = 'No definido';
            dashboard.observacionesPeriodo = '';
        }
    }

    // Si es supervisor, obtener su nombre y sectores antes del render
    if (req.session.nivelUsuario == 2) {
        try {
            const [pers] = await pool.query('SELECT ApellidoYNombre FROM personal WHERE idUsuario = ? LIMIT 1', [req.session.idUsuario]);
            if (pers && pers.length) supervisorNombre = pers[0].ApellidoYNombre;
        } catch (e) { /* noop */ }
        try {
            const [secs] = await pool.query('SELECT Id, Descripcion FROM sectores WHERE IdSupervisor = ? ORDER BY Descripcion', [req.session.idUsuario]);
            supervisorSectores = Array.isArray(secs) ? secs : [];
        } catch (e) { supervisorSectores = []; }
    }

    // Si es usuario final, obtener sus datos (Apellido y Nombre, Sector y Turno)
    if (req.session.nivelUsuario == 3) {
        try {
            const [rows] = await pool.query(
                `SELECT p.ApellidoYNombre,
                        s.Descripcion AS Sector,
                        t.Descripcion AS Turno
                 FROM personal p
                 LEFT JOIN sectores s ON s.Id = p.IdSector
                 LEFT JOIN turnos t ON t.Id = p.IdTurno
                 WHERE p.idUsuario = ?
                 LIMIT 1`,
                [req.session.idUsuario]
            );
            if (rows && rows.length) {
                usuarioPerfil = rows[0];
            }
        } catch (e) { usuarioPerfil = null; }
    }

    if (req.device.type === 'phone') {
        if (req.session.nivelUsuario == 1) {
            return render(req, res, 'partials/menuAdmin', { dashboard });
        }
        if (req.session.nivelUsuario == 2) {
            return render(req, res, 'partials/menuSupervisor', { supervisorNombre, supervisorSectores });
        }
        if (req.session.nivelUsuario == 3) {
            // Para el usuario final, la vista principal será index.hbs en móvil
            return render(req, res, 'index', { nivelUsuario: req.session.nivelUsuario, usuarioPerfil });
        }
    } else {
        return render(req, res, 'index', { dashboard, nivelUsuario: req.session.nivelUsuario, supervisorNombre, supervisorSectores, usuarioPerfil });
    }

});

// Evolución de importes pagados por sector (últimos 5 meses) con matriz Sector x Período
router.get('/evolucionImportesSectores', logueado, async (req, res) => {
    if (req.session.nivelUsuario != 1) return res.redirect('/');
    try {
        const [periodosRows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese ORDER BY Periodo DESC LIMIT 5");
        if (!periodosRows || !periodosRows.length) {
            return render(req, res, 'evolucionImportesSectores', { labels: [], sectores: [], hayDatos: false });
        }
        const mesesAsc = [...periodosRows].sort((a, b) => (a.Periodo < b.Periodo ? -1 : 1));
        const labels = mesesAsc.map(p => {
            const [y, m] = String(p.Periodo).split('-');
            return `${m}/${y}`;
        });
        const ids = mesesAsc.map(p => p.Id);
        try {
            const [rows] = await pool.query(
                `SELECT s.Id AS SectorId, s.Descripcion AS Sector, l.IdNovedadesE,
                        SUM(COALESCE(l.Monto,0)) AS Importe
                 FROM liquidaciones_historico l
                 INNER JOIN sectores s ON s.Id = l.Sector
                 WHERE l.IdNovedadesE IN (${ids.map(() => '?').join(',')})
                 GROUP BY s.Id, s.Descripcion, l.IdNovedadesE`, ids
            );
            const sectoresMap = new Map();
            for (const r of rows) {
                const secId = r.SectorId;
                if (!sectoresMap.has(secId)) {
                    sectoresMap.set(secId, { id: secId, sector: r.Sector, importes: Array(ids.length).fill(0) });
                }
                const idx = ids.indexOf(r.IdNovedadesE);
                const imp = Number(r.Importe) || 0;
                if (idx >= 0) sectoresMap.get(secId).importes[idx] = imp;
            }
            let totalesImportes = Array(ids.length).fill(0);
            const sectores = Array.from(sectoresMap.values())
                .map(s => ({
                    id: s.id,
                    sector: s.sector,
                    importes: s.importes,
                    totalImportes: s.importes.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0)
                }))
                .filter(s => s.totalImportes > 0)
                .sort((a, b) => b.totalImportes - a.totalImportes);

            for (const s of sectores) {
                s.importes.forEach((v, i) => { totalesImportes[i] += Number(v) || 0; });
            }

            return render(req, res, 'evolucionImportesSectores', { labels, sectores, totalesImportes, hayDatos: sectores.length > 0 });
        } catch (e) {
            return render(req, res, 'evolucionImportesSectores', { labels, sectores: [], totalesImportes: [], hayDatos: false, error: e.message });
        }
    } catch (e) {
        return render(req, res, 'evolucionImportesSectores', { labels: [], sectores: [], totalesImportes: [], hayDatos: false, error: e.message });
    }
});

// Detalle de horas por sector (admin)
router.get('/detalleHorasSectores', logueado, async (req, res) => {
    if (req.session.nivelUsuario != 1) return res.redirect('/');
    try {
        const [rowsE] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese WHERE Actual = 1 LIMIT 1");
        if (!rowsE.length) return render(req, res, 'detalleHorasSectores', { detalle: [], total: { min50:0, min100:0, monto:0 }, periodoActual: '' });
        const idPeriodo = rowsE[0].Id;
        const periodoActual = rowsE[0].Periodo;
        const [rows] = await pool.query(`
            SELECT s.Descripcion AS Sector,
                   SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosGD,0)) AS Min50,
                   SUM(COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGN,0)) AS Min100,
                   SUM(COALESCE(n.Monto,0)) AS Monto,
                   SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosGD,0) + COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGN,0)) AS TotalMin
            FROM novedadesr n
            INNER JOIN sectores s ON n.IdSector = s.Id
            WHERE n.IdNovedadesE = ?
            GROUP BY n.IdSector, s.Descripcion
            ORDER BY TotalMin DESC
        `, [idPeriodo]);
        const tot = rows.reduce((acc, r) => ({
            min50: acc.min50 + Number(r.Min50 || 0),
            min100: acc.min100 + Number(r.Min100 || 0),
            monto: acc.monto + Number(r.Monto || 0)
        }), { min50:0, min100:0, monto:0 });
        const hayDatos = rows.length > 0;
        return render(req, res, 'detalleHorasSectores', { detalle: rows, total: tot, periodoActual, hayDatos });
    } catch (e) {
        return render(req, res, 'detalleHorasSectores', { detalle: [], total: { min50:0, min100:0, monto:0 }, periodoActual: '', hayDatos: false, error: e.message });
    }
});

// Detalle de horas por motivo (admin)
router.get('/detalleHorasMotivos', logueado, async (req, res) => {
    if (req.session.nivelUsuario != 1) return res.redirect('/');
    try {
        const [rowsE] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese WHERE Actual = 1 LIMIT 1");
        if (!rowsE.length) return render(req, res, 'detalleHorasMotivos', { detalle: [], total: { min50:0, min100:0, monto:0 }, periodoActual: '' });
        const idPeriodo = rowsE[0].Id;
        const periodoActual = rowsE[0].Periodo;
        const [rows] = await pool.query(`
            SELECT m.Descripcion AS Motivo,
                   SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosGD,0)) AS Min50,
                   SUM(COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGN,0)) AS Min100,
                   SUM(COALESCE(n.Monto,0)) AS Monto,
                   SUM(COALESCE(n.MinutosAl50,0) + COALESCE(n.MinutosGD,0) + COALESCE(n.MinutosAl100,0) + COALESCE(n.MinutosGN,0)) AS TotalMin
            FROM novedadesr n
            INNER JOIN motivos m ON n.IdMotivo = m.Id
            WHERE n.IdNovedadesE = ?
            GROUP BY n.IdMotivo, m.Descripcion
            ORDER BY TotalMin DESC
        `, [idPeriodo]);
        const tot = rows.reduce((acc, r) => ({
            min50: acc.min50 + Number(r.Min50 || 0),
            min100: acc.min100 + Number(r.Min100 || 0),
            monto: acc.monto + Number(r.Monto || 0)
        }), { min50:0, min100:0, monto:0 });
        return render(req, res, 'detalleHorasMotivos', { detalle: rows, total: tot, periodoActual });
    } catch (e) {
        return render(req, res, 'detalleHorasMotivos', { detalle: [], total: { min50:0, min100:0, monto:0 }, periodoActual: '', error: e.message });
    }
});
    // Evolución de horas por sector (últimos 5 meses) con matriz Sector x Período
    router.get('/evolucionHorasSectores', logueado, async (req, res) => {
        if (req.session.nivelUsuario != 1) return res.redirect('/');
        try {
            const [periodosRows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese ORDER BY Periodo DESC LIMIT 5");
            if (!periodosRows || !periodosRows.length) {
                return render(req, res, 'evolucionHorasSectores', { labels: [], sectores: [], hayDatos: false });
            }
            const mesesAsc = [...periodosRows].sort((a, b) => (a.Periodo < b.Periodo ? -1 : 1));
            const labels = mesesAsc.map(p => {
                const [y, m] = String(p.Periodo).split('-');
                return `${m}/${y}`;
            });
            const ids = mesesAsc.map(p => p.Id);
            try {
                const [rows] = await pool.query(
            `SELECT s.Id AS SectorId, s.Descripcion AS Sector, h.IdNovedadesE,
                SUM(COALESCE(h.MinutosAl50,0) + COALESCE(h.MinutosGD,0)) AS Min50,
                SUM(COALESCE(h.MinutosAl100,0) + COALESCE(h.MinutosGN,0)) AS Min100
                     FROM novedadesr_historico h
                     INNER JOIN sectores s ON s.Id = h.IdSector
                     WHERE h.IdNovedadesE IN (${ids.map(() => '?').join(',')})
                     GROUP BY s.Id, s.Descripcion, h.IdNovedadesE`, ids
                );
                const sectoresMap = new Map();
                for (const r of rows) {
                    const secId = r.SectorId;
                    if (!sectoresMap.has(secId)) {
                        sectoresMap.set(secId, { id: secId, sector: r.Sector, minutos: Array(ids.length).fill(0) });
                    }
                    const idx = ids.indexOf(r.IdNovedadesE);
                    const min = (Number(r.Min50) || 0) + (Number(r.Min100) || 0);
                    if (idx >= 0) sectoresMap.get(secId).minutos[idx] = min;
                }
                const sectores = Array.from(sectoresMap.values())
                    .map(s => ({
                        id: s.id,
                        sector: s.sector,
                        minutos: s.minutos,
                        horasDec: s.minutos.map(m => (Number(m) || 0) / 60),
                        totalMinutos: s.minutos.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0)
                    }))
                    .filter(s => s.totalMinutos > 0)
                    .sort((a, b) => b.totalMinutos - a.totalMinutos);

                const totals = Array(ids.length).fill(0);
                for (const s of sectores) {
                    for (let i = 0; i < totals.length; i++) {
                        totals[i] += Number(s.minutos[i]) || 0;
                    }
                }
                const totalFila = { sector: 'Totales', minutos: totals, totalMinutos: totals.reduce((a,b)=>a+(Number(b)||0),0) };

                return render(req, res, 'evolucionHorasSectores', { labels, sectores, totalFila, hayDatos: sectores.length > 0 });
            } catch (e) {
                return render(req, res, 'evolucionHorasSectores', { labels, sectores: [], hayDatos: false, error: e.message });
            }
        } catch (e) {
            return render(req, res, 'evolucionHorasSectores', { labels: [], sectores: [], hayDatos: false, error: e.message });
        }
    });
// Evolución de importes pagados por sector (últimos 5 meses) con matriz Sector x Período
router.get('/evolucionImportesSectores', logueado, async (req, res) => {
    if (req.session.nivelUsuario != 1) return res.redirect('/');
    try {
        const [periodosRows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese ORDER BY Periodo DESC LIMIT 5");
        if (!periodosRows || !periodosRows.length) {
            return render(req, res, 'evolucionImportesSectores', { labels: [], sectores: [], hayDatos: false });
        }
        const mesesAsc = [...periodosRows].sort((a, b) => (a.Periodo < b.Periodo ? -1 : 1));
        const labels = mesesAsc.map(p => {
            const [y, m] = String(p.Periodo).split('-');
            return `${m}/${y}`;
        });
        const ids = mesesAsc.map(p => p.Id);
        try {
            const [rows] = await pool.query(
                `SELECT s.Id AS SectorId, s.Descripcion AS Sector, h.IdNovedadesE,
                        SUM(COALESCE(h.Monto,0)) AS Importe
                 FROM liquidaciones_historico h
                 INNER JOIN sectores s ON s.Id = h.IdSector
                 WHERE h.IdNovedadesE IN (${ids.map(() => '?').join(',')})
                 GROUP BY s.Id, s.Descripcion, h.IdNovedadesE`, ids
            );
            const sectoresMap = new Map();
            for (const r of rows) {
                const secId = r.SectorId;
                if (!sectoresMap.has(secId)) {
                    sectoresMap.set(secId, { id: secId, sector: r.Sector, importes: Array(ids.length).fill(0) });
                }
                const idx = ids.indexOf(r.IdNovedadesE);
                const imp = Number(r.Importe) || 0;
                if (idx >= 0) sectoresMap.get(secId).importes[idx] = imp;
            }
            const sectores = Array.from(sectoresMap.values())
                .map(s => ({
                    id: s.id,
                    sector: s.sector,
                    importes: s.importes,
                    totalImportes: s.importes.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0)
                }))
                .filter(s => s.totalImportes > 0)
                .sort((a, b) => b.totalImportes - a.totalImportes);

            const totalesImportes = Array(ids.length).fill(0);
            for (const s of sectores) {
                s.importes.forEach((v, i) => { totalesImportes[i] = (Number(totalesImportes[i])||0) + (Number(v)||0); });
            }
            const totalGeneralImportes = totalesImportes.reduce((a,b)=>(Number(a)||0)+(Number(b)||0),0);

            return render(req, res, 'evolucionImportesSectores', { labels, sectores, totalesImportes, totalGeneralImportes, hayDatos: sectores.length > 0 });
        } catch (e) {
            return render(req, res, 'evolucionImportesSectores', { labels, sectores: [], totalesImportes: [], totalGeneralImportes: 0, hayDatos: false, error: e.message });
        }
    } catch (e) {
        return render(req, res, 'evolucionImportesSectores', { labels: [], sectores: [], totalesImportes: [], totalGeneralImportes: 0, hayDatos: false, error: e.message });
    }
});
// Detalle de horas por motivo (admin)


module.exports = router;
