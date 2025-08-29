const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { noLogueado } = require('../Middleware/validarUsuario');

// GET: muestra formulario para ingresar nueva contraseña si el token es válido
router.get('/reset/:token', noLogueado, async (req, res) => {
	const { token } = req.params;
	try {
		const [rows] = await pool.query(
			'SELECT id, usuario_id FROM reseteo_password WHERE token = ? AND usado = 0 AND vence > NOW() LIMIT 1',
			[token]
		);
		if (!rows || rows.length === 0) {
			return render(req, res, 'resetPasswordInvalido');
		}
		return render(req, res, 'resetPassword', { token });
	} catch (err) {
		console.error(err);
		return render(req, res, 'resetPasswordInvalido');
	}
});

// POST: actualiza la clave y redirige al login
router.post('/reset/:token', noLogueado, async (req, res) => {
	const { token } = req.params;
	const { newPassword, confirmPassword } = req.body;
	if (!newPassword || !confirmPassword) {
		return render(req, res, 'resetPassword', { token, Mensaje: { title: 'Atención', text: 'Completá ambos campos.', icon: 'warning' } });
	}
	if (newPassword !== confirmPassword) {
		return render(req, res, 'resetPassword', { token, Mensaje: { title: 'Atención', text: 'Las contraseñas no coinciden.', icon: 'error' } });
	}

	try {
		const [rows] = await pool.query(
			'SELECT id, usuario_id FROM reseteo_password WHERE token = ? AND usado = 0 AND vence > NOW() LIMIT 1',
			[token]
		);
		if (!rows || rows.length === 0) {
			return render(req, res, 'resetPasswordInvalido');
		}

		const registro = rows[0];
		const hashed = await bcrypt.hash(newPassword, 10);

		const conn = await pool.getConnection();
		try {
			await conn.beginTransaction();
			await conn.query('UPDATE usuarios SET Clave = ?, primerAcceso = 0 WHERE Id = ?', [hashed, registro.usuario_id]);
			await conn.query('UPDATE reseteo_password SET usado = 1, usado_en = NOW() WHERE id = ?', [registro.id]);
			await conn.commit();
		} catch (txErr) {
			await conn.rollback();
			throw txErr;
		} finally {
			conn.release();
		}

		// Mensaje informativo y redirección al login
		enviarMensaje(req, res, 'Listo', 'Tu contraseña fue actualizada. Iniciá sesión con tu nueva clave.', 'success');
		return res.redirect('/login');
	} catch (err) {
		console.error(err);
		return render(req, res, 'resetPasswordInvalido');
	}
});

module.exports = router;
