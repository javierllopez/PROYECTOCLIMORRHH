module.exports = {
    logueado(req, res, next) {
        if (req.session.usuario !== undefined) {
            return next(); // Si está logueado y tiene uno de los niveles de usuario permitidos, continua con la siguiente función           
        } else {
            return res.redirect('/login');
        }
    },
    noLogueado(req, res, next) {
        if (req.session.usuario == null) {
            return next(); // Si no esta logueado continua con la siguiente funcion
        } else {
            return res.redirect('/');
        }
    },
};
