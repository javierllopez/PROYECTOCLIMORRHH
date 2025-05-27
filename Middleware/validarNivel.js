module.exports = {
    validarNivel(req,res,nivelRequerido) {
        if (req.session.nivelUsuario <= nivelRequerido) {
            return next(); // Si está logueado, continua con la siguiente función           
        } else {
            return res.redirect('/');
        }
    }
}