const express = require('express');
const {Tabla} = require('../Clases/Tabla');
const {pool} = require('../conexion');
const {cBool} = require('../lib/libreria');
const {render, enviarMensaje} = require('../Middleware/render');
const {logueado} = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1]; // Nivel de usuario aceptado


const motivos = new Tabla('motivos', true, false);
motivos.agregarCampo({campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%'});
motivos.agregarCampo({campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '80%'});

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.post('/filtrar', logueado, async (req, res) => {
    const { i, filtro } = req.body;
    if (!req.session.motivos) {
        req.session.motivos = {};
        req.session.motivos.estructura = motivos.exportarEstructura();
    } else {
        motivos.importarEstructura(req.session.motivos.estructura);
    };
    motivos.cambiarFiltro(i, filtro);
    motivos.paginaActual = 1;
    req.session.motivos.estructura.paginaActual = 1;
    res.redirect('/motivos')
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.motivos) {
        req.session.motivos = {};
        req.session.motivos.estructura = motivos.exportarEstructura();
    }else {
        motivos.importarEstructura(req.session.motivos.estructura);
    };
    motivos.cambiarOrden(campo);
    res.redirect('/motivos');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.motivos) {
        req.session.motivos = {};
        req.session.motivos.estructura = motivos.exportarEstructura();
    }else {
        motivos.importarEstructura(req.session.motivos.estructura);
    };
    console.log('página desde /paginar: ' + pagina);
    req.session.motivos.estructura.paginaActual = pagina;
    motivos.paginaActual = pagina;
    res.redirect('/motivos');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.motivos) {
        req.session.motivos = {};
        req.session.motivos.estructura = motivos.exportarEstructura();
    }else {
        motivos.importarEstructura(req.session.motivos.estructura);
    };
    motivos.getTotalRegistros();
    var sql = motivos.getSQL();
    var encabezadoHTML = motivos.getEncabezado();
    var paginador = await motivos.getPaginador();
    var funciones = motivos.getFunciones();
 
    try {
        const [tabla, fields] = await pool.query(sql);
        return render(req, res, 'motivos', { encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: motivos.borrable , permiteEditar: motivos.editable });
    }
    catch(err) {
        console.log(err);
    }

});

// Rutas para editar motivos

//Ruta para cargar página que agregará un nuevo motivo

router.get('/editar', logueado, async (req, res) => {

    return render(req, res, 'motivo');
});

// Ruta para cargar página que  editara el motivo seleccionado  
router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM motivos WHERE Id = ?';

    try {
        const [motivo] = await pool.query(sql, [Id]);
        return render(req, res, 'motivo', { motivo: motivo[0], Id: Id });

    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'danger');
        console.error(error);
    }
});

//Ruta para agregar un nuevo motivo

router.post('/editar', logueado, async (req, res) => {
    const {Descripcion, InformaReemplazo, DescripcionObligatoria, TieneSubmotivos}= req.body;
    const sql = "INSERT INTO motivos (Descripcion, InformaReemplazo, DescripcionObligatoria, TieneSubmotivos) VALUES (?, ?, ?, ?)";


    try {
        await pool.query(sql, [Descripcion, cBool(InformaReemplazo), cBool(DescripcionObligatoria), cBool(TieneSubmotivos)]);
        enviarMensaje(req, res, 'Motivos', 'Motivo agregado con éxito', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'danger');
        console.error(error);
    }

    return res.redirect('/motivos');
});

//Ruta para editar un motivo
router.post('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const {Descripcion, InformaReemplazo, DescripcionObligatoria, TieneSubmotivos }= req.body;
    const sql = "UPDATE motivos SET Descripcion = ?, InformaReemplazo = ?, DescripcionObligatoria = ?, TieneSubmotivos = ? WHERE Id = ?";

    try {
        await pool.query(sql, [Descripcion, cBool(InformaReemplazo), cBool(DescripcionObligatoria), cBool(TieneSubmotivos), Id]);
        enviarMensaje(req, res, 'Motivos', 'Motivo editado con éxito', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'danger');
        console.error(error);
    }

    return res.redirect('/motivos');
});

module.exports = router;