const router = require('express').Router();
const { noLogueado } = require('../Middleware/validarUsuario');
const { render, enviarMensaje } = require('../Middleware/render');
const { pool } = require('../conexion');
const crypto = require('crypto');
const { enviarCorreo, getBaseUrl } = require('../lib/mailer');

// GET: muestra formulario para ingresar email
router.get('/', noLogueado, (req, res) => {
  return render(req, res, 'blanquearClave');
});

// POST: valida que el mail pertenezca a un usuario y envía link de recuperación
router.post('/', noLogueado, async (req, res) => {
  const { correo } = req.body;
  if (!correo) {
    return render(req, res, 'blanquearClave', { Mensaje: { title: 'Atención', text: 'Ingresá un correo válido.', icon: 'warning' } });
  }
  try {
    const [rows] = await pool.query('SELECT Id, Usuario, CorreoElectronico, Activo FROM usuarios WHERE CorreoElectronico = ? LIMIT 1', [correo]);
    // Mensaje neutro para no revelar si existe o no
    const mensajeGenerico = () => {
      enviarMensaje(req, res, 'Listo', 'Si el correo existe, te enviamos un link para recuperar tu contraseña.', 'info');
      return res.redirect('/blanquearClave');
    };

    if (!rows || rows.length === 0) {
      return render(req, res, 'blanquearClave', { Mensaje: { title: 'Atención', text: 'El correo ingresado no pertenece a ningún usuario.', icon: 'warning' } });
    }

    const user = rows[0];

    // Si el usuario existe pero está inactivo, informar explícitamente
    if (!user.Activo) {
      return render(req, res, 'blanquearClave', { Mensaje: { title: 'Atención', text: 'El correo ingresado pertenece a un usuario inactivo. Contactá al administrador.', icon: 'warning' } });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const ahora = new Date();
    const vence = new Date(ahora.getTime() + 30 * 60 * 1000); // 30 minutos

    // Garantizar existencia de tabla de tokens (se recomienda crearla por SQL script)
    await pool.query('CREATE TABLE IF NOT EXISTS reseteo_password (id INT NOT NULL AUTO_INCREMENT, usuario_id INT NOT NULL, token VARCHAR(128) NOT NULL, vence DATETIME NOT NULL, usado TINYINT(1) NOT NULL DEFAULT 0, usado_en DATETIME NULL, PRIMARY KEY (id), INDEX idx_token (token)) ENGINE=InnoDB DEFAULT CHARSET=latin1');

    // Opcional: invalidar tokens previos del usuario
    await pool.query('UPDATE reseteo_password SET usado = 1, usado_en = UTC_TIMESTAMP() WHERE usuario_id = ? AND usado = 0', [user.Id]);

    await pool.query('INSERT INTO reseteo_password (usuario_id, token, vence, usado) VALUES (?, ?, ?, 0)', [user.Id, token, vence]);

    const link = `${getBaseUrl()}/password/reset/${token}`;

    await enviarCorreo({
      to: user.CorreoElectronico,
      subject: 'Recuperación de contraseña',
      text: `Hola ${user.Usuario},\n\nUsá este enlace para recuperar tu contraseña (vence en 30 minutos):\n${link}\n\nSi no lo solicitaste, ignorá este correo.`,
      html: `<p>Hola <strong>${user.Usuario}</strong>,</p><p>Usá este enlace para recuperar tu contraseña (vence en 30 minutos):</p><p><a href="${link}">${link}</a></p><p>Si no lo solicitaste, ignorá este correo.</p>`
    });

    return mensajeGenerico();
  } catch (err) {
    console.error(err);
    return render(req, res, 'blanquearClave', { Mensaje: { title: 'Error', text: 'No pudimos procesar tu solicitud.', icon: 'error' } });
  }
});

module.exports = router;
