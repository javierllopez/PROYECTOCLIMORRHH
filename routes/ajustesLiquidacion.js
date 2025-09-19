const router = require('express').Router();
const { pool } = require('../conexion');
const { logueado } = require('../Middleware/validarUsuario');
const { render } = require('../Middleware/render');
const nivelAceptado = [1]; // Nivel de usuario aceptado

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});
// Listado de ajustes
router.get('/', logueado,async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT a.Id, a.IdEmpleado, a.Descripcion, a.Monto, a.TimeStamp, p.ApellidoYNombre
                                     FROM ajustes a
                                     LEFT JOIN personal p ON p.Id = a.IdEmpleado
                                     ORDER BY p.ApellidoYNombre ASC, a.Id DESC`);
    return render(req, res, 'ajustesLiquidacion', { ajustes: rows });
  } catch (e) {
    console.error('Error listando ajustes:', e);
    return render(req, res, 'ajustesLiquidacion', { ajustes: [], Mensaje: { title: 'Error', text: 'No se pudieron cargar los ajustes.', icon: 'error' } });
  }
});

// Form alta
router.get('/nuevo', logueado, async (req, res) => {
  const [empleados] = await pool.query('SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre');
  return render(req, res, 'ajustesLiquidacionForm', { empleados, ajuste: {}, esNuevo: true });
});

// Form edición
router.get('/editar/:id', logueado, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/ajustesLiquidacion');
  const [[ajuste]] = await pool.query('SELECT * FROM ajustes WHERE Id = ?', [id]);
  if (!ajuste) return res.redirect('/ajustesLiquidacion');
  const [empleados] = await pool.query('SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre');
  return render(req, res, 'ajustesLiquidacionForm', { empleados, ajuste, esNuevo: false });
});

// Crear
router.post('/nuevo', logueado, async (req, res) => {
  let { IdEmpleado, Descripcion, Monto } = req.body;
  IdEmpleado = Number(IdEmpleado);
  const montoNum = Number(Monto);
  if (!IdEmpleado || !Descripcion || !Descripcion.trim() || !montoNum || montoNum === 0) {
    const [empleados] = await pool.query('SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre');
    return render(req, res, 'ajustesLiquidacionForm', { empleados, ajuste: req.body, esNuevo: true, Mensaje: { title: 'Atención', text: 'Completá empleado, descripción y un monto distinto de 0.', icon: 'warning' } });
  }
  try {
    await pool.query('INSERT INTO ajustes (IdEmpleado, Descripcion, Monto, IdUsuario, TimeStamp) VALUES (?,?,?,?, NOW())', [IdEmpleado, Descripcion.trim(), montoNum, req.session.IdUsuario || null]);
    return res.redirect('/ajustesLiquidacion');
  } catch (e) {
    console.error('Error creando ajuste:', e);
    const [empleados] = await pool.query('SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre');
    return render(req, res, 'ajustesLiquidacionForm', { empleados, ajuste: req.body, esNuevo: true, Mensaje: { title: 'Error', text: 'No se pudo guardar el ajuste.', icon: 'error' } });
  }
});

// Actualizar
router.post('/editar/:id', logueado, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/ajustesLiquidacion');
  let { IdEmpleado, Descripcion, Monto } = req.body;
  IdEmpleado = Number(IdEmpleado);
  const montoNum = Number(Monto);
  if (!IdEmpleado || !Descripcion || !Descripcion.trim() || !montoNum || montoNum === 0) {
    const [empleados] = await pool.query('SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre');
    return render(req, res, 'ajustesLiquidacionForm', { empleados, ajuste: { ...req.body, Id }, esNuevo: false, Mensaje: { title: 'Atención', text: 'Completá empleado, descripción y un monto distinto de 0.', icon: 'warning' } });
  }
  try {
    await pool.query('UPDATE ajustes SET IdEmpleado = ?, Descripcion = ?, Monto = ?, IdUsuario = ?, TimeStamp = NOW() WHERE Id = ?', [IdEmpleado, Descripcion.trim(), montoNum, req.session.IdUsuario || null, id]);
    return res.redirect('/ajustesLiquidacion');
  } catch (e) {
    console.error('Error actualizando ajuste:', e);
    const [empleados] = await pool.query('SELECT Id, ApellidoYNombre FROM personal ORDER BY ApellidoYNombre');
    return render(req, res, 'ajustesLiquidacionForm', { empleados, ajuste: { ...req.body, Id }, esNuevo: false, Mensaje: { title: 'Error', text: 'No se pudo actualizar el ajuste.', icon: 'error' } });
  }
});

// Eliminar
router.post('/eliminar/:id', logueado, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/ajustesLiquidacion');
  try {
    await pool.query('DELETE FROM ajustes WHERE Id = ?', [id]);
  } catch (e) {
    console.error('Error eliminando ajuste:', e);
  }
  return res.redirect('/ajustesLiquidacion');
});

module.exports = router;
