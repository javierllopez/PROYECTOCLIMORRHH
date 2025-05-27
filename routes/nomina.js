const express = require('express');
const { Tabla } = require('../Clases/Tabla');
const { pool } = require('../conexion');
const { render } = require('../Middleware/render');
const { cBool, cInt, FechaSqlAFecha, FechaASqlFecha, FechaSqlAFechaCorta } = require('../lib/libreria');
const { logueado } = require('../Middleware/validarUsuario');
const router = express.Router();
const Swal = require('sweetalert2');
const nivelAceptado = [1]; //Nivel de usuario aceptado para esta ruta


//Tabla para manejar nómina
const nomina = new Tabla('nomina', true, false);
nomina.agregarCampo({ campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%' });
nomina.agregarCampo({ campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '30%' });
nomina.agregarCampo({ campo: 'InformaValorSueldoBasico', titulo: 'Básico?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'HaceGuardiasDiurnas', titulo: 'G.D.?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'HaceGuardiasNocturnas', titulo: 'G.N?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'HaceGuardiasPasivas', titulo: 'G.P.?', tipoDato: 'booleano', ancho: '10%' });
nomina.agregarCampo({ campo: 'TieneAdicionalMensual', titulo: 'A.?', tipoDato: 'booleano', ancho: '10%' });

//Tabla para manejar la tabla nominavalorese
//const nominavalorese = new Tabla('nominavalorese',true,false);
//nominavalorese.agregarCampo({campo: 'Id', titulo: 'Id', tipoDato: 'numero'});
//nominavalorese.agregarCampo({campo: 'VigenteDesde',titulo: 'VigenteDesde',tipoDato: 'fecha'});
//nominavalorese.agregarCampo({campo: 'VigenteHasta', titulo: 'VigenteHasta', tipoDato: 'fecha'})
//Tabla para manejar la tabla nominavaloresr
const nominavaloresr = new Tabla('nominavaloresr', true, false, 'nomina');
nominavaloresr.agregarCampo({ campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%' });
nominavaloresr.agregarCampo({ campo: 'IdNomina', titulo: 'IdNomina', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'IdNominaValoresE', titulo: 'IdNominaValoresE', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%', tabla: 'nomina', visible: false });
nominavaloresr.agregarCampo({ campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '25%', tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'VigenciaDesde', titulo: 'Desde', tipoDato: 'fecha', ancho: '11%', visible: false });
nominavaloresr.agregarCampo({ campo: 'VigenciaHasta', titulo: 'Hasta', tipoDato: 'fecha', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'ValorSueldoBasico', titulo: 'Básico', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'HorasMensuales', titulo: 'Horas Mensuales', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'ValorHoraSimple', titulo: 'Valor Hora Simple', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'ValorHora50', titulo: 'H.50%', tipoDato: 'numero', ancho: '10%' });
nominavaloresr.agregarCampo({ campo: 'ValorHora100', titulo: 'H.100%', tipoDato: 'numero', ancho: '11%' });
nominavaloresr.agregarCampo({ campo: 'ValorGuardiaDiurna', titulo: 'G.D.', tipoDato: 'numero', ancho: '10%' });
nominavaloresr.agregarCampo({ campo: 'ValorGuardiaNocturna', titulo: 'G.N.', tipoDato: 'numero', ancho: '10%' });
nominavaloresr.agregarCampo({ campo: 'ValorGuardiaPasiva', titulo: 'G.P.', tipoDato: 'numero', ancho: '10%' });
nominavaloresr.agregarCampo({ campo: 'InformaValorSueldoBasico', titulo: 'Informa Sueldo Básico', tipoDato: 'booleano', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'HorasMensuales', titulo: 'Horas Mensuales', tipoDato: 'numero', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'HaceGuardiasDiurnas', titulo: 'Hace Guardias Diurnas', tipoDato: 'booleano', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'HorasGuardiaDiurna', titulo: 'Horas Guardia Diurna', tipoDato: 'numero', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'HaceGuardiasNocturnas', titulo: 'Hace Guardias Nocturnas', tipoDato: 'booleano', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'HorasGuardiaNocturna', titulo: 'Horas Guardia Nocturna', tipoDato: 'numero', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'HaceGuardiasPasivas', titulo: 'Hace Guardias Pasivas', tipoDato: 'booleano', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'TieneAdicionalMensual', titulo: 'Tiene Adicional Mensual', tipoDato: 'booleano', ancho: '10%', visible: false, tabla: 'nomina' });
nominavaloresr.agregarCampo({ campo: 'TextoAdicional', titulo: 'Texto Adicional', tipoDato: 'texto', ancho: '10%', visible: false, tabla: 'nomina' });

nominavaloresr.agregarRelacion(1, 'nominavaloresr', 'IdNomina', 'nomina', 'Id');

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.post('/filtrar', logueado, async (req, res) => {
    const { i, filtro, tabla } = req.body;
    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    } else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    if (tabla == 'nomina') {
        nomina.cambiarFiltro(i, filtro);
        res.redirect('/nomina/1');
    } else {
        if (tabla == 'nominavalorese') {
            nominavaloresr.cambiarFiltro(i, filtro);
            res.redirect('/nomina/2')
        }
    }
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo, tabla } = req.body;
    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    } else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    if (tabla == 'nomina') {
        nomina.cambiarOrden(campo);
        res.redirect('/nomina/1');
    } else {
        if (tabla == 'nominavaloresr') {
            nominavaloresr.cambiarOrden(campo);
            res.redirect('/nomina/2');
        }
    }
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina, tabla } = req.body;
    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    } else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };

    if (tabla == 'nomina') {
        req.session.nomina.estructura.paginaActual = pagina;
        nomina.paginaActual = pagina;
        res.redirect('/nomina/1');
    } else {
        if (tabla == 'nominavaloresr') {
            req.session.nominavaloresr.paginaActual = pagina;
            nominavaloresr.paginaActual = pagina;
            res.redirect('/nomina/2');
        }
    }
});

//Esta ruta abre la nómina con la pestaña de items de nómina abierta por defecto

router.get('/1/:idNomina?', logueado, async (req, res) => {
    const tab = 1;             //1 para pestaña items, 2 para pestaña valores
    const idNomina = req.params.idNomina;   //parámetro para abrir la nómina con un id de nómina seleccionado

    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    } else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };

    nomina.getTotalRegistros();
    var sqlNomina = nomina.getSQL();
    var sqlNominaValorese = "SELECT * FROM nominavalorese ORDER BY VigenteDesde DESC"
    var encabezadoHTMLNomina = nomina.getEncabezado();
    var encabezadoHTMLNominaValoresr = nominavaloresr.getEncabezado();
    var paginadorNomina = await nomina.getPaginador();
    var paginadorNominaValoresr = await nominavaloresr.getPaginador();
    var funcionesNomina = nomina.getFunciones('/nomina/1');
    var funcionesNominaValoresr = nominavaloresr.getFunciones('/nomina/2');

    try {
        const [tablaNomina] = await pool.query(sqlNomina);
        const [tablaNominaValorese] = await pool.query(sqlNominaValorese);
        if (idNomina) {
            sqlNominaValoresr = nominavaloresr.getSQL('nominavaloresr.idNominaValoresE', idNomina);
        } else {
            sqlNominaValoresr = nominavaloresr.getSQL('nominavaloresr.idNominaValoresE', tablaNominaValorese[0].Id);
        }
        const [tablaNominaValoresr] = await pool.query(sqlNominaValoresr);

        return res.render('nomina', {
            encabezadoHTMLNomina: encabezadoHTMLNomina,
            tablaNomina: tablaNomina,
            paginadorNomina: paginadorNomina,
            funcionesNomina: funcionesNomina,
            permiteBorrarNomina: nomina.borrable,
            permiteEditarNomina: nomina.editable,
            encabezadoHTMLNominaValoresr: encabezadoHTMLNominaValoresr,
            tablaNominaValoresr: tablaNominaValoresr,
            paginadorNominaValoresr: paginadorNominaValoresr,
            funcionesNominaValoresr: funcionesNominaValoresr,
            permiteBorrarNominaValoresr: nominavaloresr.borrable,
            permiteEditarNominaValoresr: nominavaloresr.editable,
            tablaNominaValorese: tablaNominaValorese,
            tab: tab,
            idNomina: idNomina
        });
    }
    catch (err) {
        console.log(err);
    }

});

//Rutas para activar la pestaña de valores de nómina
router.get('/2/:idNomina?', logueado, async (req, res) => {
    const tab = 2;             //1 para pestaña items, 2 para pestaña valores
    const idNomina = req.params.idNomina;   //parámetro para abrir la nómina con un id de nómina seleccionado

    if (!req.session.nomina) {
        req.session.nomina = {};
        req.session.nomina.estructura = nomina.exportarEstructura();
    } else {
        nomina.importarEstructura(req.session.nomina.estructura);
    };
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    nomina.getTotalRegistros();
    var sqlNomina = nomina.getSQL();
    var sqlNominaValoresr
    var sqlNominaValorese = "SELECT * FROM nominavalorese ORDER BY VigenteDesde DESC"
    var encabezadoHTMLNomina = nomina.getEncabezado();
    var encabezadoHTMLNominaValoresr = nominavaloresr.getEncabezado();
    var paginadorNomina = await nomina.getPaginador();
    var paginadorNominaValoresr = await nominavaloresr.getPaginador();
    var funcionesNomina = nomina.getFunciones('/nomina/1');
    var funcionesNominaValoresr = nominavaloresr.getFunciones('/nomina/2');

    try {
        const [tablaNomina] = await pool.query(sqlNomina);
        const [tablaNominaValorese] = await pool.query(sqlNominaValorese);
        if (idNomina) {
            sqlNominaValoresr = nominavaloresr.getSQL('nominavaloresr.idNominaValoresE', idNomina);
        } else {
            sqlNominaValoresr = nominavaloresr.getSQL('nominavaloresr.idNominaValoresE', tablaNominaValorese[0].Id);
        }
        const [tablaNominaValoresr] = await pool.query(sqlNominaValoresr);
        console.log(tablaNominaValoresr);
        return res.render('nomina', {
            encabezadoHTMLNomina: encabezadoHTMLNomina,
            tablaNomina: tablaNomina,
            paginadorNomina: paginadorNomina,
            funcionesNomina: funcionesNomina,
            permiteBorrarNomina: nomina.borrable,
            permiteEditarNomina: nomina.editable,
            encabezadoHTMLNominaValoresr: encabezadoHTMLNominaValoresr,
            tablaNominaValoresr: tablaNominaValoresr,
            paginadorNominaValoresr: paginadorNominaValoresr,
            funcionesNominaValoresr: funcionesNominaValoresr,
            permiteBorrarNominaValoresr: nominavaloresr.borrable,
            permiteEditarNominaValoresr: nominavaloresr.editable,
            tablaNominaValorese: tablaNominaValorese,
            tab: tab,
            idNomina: idNomina
        });
    }
    catch (err) {
        console.log(err);
    }

});

//Rutas para editar la tabla nómina

//Ruta para cargar página que agregará un nuevo ítem de nómina

router.get('/editar', logueado, async (req, res) => {
    return res.render('nominaIndividual');
});

// Ruta para cargar página que  editara el item de nómina seleccionado

router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    var cadena = "";
    var sql = 'SELECT * FROM nomina WHERE Id = ?';

    try {
        [tablaNomina] = await pool.query(sql, [Id]);
        return res.render('nominaIndividual', { nomina: tablaNomina[0], Id: Id });
    } catch (error) {
        // Handle the error here
        console.error(error);
    }
});

//Ruta para agregar un nuevo ítem de nómina
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
    } catch (error) {
        // Handle the error here
        console.error(error);
    }

    return res.redirect('/nomina/1');
});

//Ruta para editar una catgoría
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
    } catch (error) {
        // Handle the error here
        console.error(error);
    }

    return res.redirect('/nomina/1');
});

//Genero una nueva nómina

router.get('/generarNomina', logueado, async (req, res) => {
    var cadena = ""
    const sql = "SELECT * FROM nominavalorese ORDER BY VigenteDesde DESC";

    try {
        const [nominavalorese] = await pool.query(sql);
        return render(req, res, 'generarNomina', { nominavalorese: nominavalorese });
    } catch (err) {
        console.log(err);
    }
});

//Ruta para generar la nómina nueva
router.post('/generarNomina', logueado, async (req, res) => {
    let { VigenteDesde,
        VigenteHasta,
        Aumento,
        IdNominaBase,
        opcionNomina
    } = req.body;


    VigenteDesde = FechaSqlAFecha(VigenteDesde);
    VigenteHasta = FechaSqlAFecha(VigenteHasta);
    Aumento = parseFloat(Aumento);
    IdNominaBase = parseInt(IdNominaBase);
    opcionNomina = parseInt(opcionNomina);

    // Si es una nómina nueva, genera una nueva nómina vacía

    if (opcionNomina == 2) {
        const cadenaNomina = "SELECT * FROM nomina";
        const cadenaNominaValoreseCompeta = "SELECT * FROM nominavalorese";


        //Valido que la nomina no se superponga con otras 

        try {
            const [nominaValoreseCompleta] = await pool.query(cadenaNominaValoreseCompeta);

            let i = 0;
            do {

                // Condición para salir del ciclo
                if ((VigenteDesde >= FechaSqlAFecha(nominaValoreseCompleta[i].VigenteDesde) && FechaSqlAFecha(VigenteDesde <= nominaValoreseCompleta[i].VigenteHasta)) || (VigenteHasta >= FechaSqlAFecha(nominaValoreseCompleta[i].VigenteDesde) && VigenteHasta <= FechaSqlAFecha(nominaValoreseCompleta[i].VigenteHasta))) {
                    throw new Error('Error en las fechas de vigencia');
                }

                i++;
            } while (i < nominaValoreseCompleta.length);

        } catch (error) {

            return res.render('generarNomina', { Mensaje: { title: 'Atención', text: 'Error en las fechas de vigencia', icon: 'error' }, Paquete: { VigenteDesde: FechaASqlFecha(VigenteDesde), VigenteHasta: FechaASqlFecha(VigenteHasta), Aumento: Aumento, IdNominaBase: IdNominaBase } });

        }

        let conn = await pool.getConnection();
        await conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await conn.execute('SET autocommit=0');


        try {
            console.log('Iniciando transacción');
            await conn.beginTransaction();
            const [nomina] = await conn.query(cadenaNomina);
            const sqlNominaValorese = "INSERT INTO nominavalorese (VigenteDesde, VigenteHasta) VALUES (?, ?)";
            const [rNominaValoresE] = await conn.query(sqlNominaValorese, [FechaASqlFecha(VigenteDesde), FechaASqlFecha(VigenteHasta)]);
            let idNominaValoresE = rNominaValoresE.insertId;
            let i = 0;
            do {
                let sqlNominaR = "";
                sqlNominaR = "INSERT INTO nominavaloresr (IdNomina, IdNominaValoresE, ValorSueldoBasico, HorasMensuales, ValorHoraSimple, ValorHora50, ValorHora100, ValorGuardiaDiurna, HsGuardiaDiurna, ValorHoraGuardiaDiurna, ValorGuardiaNocturna, HsGuardiaNocturna, ValorHoraGuardiaNocturna, ValorGuardiaPasiva, ValorAdicional, VigenciaDesde, VigenciaHasta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? )";
                await conn.query(sqlNominaR, [nomina[i].Id, idNominaValoresE, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, FechaASqlFecha(VigenteDesde), FechaASqlFecha(VigenteHasta)]);
                i += 1;
            } while (i < nomina.length);

            await conn.commit();
        } catch (err) {
            console.error('Error al generar la nómina', err);
            await conn.rollback();
            conn.release();
            return res.render('generarNomina', { Mensaje: { title: 'Atención', text: "Error generando valores de nómina", icon: 'error' }, Paquete: { VigenteDesde: FechaASqlFecha(VigenteDesde), VigenteHasta: FechaASqlFecha(VigenteHasta), Aumento: Aumento, IdNominaBase: IdNominaBase } });
        }

    } else {

    }


    return res.redirect('/nomina/2');

});

//Ruta para editar un item valorizado de nómina

router.get('/nominaValorizada/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM nominavaloresr WHERE Id = ?';
    const sql2 = 'SELECT * FROM nomina WHERE Id = ?';
    const sql3 = 'SELECT * FROM nominavalorese WHERE Id = ?';
    let Descripcion = "";
    let Vigencia = "";
    let bSueldoBasico = false
    let SueldoBasico = 0;
    let HsMensuales = 0;
    let bGuardiasDiurnas = false;
    let valorGuardiaDiurna = 0;
    let HsGuardiasDiurnas = 0;
    let bGuardiasNocturnas = false;
    let ValorGuardiaNocturna = 0
    let HsGuardiasNocturnas = 0;
    let bGuardiasPasivas = false;
    let ValorGuardiaPasiva = 0;
    let bAdicionalMensual = false;
    let ValorAdicional = 0;
    let TextoAdicional = "";
    let idNomina = 0;
    let idNominaValoresE = 0;



    try {
        [tablaNominaValoresr] = await pool.query(sql, [Id]);
        [tablaNomina] = await pool.query(sql2, [tablaNominaValoresr[0].IdNomina]);
        [tablaNominaValorese] = await pool.query(sql3, [tablaNominaValoresr[0].IdNominaValoresE]);

        idNomina = tablaNomina[0].Id;
        idNominaValoresE = tablaNominaValorese[0].Id;
        Descripcion = tablaNomina[0].Descripcion;
        Vigencia = 'Entre ' + FechaSqlAFechaCorta(tablaNominaValorese[0].VigenteDesde) + ' y ' + FechaSqlAFechaCorta(tablaNominaValorese[0].VigenteHasta);
        bSueldoBasico = tablaNomina[0].InformaValorSueldoBasico;
        SueldoBasico = tablaNominaValoresr[0].ValorSueldoBasico;
        HsMensuales = tablaNomina[0].HorasMensuales;
        bGuardiasDiurnas = tablaNomina[0].HaceGuardiasDiurnas;
        valorGuardiaDiurna = tablaNominaValoresr[0].ValorGuardiaDiurna;
        HsGuardiasDiurnas = tablaNomina[0].HorasGuardiaDiurna;
        bGuardiasNocturnas = tablaNomina[0].HaceGuardiasNocturnas;
        HsGuardiasNocturnas = tablaNomina[0].HorasGuardiaNocturna;
        ValorGuardiaNocturna = tablaNominaValoresr[0].ValorGuardiaNocturna;
        bGuardiasPasivas = tablaNomina[0].HaceGuardiasPasivas;
        ValorGuardiaPasiva = tablaNominaValoresr[0].ValorGuardiaPasiva;
        bAdicionalMensual = tablaNomina[0].TieneAdicionalMensual;
        ValorAdicional = tablaNominaValoresr[0].ValorAdicional;
        TextoAdicional = tablaNomina[0].TextoAdicional;

        return res.render('nominaValorizada', { Id, idNomina, idNominaValoresE, Descripcion: Descripcion, Vigencia: Vigencia, bSueldoBasico: bSueldoBasico, SueldoBasico, HsMensuales: HsMensuales, bGuardiasDiurnas: bGuardiasDiurnas, HsGuardiasDiurnas: HsGuardiasDiurnas, ValorGuardiaDiurna: valorGuardiaDiurna, bGuardiasNocturnas: bGuardiasNocturnas, ValorGuardiaNocturna: ValorGuardiaNocturna, HsGuardiasNocturnas: HsGuardiasNocturnas, bGuardiasPasivas: bGuardiasPasivas, ValorGuardiaPasiva: ValorGuardiaPasiva, bAdicionalMensual: bAdicionalMensual, ValorAdicional: ValorAdicional, TextoAdicional: TextoAdicional, Id: Id });
    } catch (error) {
        // Handle the error here
        console.error(error);
    }
});

router.post('/nominaValorizada', logueado, async (req, res) => {

    let {
        Id,
        idNomina,
        idNominaValoresE,
        sueldoBasico,
        HsMensuales,
        guardiaDiurna,
        HsGuardiasDiurnas,
        guardiaNocturna,
        HsGuardiasNocturnas,
        guardiaPasiva,
        adicionalMensual
    } = req.body;
    let valorHoraSimple = 0;
    let valorHora50 = 0;
    let valorHora100 = 0;
    let valorHoraGuardiaDiurna = 0;
    let valorHoraGuardiaNocturna = 0;


    const sql = "UPDATE nominavaloresr SET IdNomina = ?, IdNominaValoresE = ?, ValorSueldoBasico = ?, HorasMensuales = ?, ValorHoraSimple = ?, ValorHora50 = ?, ValorHora100 = ?,  ValorGuardiaDiurna = ?, HsGuardiaDiurna = ?, ValorHoraGuardiaDiurna = ?, ValorGuardiaNocturna = ?, HsGuardiaNocturna = ?, ValorHoraGuardiaNocturna = ?, ValorGuardiaPasiva = ?, ValorAdicional = ? WHERE Id = ?"

    sueldoBasico = sueldoBasico !== undefined ? sueldoBasico : 0;
    HsMensuales = HsMensuales !== undefined ? HsMensuales : 0;
    guardiaDiurna = guardiaDiurna !== undefined ? guardiaDiurna : 0;
    guardiaNocturna = guardiaNocturna !== undefined ? guardiaNocturna : 0;
    guardiaPasiva = guardiaPasiva !== undefined ? guardiaPasiva : 0;
    adicionalMensual = adicionalMensual !== undefined ? adicionalMensual : 0;
    if (sueldoBasico > 0) {
        valorHoraSimple = sueldoBasico / HsMensuales;
        valorHora50 = valorHoraSimple * 1.5;
        valorHora100 = valorHoraSimple * 2;
    }
    if (guardiaDiurna > 0) {
        valorHoraGuardiaDiurna = guardiaDiurna / HsGuardiasDiurnas
    }
    if (guardiaNocturna > 0) {
        valorHoraGuardiaNocturna = guardiaNocturna / HsGuardiasNocturnas
    }

    try {
        const tabla = await pool.query(sql,[idNomina, idNominaValoresE, sueldoBasico, HsMensuales, valorHoraSimple, valorHora50, valorHora100, guardiaDiurna, HsGuardiasDiurnas, valorHoraGuardiaDiurna, guardiaNocturna, HsGuardiasNocturnas, valorHoraGuardiaNocturna, guardiaPasiva, adicionalMensual, Id]);

    } catch(err) {
        console.log(err);
    }

    return res.redirect('/nomina/2');
})
module.exports = router;