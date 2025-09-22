const express = require('express');
const {pool} = require('../conexion');
const {render, enviarMensaje} = require('../Middleware/render');
const { FormatearFecha, ExtraerHora } = require('../lib/libreria.js');
const {logueado} = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [2];

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.get('/', logueado, async (req, res) => {
    const sqlNovedadesE = "SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo, Observaciones, Actual, NovedadesHasta FROM novedadesE WHERE Actual = 1";
    const sqlNovedadesR = `
        SELECT 
            novedadesR.Id as IdNovedadesR, 
            novedadesR.IdNovedadesE, 
            novedadesR.IdEmpleado, 
            personal.Id as IdPersonal, 
            personal.ApellidoYNombre AS Empleado,
            DATE_FORMAT(novedadesR.Fecha, '%Y-%m-%d') AS Fecha,
            novedadesR.Hs50,
            novedadesR.Hs100,
            novedadesR.GuardiasDiurnas,
            novedadesR.GuardiasNocturnas,
            novedadesR.GuardiasPasivas,
            novedadesR.IdSupervisor,
            novedadesR.IdMotivo,
            novedadesR.IdEstado,
            novedadesR.ObservacionesEstado, 
            novedadesR.Inicio,
            novedadesR.Fin,
            motivos.Id, 
            motivos.Descripcion AS Motivo,
            novedadesR.Observaciones
        FROM 
            novedadesR
            LEFT JOIN personal ON novedadesR.IdEmpleado = personal.Id
            LEFT JOIN motivos ON novedadesR.IdMotivo = motivos.Id
        WHERE 
            novedadesR.IdNovedadesE = ? 
            AND novedadesR.IdSupervisor = ?
        ORDER BY
            personal.ApellidoYNombre, 
            novedadesR.Fecha
    `;

    try {
        const [novedadesE] = await pool.query(sqlNovedadesE);
        if (novedadesE.length === 0) {
            throw new Error('No hay una liquidación activa para autorizar novedades');
        }
        const [novedadesR] = await pool.query(sqlNovedadesR, [novedadesE[0].Id, req.session.idUsuario]);
        return render(req, res, 'autorizarHoras', {novedadesE: novedadesE[0], novedadesR: novedadesR});
    } catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Atención', error.message, 'error');
        return res.redirect('/');
    }
});

// Endpoint JSON: cantidad de novedades pendientes de autorización para el supervisor logueado
router.get('/pendientes', logueado, async (req, res) => {
    try {
        const sqlNovedadesE = "SELECT Id FROM novedadesE WHERE Actual = 1";
        const [rowsE] = await pool.query(sqlNovedadesE);
        if (!rowsE.length) {
            return res.json({ cantidad: 0 });
        }
        const idNovedadesE = rowsE[0].Id;
        const sqlCuenta = `
            SELECT COUNT(*) AS cantidad
            FROM novedadesR
            WHERE IdNovedadesE = ? AND IdSupervisor = ? AND IdEstado = 1
        `;
        const [rowsC] = await pool.query(sqlCuenta, [idNovedadesE, req.session.idUsuario]);
        const cantidad = rowsC[0]?.cantidad || 0;
        return res.json({ cantidad });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ cantidad: 0, error: 'Error al obtener pendientes' });
    }
});
router.get('/OK/:Id', logueado, async (req, res) => {
    const {Id} = req.params;
    const sqlNovedad = "SELECT Id, IdEmpleado, IdNomina, DATE_FORMAT(Fecha, '%Y-%m-%d') AS Fecha, Inicio, Fin, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, IdEstado, ObservacionesEstado, Observaciones FROM novedadesR WHERE Id = ?";
    const sqlPersonalActual = 'SELECT Id, ApellidoYNombre FROM personal WHERE Id = ?';
    const sqlPersonal = 'SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre';
    const sqlMotivos = 'SELECT * FROM motivos';
    const sqlNomina = 'SELECT * FROM nomina WHERE Id = ?';

    try {
        const [novedad] = await pool.query(sqlNovedad, [Id]);
        if (novedad.length === 0) {
            throw new Error('No se encontró la novedad a editar');
        }
        const [personalActual] = await pool.query(sqlPersonalActual, [novedad[0].IdEmpleado]);
        if (personalActual.length === 0) {
            throw new Error('No se encontró el empleado de la novedad');
        }
        const Apenom = personalActual[0].ApellidoYNombre;

        const [personal] = await pool.query(sqlPersonal, [novedad[0].IdEmpleado]);
        const [motivos] = await pool.query(sqlMotivos);
        const [nomina] = await pool.query(sqlNomina, [novedad[0].IdNomina]);
        if (nomina.length === 0) {
            throw new Error('No se encontró la nómina aplicable a la novedad');
        }
    let detalleNomina = FormatearFecha(novedad[0].Fecha) + ' De ' + ExtraerHora(novedad[0].Inicio) + ' a ' + ExtraerHora(novedad[0].Fin) + ' - ' + 'Valor hora aplicado: ' + nomina[0].Descripcion;
        if (novedad[0].Hs50 !== null && novedad[0].Hs50 !=="00:00"){ detalleNomina += ' - Horas al 50%: ' + novedad[0].Hs50; }
        if (novedad[0].Hs100 !== null && novedad[0].Hs100 !== "00:00"){ detalleNomina += ' - Horas al 100%: ' + novedad[0].Hs100; }
        if (novedad[0].GuardiasDiurnas !== null && novedad[0].GuardiasDiurnas > 0){ detalleNomina += ' - Guardias diurnas: ' + novedad[0].GuardiasDiurnas; }
        if (novedad[0].GuardiasNocturnas !== null && novedad[0].GuardiasNocturnas > 0){ detalleNomina += ' - Guardias nocturnas: ' + novedad[0].GuardiasNocturnas; }

        return render(req, res, 'autorizarHorasOK', {novedad: novedad[0], personal: personal, detalleNomina: detalleNomina, Apenom: Apenom, motivos: motivos});
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Atención', error.message, 'error');
        return res.redirect('/autorizarHoras');
    }
});
//Rechazo de la novedad - carga del formulario
router.get('/NO/:Id', logueado, async (req, res) => {
    const {Id} = req.params;
    const sqlNovedad = "SELECT Id, IdEmpleado, IdNomina, DATE_FORMAT(Fecha, '%Y-%m-%d') AS Fecha, Inicio, Fin, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, IdEstado, ObservacionesEstado, Observaciones FROM novedadesR WHERE Id = ?";
    const sqlPersonalActual = 'SELECT Id, ApellidoYNombre FROM personal WHERE Id = ?';
    const sqlNomina = 'SELECT * FROM nomina WHERE Id = ?';

    try {
        const [novedad] = await pool.query(sqlNovedad, [Id]);
        if (novedad.length === 0) {
            throw new Error('No se encontró la novedad a editar');
        }
        const [personalActual] = await pool.query(sqlPersonalActual, [novedad[0].IdEmpleado]);
        if (personalActual.length === 0) {
            throw new Error('No se encontró el empleado de la novedad');
        }
        const Apenom = personalActual[0].ApellidoYNombre;

        const [nomina] = await pool.query(sqlNomina, [novedad[0].IdNomina]);
        if (nomina.length === 0) {
            throw new Error('No se encontró la nómina aplicable a la novedad');
        }
    let detalleNomina = FormatearFecha(novedad[0].Fecha) + ' De ' + ExtraerHora(novedad[0].Inicio) + ' a ' + ExtraerHora(novedad[0].Fin) + ' - ' + 'Valor hora aplicado: ' + nomina[0].Descripcion;
        if (novedad[0].Hs50 !== null && novedad[0].Hs50 !=="00:00"){ detalleNomina += ' - Horas al 50%: ' + novedad[0].Hs50; }
        if (novedad[0].Hs100 !== null && novedad[0].Hs100 !== "00:00"){ detalleNomina += ' - Horas al 100%: ' + novedad[0].Hs100; }
        if (novedad[0].GuardiasDiurnas !== null && novedad[0].GuardiasDiurnas > 0){ detalleNomina += ' - Guardias diurnas: ' + novedad[0].GuardiasDiurnas; }
        if (novedad[0].GuardiasNocturnas !== null && novedad[0].GuardiasNocturnas > 0){ detalleNomina += ' - Guardias nocturnas: ' + novedad[0].GuardiasNocturnas; }

        return render(req, res, 'autorizarHorasNO', {novedad: novedad[0], detalleNomina: detalleNomina, Apenom: Apenom,});
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Atención', error.message, 'error');
        return res.redirect('/autorizarHoras');
    }
});
// Ruta para rechazar la novedad
router.post('/NO/:Id', logueado, async (req, res) => {
    const {Id} = req.params;
    const { observaciones } = req.body;

    let textoObservaciones = "Rechazado por supervisor. Motivo del rechazo: " + observaciones;

    const sqlAutorizarNovedad = 'UPDATE novedadesR SET IdEstado = 2, ObservacionesEstado = ? WHERE Id = ?';

    try
    {
        await pool.query(sqlAutorizarNovedad, [textoObservaciones, Id]);
        enviarMensaje(req, res, 'Atención', 'Novedad rechazada', 'info');
        return res.redirect('/autorizarHoras');
    }
    catch (error)
    {
        console.log(error);
        enviarMensaje(req, res, 'Atención', error.message, 'error');
        return res.redirect('/autorizarHoras');
    }
});
// Ruta para autorizar la novedad
router.post('/OK/:Id', logueado, async (req, res) => {
    const {Id} = req.params;
    const { motivo, reemplazo, observaciones } = req.body;

    const sqlAutorizarNovedad = 'UPDATE novedadesR SET IdEstado = 3, IdMotivo = ?, IdReemplazo = ?, Observaciones = ? WHERE Id = ?';

    try
    {
        await pool.query(sqlAutorizarNovedad, [motivo, reemplazo, observaciones, Id]);
        enviarMensaje(req, res, 'Atención', 'Novedad autorizada correctamente', 'success');
        return res.redirect('/autorizarHoras');
    }
    catch (error)
    {
        console.log(error);
        enviarMensaje(req, res, 'Atención', error.message, 'error');
        return res.redirect('/autorizarHoras');
    }
});
router.get('/deshacer/:Id', logueado, async (req, res) => {
    const {Id} = req.params;
    // Bloquear si está liquidado
    const [rows] = await pool.query('SELECT IdEstado FROM novedadesR WHERE Id = ?', [Id]);
    if (rows.length && rows[0].IdEstado === 6) {
        enviarMensaje(req, res, 'Atención', 'No se puede deshacer una novedad liquidada.', 'warning');
        return res.redirect('/autorizarHoras');
    }
    const sqlNovedad = 'UPDATE novedadesR SET IdEstado = 1, IdMotivo = NULL, IdReemplazo = NULL, ObservacionesEstado = NULL WHERE Id = ?';

    try {
        await pool.query(sqlNovedad, [Id]);
        enviarMensaje(req, res, 'Atención', 'Novedad deshecha correctamente', 'success');
        return res.redirect('/autorizarHoras');
    } catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Atención', error.message, 'error');
        return res.redirect('/autorizarHoras');
    }
});

module.exports = router