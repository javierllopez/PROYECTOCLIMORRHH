const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {

    try {
        req.session.usuario = undefined;
        req.session.nivelUsuario = undefined;
        req.session.idUsuario = undefined;
        req.session.delegacionActiva = undefined;
        return res.redirect('/login');
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error al cerrar sesión');
    }
});


module.exports = router;