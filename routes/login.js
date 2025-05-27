const { logueado, noLogueado } = require('../Middleware/validarUsuario');
const { render } = require('../Middleware/render');
const router = require('express').Router();
const { pool } = require('../conexion'); // Assuming you are using a database connection pool
const bcrypt = require('bcrypt');

router.get('/', noLogueado, (req, res) => {
    return render(req, res, 'login');
});
router.post('/', noLogueado, async (req, res) => {
    const { usuario, password } = req.body;
    let intentos;
    try {
        const [user] = await pool.query('SELECT * FROM usuarios WHERE Usuario = ?', [usuario]);
        if (user.length === 0) {
            return render(req, res, 'login', { Mensaje: { title: 'Atención', text: 'Usuario o contraseña incorrectos', icon: 'error' } })
        }

        const usuarioData = user[0];
        const now = new Date();

        if (usuarioData.BloqueadoHasta && new Date(usuarioData.BloqueadoHasta) > now) {
            return render(req, res, 'login', { Mensaje: { title: 'Atención', text: 'Usuario bloqueado. Intente más tarde.', icon: 'error' } })
        }

        const passwordMatch = await bcrypt.compare(password, usuarioData.Clave);
        if (!passwordMatch) {
            intentos = parseInt(user[0].Intentos == null ? 0 : user[0].Intentos) + 1;
            await pool.query('UPDATE usuarios SET Intentos = ? WHERE Usuario = ?', [intentos, usuario]);
            if (usuarioData.Intentos > 5) {
                const desbloqueo = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
                await pool.query('UPDATE usuarios SET BloqueadoHasta = ? WHERE usuario = ?', [desbloqueo, usuario]);
            }
            return render(req, res, 'login', { Mensaje: { title: 'Atención', text: 'Usuario o contraseña incorrectos', icon: 'error' } })
        }

        if (!usuarioData.Activo) {
            return render(req, res, 'login', { Mensaje: { title: 'Atención', text: 'Usuario inactivo', icon: 'error' } })
        }

        await pool.query('UPDATE usuarios SET Intentos = 0, BloqueadoHasta = NULL WHERE usuario = ?', [usuario]);
        req.session.idUsuario = user[0].Id; // Store user id in session
        req.session.usuario = usuarioData.Usuario; // Store username in session
        req.session.nivelUsuario = usuarioData.Nivel; // Store user level in session

        if (usuarioData.primerAcceso) {
            return render(req,res,'cambiarClave', {Id: user[0].Id, CorreoElectronico: user[0].CorreoElectronico, primeraVez: true})  // Si es el primer acceso, redirigir a cambiar clave
        } else {
            return res.redirect('/'); // Redirect to a dashboard or home page after successful login
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error en el servidor');
    }
});

router.get('/cambiarClave', logueado, (req, res) => {
    return render(req, res, 'cambiarClave');
});

router.post('/cambiarClave', logueado, async (req, res) => {
    const { Id, nuevoUsuario, correoElectronico, newPassword, confirmPassword } = req.body;
    const sqlUsuarioExistente = 'SELECT * FROM usuarios WHERE Usuario = ? AND Id != ?';
    if (newPassword !== confirmPassword) {
        return render(req, res, 'cambiarClave', { Mensaje: { title: 'Atención', text: 'Las contraseñas no coinciden', icon: 'error' } });
    }
    try {
        const [usuarioExistente] = await pool.query(sqlUsuarioExistente, [nuevoUsuario, Id]);
        if (usuarioExistente.length > 0) {
            return render(req, res, 'cambiarClave', { Mensaje: { title: 'Atención', text: 'El nombre de usuario ya existe', icon: 'error' } });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE usuarios SET Usuario = ?, Clave = ?, CorreoElectronico = ?, primerAcceso = 0 WHERE Id = ?', [nuevoUsuario, hashedPassword, correoElectronico, Id]);
        return res.redirect('/');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error en el servidor');
    }
});

module.exports = router;