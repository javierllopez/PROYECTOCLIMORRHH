const express = require('express');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { TotalHoras50, TotalHoras100, FechaASqlFecha, FechaHTMLaFecha, FechaSqlAFecha, ExtraerHora, FechaYHora } = require('../lib/libreria');
const { logueado } = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1, 2, 3];

router.all('*', logueado, (req, res, next) => {
  if (nivelAceptado.includes(req.session.nivelUsuario)) {
    return next();
  } else {
    return res.redirect('/');
  }
});

// Vista para seleccionar sector
router.get('/Seleccionar', async (req, res) => {
  try {
    const [sectores] = await pool.query('SELECT Id, Descripcion FROM sectores ORDER BY Descripcion');
    return render(req, res, 'novedadesPorSectorSeleccionar', { sectores });
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Error al cargar los sectores', 'danger');
  }
});

// Vista para mostrar novedades agrupadas por sector
router.get('/', async (req, res) => {
  const { IdSector } = req.query;
  if (!IdSector) {
    return res.redirect('/novedadesPorSector/Seleccionar');
  }
  try {
    const [sector] = await pool.query('SELECT * FROM sectores WHERE Id = ?', [IdSector]);
    if (sector.length === 0) {
      enviarMensaje(req, res, 'Error', 'El sector seleccionado no existe', 'error');
      return res.redirect('/novedadesPorSector/Seleccionar');
    }
    const [novedades] = await pool.query(`
      SELECT n.Id, n.Fecha, n.IdEmpleado, p.ApellidoYNombre, n.IdEstado, n.Hs50, n.Hs100, n.GuardiasDiurnas, n.GuardiasNocturnas, n.Monto, n.Inicio, n.Fin, n.ObservacionesEstado, n.MinutosAl50, n.MinutosAl100,n.MinutosGD, n.MinutosGN, n.IdMotivo, m.Descripcion as Motivo, n.Observaciones, p2.ApellidoYNombre as Reemplazo
      FROM novedadesr n
      INNER JOIN personal p ON n.IdEmpleado = p.Id
      INNER JOIN motivos m ON n.IdMotivo = m.Id
      LEFT JOIN personal p2 ON n.IdReemplazo = p2.Id
      WHERE n.IdSector = ? AND n.IdEstado > 2
      ORDER BY p.ApellidoYNombre, n.Fecha ASC
    `, [IdSector]);
    // Convertir fechas UTC a local para la vista
    const novedadesLocal = novedades.map(nov => ({
      ...nov,
      FechaLocal: nov.Fecha ? new Date(nov.Fecha + 'Z') : null,
      InicioLocal: nov.Inicio ? new Date(nov.Inicio + 'Z') : null,
      FinLocal: nov.Fin ? new Date(nov.Fin + 'Z') : null
    }));
    return render(req, res, 'novedadesPorSector', { sector: sector[0], novedades: novedadesLocal });
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Error al cargar las novedades', 'danger');
    return res.redirect('/novedadesPorSector/Seleccionar');
  }
});
router.post('/OK', logueado, async (req, res) => {
    const { Id, IdSector } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 5 WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Aprobada', 'La novedad fue aprobada', 'success');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`); 
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
});
router.post('/deshacer', logueado, async (req, res) => {
    const { Id, IdPersonal, IdSector } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 3 WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Deshecha', 'La novedad fue deshecha', 'success');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
});
router.post('/NO', logueado, async (req, res) => {
    const { Id, ObservacionesEstado, IdSector } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 4, ObservacionesEstado = ? WHERE Id = ?';
    try {
        await pool.query(sql, ['Rechazado por Recursos Humanos. Motivo: ' + ObservacionesEstado, Id]);
        enviarMensaje(req, res, 'Novedad Rechazada', 'La novedad fue rechazada', 'success');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
}
);
router.post('/Borrar', logueado, async (req, res) => {
    const { Id, IdSector } = req.body;
    const sql = 'DELETE FROM novedadesr WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Borrada', 'La novedad fue borrada', 'success');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
    }
});

module.exports = router;
