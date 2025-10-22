const express = require('express');
const {Tabla} = require('../Clases/Tabla');
const {pool} = require('../conexion');
const {logueado} = require('../Middleware/validarUsuario');
const {render, enviarMensaje} = require('../Middleware/render');
const { cBool, cInt} = require('../lib/libreria');
const router = express.Router();
const nivelAceptado = [1]; // Niveles de usuario permitidos para acceder a la ruta


const nomina = new Tabla('nomina', true, false, 'itemsNomina');
nomina.agregarCampo({ campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%' });
nomina.agregarCampo({ campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '30%' });
nomina.agregarCampo({ campo: 'InformaValorSueldoBasico', titulo: 'Básico?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'HaceGuardiasDiurnas', titulo: 'G.D.?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'HaceGuardiasNocturnas', titulo: 'G.N?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'HaceGuardiasPasivas', titulo: 'G.P.?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'TieneAdicionalMensual', titulo: 'A.?', tipoDato: 'booleano', ancho: '10%' });

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.post('/filtrar', logueado, async (req, res) => {
    const { i, filtro } = req.body;
    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    } else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    nomina.cambiarFiltro(i, filtro);
    nomina.paginaActual = 1;
    req.session.nomina.estructura.paginaActual = 1;
    res.redirect('/itemsNomina')
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    }else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    nomina.cambiarOrden(campo);
    res.redirect('/itemsNomina');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    }else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    req.session.nomina.estructura.paginaActual = pagina;
    nomina.paginaActual = pagina;
    res.redirect('/itemsNomina');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    }else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    nomina.getTotalRegistros();
    var sql = nomina.getSQL();
    var encabezadoHTML = nomina.getEncabezadoCSP();
    var paginador = await nomina.getPaginadorCSP();
    var funciones = "";
 
    try {
        const [tabla, fields] = await pool.query(sql);
    return render(req, res, 'itemsNomina', { encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: nomina.borrable , permiteEditar: nomina.editable });
    }
    catch(err) {
        enviarMensaje(req,res, 'Items de nómina', err.message, 'danger');
        console.log(err);
    }

});

// Rutas para editar nomina

//Ruta para cargar página que agregará un nuevo motivo

router.get('/editar', logueado, async (req, res) => {

    return render(req, res, 'itemNomina');
});

// Ruta para cargar página que  editara el motivo seleccionado  
router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM nomina WHERE Id = ?';

    try {
        [registro] = await pool.query(sql, [Id]);
        return render(req, res, 'itemNomina', { nomina: registro[0], Id: Id });

    } catch (error) {
        // Handle the error here
        enviarMensaje(req,res, 'Items de nómina', error.message, 'danger');
        console.error(error);
    }
});

//Ruta para agregar un nuevo motivo

router.post('/editar', logueado, async (req, res) => {
    const { Descripcion,
        InformaValorSueldoBasico,
        HorasMensuales,
        HaceGuardiasDiurnas,
        HorasGuardiaDiurna,
        HaceGuardiasNocturnas,
        HorasGuardiaNocturna,
        HaceGuardiasPasivas,
        TieneAdicionalMensual,
        TextoAdicional
    } = req.body;
    var sql = "INSERT INTO nomina (Descripcion, InformaValorSueldoBasico, HorasMensuales, "
    sql += "HaceGuardiasDiurnas, HorasGuardiaDiurna, HaceGuardiasNocturnas,HorasGuardiaNocturna, "
    sql += "HaceGuardiasPasivas, TieneAdicionalMensual,TextoAdicional) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";


    try {
        await pool.query(sql, [Descripcion, cBool(InformaValorSueldoBasico), cInt(HorasMensuales), cBool(HaceGuardiasDiurnas), cInt(HorasGuardiaDiurna), cBool(HaceGuardiasNocturnas), cInt(HorasGuardiaNocturna), cBool(HaceGuardiasPasivas), cBool(TieneAdicionalMensual), TextoAdicional]);
        enviarMensaje(req,res, 'Items de nómina', 'Registro agregado correctamente', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req,res, 'Items de nómina', error.message, 'danger');
        console.error(error);
    }

    return res.redirect('/itemsNomina');
});

//Ruta para editar un motivo
router.post('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const { Descripcion,
        InformaValorSueldoBasico,
        HorasMensuales,
        HaceGuardiasDiurnas,
        HorasGuardiaDiurna,
        HaceGuardiasNocturnas,
        HorasGuardiaNocturna,
        HaceGuardiasPasivas,
        TieneAdicionalMensual,
        TextoAdicional } = req.body;
    var sql = "UPDATE nomina SET Descripcion = ?, InformaValorSueldoBasico = ?, "
    sql += "HorasMensuales = ?, HaceGuardiasDiurnas = ?, HorasGuardiaDiurna = ?, "
    sql += "HaceGuardiasNocturnas = ?, HorasGuardiaNocturna = ?, HaceGuardiasPasivas = ?, "
    sql += "TieneAdicionalMensual = ?, TextoAdicional = ? WHERE Id = ?";

    try {
        await pool.query(sql, [Descripcion, cBool(InformaValorSueldoBasico),
            cInt(HorasMensuales),
            cBool(HaceGuardiasDiurnas),
            cInt(HorasGuardiaDiurna),
            cBool(HaceGuardiasNocturnas),
            cInt(HorasGuardiaNocturna),
            cBool(HaceGuardiasPasivas),
            cBool(TieneAdicionalMensual),
            TextoAdicional,
            Id]);
        enviarMensaje(req,res, 'Items de nómina', 'Registro modificado correctamente', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req,res, 'Items de nómina', error.message, 'danger');
        console.error(error);
    }

    return res.redirect('/itemsNomina');
});

module.exports = router;