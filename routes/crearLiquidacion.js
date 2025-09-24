const express = require('express');
const {pool} = require('../conexion');
const {render, enviarMensaje} = require('../Middleware/render');
const {Periodo, FechaSqlAFechaCorta} = require('../lib/libreria');
const {logueado} = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1]; // Nivel de usuario aceptado

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.get('/', logueado, async (req, res) => {
    const sqlLiquidacionE = "SELECT DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo, Observaciones, DATE_FORMAT(NovedadesHasta, '%Y-%m-%d') AS NovedadesHasta FROM novedadese WHERE Actual = 1 LIMIT 1";
    let periodo = '';
    let observaciones = '';
    let NovedadesHasta = '';

    try {
        const [liquidacionE] = await pool.query(sqlLiquidacionE);
        if (liquidacionE.length === 0) {
            return render(req, res, 'periodoActual');
        } else {
            // Periodo como 'YYYY-MM-DD' sin construir Date para evitar corrimientos
            const perStr = liquidacionE[0].Periodo;
            if (typeof perStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(perStr)) {
                const [y, m] = perStr.split('-');
                periodo = Periodo(Number(m), Number(y));
            } else {
                periodo = '';
            }
            observaciones = liquidacionE[0].Observaciones;
            const nh = liquidacionE[0].NovedadesHasta;
            if (typeof nh === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nh)) {
                const [y2, m2, d2] = nh.split('-');
                NovedadesHasta = `${d2}/${m2}/${y2}`;
            } else {
                NovedadesHasta = FechaSqlAFechaCorta(nh);
            }
            return render(req, res, 'periodoActual', {periodo, observaciones, NovedadesHasta});
        }
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, 'Error en el servidor', error.message, 'danger');
        return res.status(500).send('Error en el servidor');
    }
});
router.post ('/', logueado, async (req, res) => {
    const {mes, anio, observaciones, NovedadesHasta} = req.body;
    sqlAgregarPeriodo = "INSERT INTO novedadese (Periodo, Observaciones, NovedadesHasta, Actual) VALUES (?, ?, ?, 1)";

    if (!mes || !anio) {
        return render(req, res, 'periodoActual', {Mensaje: {Title: 'Error', text: 'Debe ingresar mes y año', icon: 'error'}});
    }

    try {
        const [periodoActual] = await pool.query("SELECT * FROM novedadese WHERE Actual = 1");
        if (periodoActual.length > 0) {
            throw new Error('Ya existe un período actual');
        }
        await pool.query(sqlAgregarPeriodo, [`${anio}-${mes}-01`, observaciones, NovedadesHasta]);
        return res.redirect('/');
    }
    catch (error) {
        console.error(error);
        return render(req, res, 'periodoActual', {Mensaje: {Title: 'Error', text: error.message, icon: 'error'}});
    }

});
module.exports = router;