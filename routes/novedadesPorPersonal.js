const express = require('express');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { logueado } = require('../Middleware/validarUsuario');
const { TotalHoras50, TotalHoras100, FechaASqlFecha, FechaHTMLaFecha, FechaSqlAFecha, ExtraerHora, FechaYHora } = require('../lib/libreria');
const router = express.Router();
const nivelAceptado = [1, 2, 3] //Esta ruta sólo permite usuarios nivel 1 (Administrador)

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

// Ruta para mostrar novedades por empleado usando query string (GET /novedadesPorPersonal?IdPersonal=xx)
router.get('/', async (req, res) => {
    const { IdPersonal } = req.query;
    if (!IdPersonal) {
        // Si no hay parámetro, mostrar el selector
        const sqlPersonal = `SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre`;
        try {
            const [personal] = await pool.query(sqlPersonal);
            return render(req, res, 'novedadesPorPersonalSeleccionar', { personal });
        } catch (error) {
            console.error(error);
            enviarMensaje(req, res, 'Error al cargar el personal', 'danger');
        }
    } else {
        // Si hay parámetro, mostrar las novedades del empleado seleccionado
        const sqlPersonal = `SELECT personal.Id, personal.ApellidoYNombre as ApellidoYNombre, personal.IdSector, sectores.Descripcion as Sector,
            personal.IdCategoria, categorias.Descripcion as Categoria, personal.IdTurno, turnos.Descripcion as Turno
            FROM personal INNER JOIN sectores ON personal.IdSector = sectores.Id
            INNER JOIN categorias ON personal.IdCategoria = categorias.Id
            INNER JOIN turnos ON personal.IdTurno = turnos.Id
            WHERE personal.Id = ?`;

        const sqlNovedadesE = 'SELECT * FROM novedadese WHERE actual = 1';

        const sqlNovedadesR = `
            SELECT novedadesr.Id as IdNovedadesR,
            novedadesr.Fecha as Fecha,
            novedadesr.IdEmpleado as IdEmpleado,
            personal.Id as IdPersonal,
            personal.ApellidoYNombre as ApellidoYNombre,
            novedadesr.IdSector as IdSector,
            sectores.Descripcion as Sector,
            novedadesr.Hs50 as Hs50,
            novedadesr.Hs100 as Hs100,
            novedadesr.GuardiasDiurnas as GuardiasDiurnas,
            novedadesr.GuardiasNocturnas as GuardiasNocturnas,
            novedadesr.GuardiasPasivas as GuardiasPasivas,
            novedadesr.Monto as Monto,
            novedadesr.IdNomina as IdNominaNovedadesR,
            nomina.Id as IdNomina,
            nomina.Descripcion as DescripcionNomina,
            novedadesr.IdEstado as IdEstado,
            novedadesr.ObservacionesEstado as ObservacionesEstado,
            novedadesr.MinutosAl50 as MinutosAl50,
            novedadesr.MinutosAl100 as MinutosAl100,
            novedadesr.MinutosGD as MinutosGD,
            novedadesr.MinutosGN as MinutosGN,
            novedadesr.Inicio as Inicio,
            novedadesr.Fin as Fin,
            novedadesr.IdMotivo as IdMotivo,
            motivos.Descripcion as Motivo,
            novedadesr.IdReemplazo as IdReemplazo, 
            personal2.Id as IdReemplazo,
            personal2.ApellidoYNombre as Reemplazo,
            novedadesr.Observaciones as Observaciones,
            novedadesR.CreadoPorAdmin as CreadoPorAdmin
            FROM novedadesr
            INNER JOIN personal ON novedadesr.IdEmpleado = personal.Id
            INNER JOIN sectores ON novedadesr.IdSector = sectores.Id
            INNER JOIN nomina ON novedadesr.IdNomina = nomina.Id
            INNER JOIN motivos ON novedadesr.IdMotivo = motivos.Id
            LEFT JOIN personal AS personal2 ON novedadesr.IdReemplazo = personal2.Id
            WHERE novedadesr.IdNovedadesE = ? AND novedadesr.IdEmpleado = ? AND novedadesr.IdEstado > 2
            ORDER BY personal.ApellidoYNombre, novedadesr.Fecha ASC
        `;
        try {
            const [novedadesE] = await pool.query(sqlNovedadesE);

            if (novedadesE.length === 0) {
                throw new Error('No existe una liquidación actual con novedades');
            }
            const [personal] = await pool.query(sqlPersonal, [IdPersonal]);
            if (personal.length === 0) {
                throw new Error('El personal seleccionado no existe');
            }   

            const [novedadesR] = await pool.query(sqlNovedadesR, [novedadesE[0].Id, IdPersonal]);

            return render(req, res, 'novedadesPorPersonal', { personal: personal[0], novedades: novedadesR });
        } catch (error) {
            console.log(error);
            enviarMensaje(req, res, 'Error', error.message, 'error');
            return res.redirect('/');
        }
    }
});

router.get('/Seleccionar', async (req, res) => {
    const sqlPersonal = `SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre`;
    try {
        const [personal] = await pool.query(sqlPersonal);
        return render(req, res, 'novedadesPorPersonalSeleccionar', { personal });
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, 'Error al cargar el personal', 'danger');
    }
});

router.post('/OK', logueado, async (req, res) => {
    const { Id, IdPersonal } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 5 WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        console.log(`IdPersonal: ${IdPersonal}`);
        enviarMensaje(req, res, 'Novedad Aprobada', 'La novedad fue aprobada', 'success');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`); 
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
});
router.post('/deshacer', logueado, async (req, res) => {
    const { Id, IdPersonal } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 3 WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Deshecha', 'La novedad fue deshecha', 'success');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
});
router.post('/NO', logueado, async (req, res) => {
    const { Id, ObservacionesEstado, IdPersonal } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 4, ObservacionesEstado = ? WHERE Id = ?';
    try {
        await pool.query(sql, ['Rechazado por Recursos Humanos. Motivo: ' + ObservacionesEstado, Id]);
        enviarMensaje(req, res, 'Novedad Rechazada', 'La novedad fue rechazada', 'success');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
}
);
router.post('/Borrar', logueado, async (req, res) => {
    const { Id, IdPersonal } = req.body;
    const sql = 'DELETE FROM novedadesr WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Borrada', 'La novedad fue borrada', 'success');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorPersonal?IdPersonal=${IdPersonal}`);
    }
});
router.get('/Agregar', logueado, async (req, res) => {
    const { IdPersonal } = req.query;
    if (!IdPersonal) {
        enviarMensaje(req, res, 'Error', 'Debe seleccionar un empleado para agregar una novedad', 'error');
        return res.redirect('/novedadesPorPersonalSeleccionar');
    }
    const sqlSectores = 'SELECT * FROM sectores ORDER BY Descripcion ASC';
    const sqlNomina = 'SELECT * FROM nomina ORDER BY Descripcion ASC';
    const sqlMotivos = 'SELECT * FROM motivos ORDER BY Descripcion ASC';
    const sqlGuardias = 'SELECT * FROM guardias ORDER BY Descripcion ASC';
    try {
        const [sectores] = await pool.query(sqlSectores);
        const [nomina] = await pool.query(sqlNomina);
        const [motivos] = await pool.query(sqlMotivos);
        const [guardias] = await pool.query(sqlGuardias);
        return render(req, res, 'novedadesAgregar', { personal, sectores, nomina, motivos, guardias });
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas');
    }
});
module.exports = router;