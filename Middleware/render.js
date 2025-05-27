module.exports = {
    render(req, res, pagina, parametros) {

        if (!req.session.Mensaje) {
            return res.render(pagina, {
                pantalla: req.device.type,
                usuario: req.session.usuario,
                nivelUsuario: req.session.nivelUsuario,
                ...parametros
            });
        }
        else {
            if (req.session.Mensaje.tipo == "Mensaje") {
                let title = req.session.Mensaje.title;
                let text = req.session.Mensaje.text;
                let icon = req.session.Mensaje.icon;
                delete req.session.Mensaje;
                return res.render(pagina, {
                    pantalla: req.device.type,
                    usuario: req.session.usuario,
                    nivelUsuario: req.session.nivelUsuario,
                    Mensaje: { title: title, text: text, icon: icon },
                    ...parametros
                });
            }
            if (req.session.Mensaje.tipo == "Confirmar") {
                let title = req.session.Mensaje.title;
                let text = req.session.Mensaje.text;
                let icon = req.session.Mensaje.icon;
                let Ok = req.session.Mensaje.Ok;
                let Cancel = req.session.Mensaje.Cancel;
                delete req.session.Mensaje;
                return res.render(pagina, {
                    pantalla: req.device.type,
                    usuario: req.session.usuario,
                    nivelUsuario: req.session.nivelUsuario,
                    Confirmar: { title: title, text: text, icon: icon, Ok: Ok, Cancel: Cancel },
                    ...parametros
                });
            }
        }

    },
    enviarMensaje: function (req, res, title, text, icon) {
        req.session.Mensaje = { title: title, text: text, icon: icon, tipo: "Mensaje" };
    },
    confirmar: function (req, res, texto, redirectOk, redirectCancel) {
        req.session.Mensaje = { title: 'Confirmar', text: texto, icon: "question", Ok: redirectOk, Cancel: redirectCancel, tipo: "Confirmar" };
    },
}