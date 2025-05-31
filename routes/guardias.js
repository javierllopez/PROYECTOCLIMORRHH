const express = require('express');
const {Tabla} = require('../Clases/Tabla');
const {pool} = require('../conexion');
const {render, enviarMensaje} = require('../Middleware/render');
const {logueado} = require('../Middleware/validarUsuario');
const {FechaASqlFecha} = require('../lib/libreria');
const router = express.Router();
const nivelAceptado = [1] //Esta ruta sólo permite usuarios nivel 1 (Administrador)

const guardias = new Tabla('guardias', true, false);
guardias.agregarCampo({campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%'});
guardias.agregarCampo({campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '60%'});
guardias.agregarCampo({campo: 'Inicio', titulo: 'Inicio', tipoDato: 'fecha', ancho: '10%', visible_sm: false});
guardias.agregarCampo({campo: 'Fin', titulo: 'Fin', tipoDato: 'fecha', ancho: '10%', visible_sm: false});
guardias.agregarCampo({campo: 'Tipo', titulo: 'Tipo', tipoDato: 'texto', ancho: '10%', visible_sm: false});
//guardias.agregarCampo({campo: 'Cantidad', titulo: 'Cantidad', tipoDato: 'numero', ancho: '10%', visible_sm: false});

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});
router.post('/filtrar', logueado, async (req, res) => {

    const { i, filtro } = req.body;
    if (!req.session.guardias) {
        req.session.guardias = {};
        req.session.guardias.estructura = guardias.exportarEstructura();
    } else {
        guardias.importarEstructura(req.session.guardias.estructura);
    };
    guardias.cambiarFiltro(i, filtro);
    guardias.paginaActual = 1;
    req.session.guardias.estructura.paginaActual = 1;
    res.redirect('/guardias')
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.guardias) {
        req.session.guardias = {};
        req.session.guardias.estructura = guardias.exportarEstructura();
    }else {
        guardias.importarEstructura(req.session.guardias.estructura);
    };
    guardias.cambiarOrden(campo);
    res.redirect('/guardias');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.guardias) {
        req.session.guardias = {};
        req.session.guardias.estructura = guardias.exportarEstructura();
    }else {
        guardias.importarEstructura(req.session.guardias.estructura);
    };
    req.session.guardias.estructura.paginaActual = pagina;
    guardias.paginaActual = pagina;
    res.redirect('/guardias');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.guardias) {
        req.session.guardias = {};
        req.session.guardias.estructura = guardias.exportarEstructura();
    }else {
        guardias.importarEstructura(req.session.guardias.estructura);
    };
    guardias.getTotalRegistros();
    var sql = guardias.getSQL();
    var encabezadoHTML = guardias.getEncabezado();
    var paginador = await guardias.getPaginador();
    var funciones = guardias.getFunciones();
 
    try {
        const [tabla] = await pool.query(sql);
        return render(req,res,'guardias', {encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: guardias.borrable , permiteEditar: guardias.editable});
    }
    catch(err) {
        console.log(err);
    }

});
// Rutas para agregar y editar categorías

//Ruta para cargar página que agregará una nueva categoría
router.get('/editar', logueado, async (req, res) => {
    const sqlNomina = 'SELECT * FROM nomina WHERE HaceGuardiasDiurnas = 1';  
    try {
        const [nomina] = await pool.query(sqlNomina);
        return render(req,res,'guardia', {nomina: nomina});
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

});

// Ruta para cargar página que  editara la categoría seleccionada   
router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM guardias WHERE Id = ?';
    const sqlNomina = 'SELECT * FROM nomina WHERE HaceGuardiasDiurnas = 1';
    try {
        const [nomina] = await pool.query(sqlNomina);
        const [guardia] = await pool.query(sql, [Id]);
        return render(req,res,'guardia', { guardia: guardia[0], nomina: nomina, Id: Id});
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);

        return res.redirect('/guardias');
    }

});

//Ruta para agregar una nueva categoría
router.post('/editar', logueado, async (req, res) => {
    const {Descripcion, Tipo, Cantidad, Inicio, Fin, Nomina}= req.body;
    const Desde = new Date(`1970-01-01T${Inicio}:00`);
    //Si la hora de fin es menor que la de inicio, se entiende que la guardia termina al día siguiente
    let Hasta;
    if (parseInt(Fin.slice(0,2)) < parseInt(Inicio.slice(0,2))) {
        Hasta = new Date(`1970-01-02T${Fin}:00`);
    } else {
        Hasta = new Date(`1970-01-01T${Fin}:00`);
    }

    const miNomina = parseInt(Nomina);
    const sql = "INSERT INTO guardias (Descripcion, Tipo, Cantidad, Inicio, Fin, IdNomina) VALUES (?, ?, ?, ?, ?, ?)";

    try {
        const [result] = await pool.query(sql, [Descripcion, Tipo, Cantidad, FechaASqlFecha(Desde), FechaASqlFecha(Hasta), miNomina]);

        enviarMensaje(req, res, 'guardia agregada', 'La guardia se ha agregado correctamente', 'success');


    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }
    return res.redirect('/guardias');
});

//Ruta para editar una categoría
router.post('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const {Descripcion, Tipo, Cantidad, Inicio, Fin, Nomina}= req.body;
    const Desde = new Date(`1970-01-01T${Inicio}:00`);
    let Hasta;

    //Si la hora de fin es menor que la de inicio, se entiende que la guardia termina al día siguiente
    if (parseInt(Fin.slice(0,2)) < parseInt(Inicio.slice(0,2))) {
        Hasta = new Date(`1970-01-02T${Fin}:00`);
    } else {
        Hasta = new Date(`1970-01-01T${Fin}:00`);
    }    
    const miNomina = parseInt(Nomina);
    const sql = "UPDATE guardias SET Descripcion = ?, Tipo = ?, Cantidad = ?, Inicio = ?, Fin = ?, IdNomina = ? WHERE Id = ?";
    try {
        await pool.query(sql, [Descripcion, Tipo, Cantidad, FechaASqlFecha(Desde), FechaASqlFecha(Hasta), miNomina, Id]);
    
        enviarMensaje(req, res, 'Guardias', 'La Guardia se ha editado correctamente', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

    return res.redirect('/guardias');
});


module.exports = router;