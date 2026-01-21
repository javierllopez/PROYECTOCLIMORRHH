const express = require('express');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { logueado } = require('../Middleware/validarUsuario');
const { crearDelegacion } = require('../lib/delegaciones');
const router = express.Router();
const nivelesPermitidos = [2];

const obtenerFechaLocalIso = () => {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  const local = new Date(ahora.getTime() - offsetMs);
  return local.toISOString().slice(0, 10);
};

router.all('*', logueado, (req, res, next) => {
  if (nivelesPermitidos.includes(req.session.nivelUsuario)) {
    return next();
  }
  return res.redirect('/');
});

router.get('/', logueado, async (req, res) => {
  const sqlEmpleadosActivos = `
    SELECT p.Id,
           p.ApellidoYNombre,
           p.idUsuario AS IdUsuario,
           u.Nivel
    FROM personal p
    JOIN usuarios u ON u.Id = p.idUsuario
    WHERE p.FechaIngreso <= CURDATE()
      AND (p.FechaBaja IS NULL OR p.FechaBaja >= CURDATE())
      AND u.Activo = 1
    ORDER BY p.ApellidoYNombre
  `;

  try {
    const [empleados] = await pool.query(sqlEmpleadosActivos);
    const fechaDesde = obtenerFechaLocalIso();
    return render(req, res, 'delegar', {
      empleados: empleados.filter((empleado) => empleado.IdUsuario !== null && empleado.IdUsuario !== req.session.idUsuario),
      fechaDesde,
    });
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Atención', 'No se pudo preparar la delegación.', 'error');
    return res.redirect('/');
  }
});

router.post('/', logueado, async (req, res) => {
  const { empleado, desde, hasta } = req.body;
  if (!empleado) {
    enviarMensaje(req, res, 'Atención', 'Tenés que seleccionar un empleado válido.', 'warning');
    return res.redirect('/delegar');
  }
  if (!desde) {
    enviarMensaje(req, res, 'Atención', 'La fecha de inicio es obligatoria.', 'warning');
    return res.redirect('/delegar');
  }
  try {
    const supervisorId = req.session.idUsuario;
    const delegadoUsuarioId = Number(empleado);
    if (!Number.isInteger(delegadoUsuarioId)) {
      throw new Error('El identificador del usuario delegado no es válido.');
    }
    await crearDelegacion(pool, {
      supervisorId,
      delegadoUsuarioId,
      fechaDesde: desde,
      fechaHasta: hasta || null,
      ejecutadoPor: supervisorId,
      ipOrigen: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    enviarMensaje(req, res, 'Éxito', 'La delegación se registró correctamente.', 'success');
    return res.redirect('/delegar');
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Atención', error.message, 'error');
    return res.redirect('/delegar');
  }
});

module.exports = router;
