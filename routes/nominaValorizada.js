const express = require('express');
const { Tabla } = require('../Clases/Tabla');
const { pool } = require('../conexion');
const {render, enviarMensaje } = require('../Middleware/render');
const { logueado } = require('../Middleware/validarUsuario');
const { FechaSqlAFechaCorta, FechaASqlFecha, FechaSqlAFecha} = require('../lib/libreria');
const router = express.Router();
const nivelAceptado = [1]; //Nivel de usuario aceptado para esta ruta

const nominavaloresr = new Tabla('nominavaloresr', true, false, 'nominaValorizada');
nominavaloresr.agregarCampo({ campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%' });
nominavaloresr.agregarCampo({ campo: 'IdNomina', titulo: 'IdNomina', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'IdNominaValoresE', titulo: 'IdNominaValoresE', tipoDato: 'numero', ancho: '10%', visible: false });
nominavaloresr.agregarCampo({ campo: 'Id', titulo: 'Id', alias: 'IdNomina', tipoDato: 'numero', ancho: '10%', tabla: 'nomina', visible: false });
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
    const { i, filtro } = req.body;
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    nominavaloresr.cambiarFiltro(i, filtro);
    nominavaloresr.paginaActual = 1;
    req.session.nominavaloresr.estructura.paginaActual = 1;
    res.redirect('/nominaValorizada');

});
router.post('/filtroGeneral', logueado, async (req, res) => {
    const { filtro } = req.body;
    const cadenaFiltro = "nominavaloresr.IdNominaValoresE = " + filtro
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    req.session.nominavaloresr.estructura.filtroGeneral = cadenaFiltro;
    req.session.nominavaloresr.estructura.tag = filtro;
    return res.redirect('/nominaValorizada');
});
router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    nominavaloresr.cambiarOrden(campo);
    return res.redirect('/nominaValorizada');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    req.session.nominavaloresr.estructura.paginaActual = pagina;
    nominavaloresr.paginaActual = pagina;
    return res.redirect('/nominaValorizada');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.nominavaloresr) {
        req.session.nominavaloresr = {};
        req.session.nominavaloresr.estructura = nominavaloresr.exportarEstructura();
    } else {
        nominavaloresr.importarEstructura(req.session.nominavaloresr.estructura);
    };
    const sqlNominaValorese = "SELECT * FROM nominavalorese ORDER BY VigenteDesde DESC"

    try {
        const [tablaNominaValorese] = await pool.query(sqlNominaValorese);
        let idNomina
        if (nominavaloresr.filtroGeneral == "") {
            idNomina = parseInt(tablaNominaValorese[0].Id);
            nominavaloresr.aplicarFiltroGeneral("IdNominaValoresE = " + idNomina);
        } else {
            idNomina = parseInt(nominavaloresr.tag);
        }
        const sqlNominaValoresr = nominavaloresr.getSQL();
        const encabezadoHTMLNominaValoresr = nominavaloresr.getEncabezado();
        const paginadorNominaValoresr = await nominavaloresr.getPaginador();
        const funcionesNominaValoresr = nominavaloresr.getFunciones();
        const [tablaNominaValoresr] = await pool.query(sqlNominaValoresr);

        return render(req, res, 'nominaValorizada', {
            encabezadoHTMLNominaValoresr: encabezadoHTMLNominaValoresr,
            tablaNominaValoresr: tablaNominaValoresr,
            paginadorNominaValoresr: paginadorNominaValoresr,
            funcionesNominaValoresr: funcionesNominaValoresr,
            permiteBorrarNominaValoresr: nominavaloresr.borrable,
            permiteEditarNominaValoresr: nominavaloresr.editable,
            tablaNominaValorese: tablaNominaValorese,
            idNomina: idNomina
        });
    }
    catch (err) {
        enviarMensaje(req, res, 'Nómina valorizada', err.message, 'danger');
        console.log(err);
    }


});

// Rutas para editar nominavaloresr

// Ruta para cargar página que editará un ítem valorizado de nómina 
router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM nominavaloresr WHERE Id = ?';
    const sql2 = 'SELECT * FROM nomina WHERE Id = ?';
    const sql3 = 'SELECT * FROM nominavalorese WHERE Id = ?';
    let Descripcion = "";
    let Vigencia = "";
    let bSueldoBasico = false
    let sueldoBasico = 0;
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
        const [tablaNominaValoresr] = await pool.query(sql, [Id]);
        const [tablaNomina] = await pool.query(sql2, [tablaNominaValoresr[0].IdNomina]);
        const [tablaNominaValorese] = await pool.query(sql3, [tablaNominaValoresr[0].IdNominaValoresE]);

        idNomina = tablaNomina[0].Id;
        idNominaValoresE = tablaNominaValorese[0].Id;
        Descripcion = tablaNomina[0].Descripcion;
        Vigencia = 'Entre ' + FechaSqlAFechaCorta(tablaNominaValorese[0].VigenteDesde) + ' y ' + FechaSqlAFechaCorta(tablaNominaValorese[0].VigenteHasta);
        bSueldoBasico = tablaNomina[0].InformaValorSueldoBasico;
        sueldoBasico = tablaNominaValoresr[0].ValorSueldoBasico;
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

        return render(req, res, 'editarNominaValorizada', { Id, idNomina, idNominaValoresE, Descripcion: Descripcion, Vigencia: Vigencia, bSueldoBasico: bSueldoBasico, sueldoBasico, HsMensuales: HsMensuales, bGuardiasDiurnas: bGuardiasDiurnas, HsGuardiasDiurnas: HsGuardiasDiurnas, ValorGuardiaDiurna: valorGuardiaDiurna, bGuardiasNocturnas: bGuardiasNocturnas, ValorGuardiaNocturna: ValorGuardiaNocturna, HsGuardiasNocturnas: HsGuardiasNocturnas, bGuardiasPasivas: bGuardiasPasivas, ValorGuardiaPasiva: ValorGuardiaPasiva, bAdicionalMensual: bAdicionalMensual, ValorAdicional: ValorAdicional, TextoAdicional: TextoAdicional, Id: Id });
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Nómina valorizada', error.message, 'danger');
        console.error(error);
    }
});

// Modificar ítem de nómina valorizada
router.post('/', logueado, async (req, res) => {

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
        const tabla = await pool.query(sql, [idNomina, idNominaValoresE, sueldoBasico, HsMensuales, valorHoraSimple, valorHora50, valorHora100, guardiaDiurna, HsGuardiasDiurnas, valorHoraGuardiaDiurna, guardiaNocturna, HsGuardiasNocturnas, valorHoraGuardiaNocturna, guardiaPasiva, adicionalMensual, Id]);
        enviarMensaje(req, res, 'Nómina valorizada', 'Ítem modificado correctamente', 'success');
    } catch (err) {
        enviarMensaje(req, res, 'Nómina valorizada', err.message, 'danger');
        console.log(err);
    }

    return res.redirect('/nominaValorizada');
})

//Ruta para generar la nómina nueva
router.post('/generarNomina', logueado, async (req, res) => {
    let { VigenteDesde,
        VigenteHasta,
        Aumento,
        IdNominaBase,
        opcionNomina
    } = req.body;


    VigenteDesde = new Date(VigenteDesde);
    VigenteHasta = new Date(VigenteHasta);
    Aumento = ((parseFloat(Aumento)/100)+1);
    IdNominaBase = parseInt(IdNominaBase);
    opcionNomina = parseInt(opcionNomina);

    // Si es una nómina nueva, genera una nueva nómina vacía
    //Valido que la nomina no se superponga con otras 

    try {
        const cadenaNominaValoreseCompeta = "SELECT * FROM nominavalorese";
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
        console.log(error);
        return render(req, res, 'generarNomina', { Mensaje: { title: 'Atención', text: 'Error en las fechas de vigencia', icon: 'error' }, Paquete: { VigenteDesde: FechaASqlFecha(VigenteDesde), VigenteHasta: FechaASqlFecha(VigenteHasta), Aumento: Aumento, IdNominaBase: IdNominaBase } });

    }
    if (opcionNomina == 2) {
        const cadenaNomina = "SELECT * FROM nomina";


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

            enviarMensaje(req, res, 'Generar nómina', 'Nómina generada correctamente', 'success');
        } catch (err) {
            console.error('Error al generar la nómina', err);
            await conn.rollback();
            conn.release();
            return res.render('generarNomina', { Mensaje: { title: 'Atención', text: "Error generando valores de nómina", icon: 'error' }, Paquete: { VigenteDesde: FechaASqlFecha(VigenteDesde), VigenteHasta: FechaASqlFecha(VigenteHasta), Aumento: Aumento, IdNominaBase: IdNominaBase } });
        }

    } else {
        if (opcionNomina == 1) {
            let idNomina = 0;
            let idNominaValoresE = 0;
            let valorSueldoBasico = 0;
            let horasMensuales = 0;
            let valorHoraSimple = 0;
            let valorHora50 = 0;
            let valorHora100 = 0;
            let valorGuardiaDiurna = 0;
            let hsGuardiaDiurna = 0;
            let valorHoraGuardiaDiurna = 0;
            let valorGuardiaNocturna = 0;
            let hsGuardiaNocturna = 0;
            let valorHoraGuardiaNocturna = 0;
            let valorGuardiaPasiva = 0;
            let valorAdicional = 0;

            const cadenaNominaValoresE = "INSERT INTO nominavalorese (VigenteDesde, VigenteHasta) VALUES (?, ?)";
            const SelectCadenaNominaValoresR = "SELECT * FROM nominavaloresr WHERE IdNominaValoresE = ?";
            const InsertcadenaNominaValoresR = "INSERT INTO nominavaloresr (IdNomina, IdNominaValoresE, ValorSueldoBasico, HorasMensuales, ValorHoraSimple, ValorHora50, ValorHora100, ValorGuardiaDiurna, HsGuardiaDiurna, ValorHoraGuardiaDiurna, ValorGuardiaNocturna, HsGuardiaNocturna, ValorHoraGuardiaNocturna, ValorGuardiaPasiva, ValorAdicional, VigenciaDesde, VigenciaHasta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? )";

            let conn = await pool.getConnection();
            await conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            await conn.execute('SET autocommit=0');

            try {
                await conn.beginTransaction();
                const [rNominaValoresE] = await conn.query(cadenaNominaValoresE, [FechaASqlFecha(VigenteDesde), FechaASqlFecha(VigenteHasta)]);
                idNominaValoresE = rNominaValoresE.insertId;

                const [rNominaValoresR] = await conn.query(SelectCadenaNominaValoresR, [IdNominaBase]);
                let i = 0;
                do {
                    if (rNominaValoresR[i].ValorSueldoBasico > 0) {
                        valorSueldoBasico = rNominaValoresR[i].ValorSueldoBasico * Aumento;
                        horasMensuales = rNominaValoresR[i].HorasMensuales;
                        valorHoraSimple = valorSueldoBasico / horasMensuales;
                        valorHora50 = valorHoraSimple * 1.5;
                        valorHora100 = valorHoraSimple * 2;
                    } else {
                        valorSueldoBasico = 0;
                        horasMensuales = 0;
                        valorHoraSimple = 0;
                        valorHora50 = 0;
                        valorHora100 = 0;
                    }
                    if (rNominaValoresR[i].ValorGuardiaDiurna > 0) {
                        valorGuardiaDiurna = Math.round(rNominaValoresR[i].ValorGuardiaDiurna * Aumento);
                        hsGuardiaDiurna = rNominaValoresR[i].HsGuardiaDiurna;
                        valorHoraGuardiaDiurna = valorGuardiaDiurna / hsGuardiaDiurna;
                    } else {
                        valorGuardiaDiurna = 0;
                        hsGuardiaDiurna = 0;
                        valorHoraGuardiaDiurna = 0;
                    }
                    if (rNominaValoresR[i].ValorGuardiaNocturna > 0) {
                        valorGuardiaNocturna = Math.round(rNominaValoresR[i].ValorGuardiaNocturna*Aumento);
                        hsGuardiaNocturna = rNominaValoresR[i].HsGuardiaNocturna;
                        valorHoraGuardiaNocturna = valorGuardiaNocturna / hsGuardiaNocturna;
                    } else {
                        valorGuardiaNocturna = 0;
                        hsGuardiaNocturna = 0;
                        valorHoraGuardiaNocturna = 0;
                    }
                    if (rNominaValoresR[i].ValorGuardiaPasiva > 0) {
                        valorGuardiaPasiva = Math.round(rNominaValoresR[i].ValorGuardiaPasiva*Aumento);
                    } else {
                        valorGuardiaPasiva = 0;
                    }
                    if (rNominaValoresR[i].ValorAdicional > 0) {
                        valorAdicional = Math.round(rNominaValoresR[i].ValorAdicional*Aumento);
                    }else {
                        valorAdicional = 0;
                    }

                    await conn.query(InsertcadenaNominaValoresR, [rNominaValoresR[i].IdNomina, idNominaValoresE, valorSueldoBasico, horasMensuales, valorHoraSimple, valorHora50, valorHora100, valorGuardiaDiurna, hsGuardiaDiurna, valorHoraGuardiaDiurna, valorGuardiaNocturna, hsGuardiaNocturna, valorHoraGuardiaNocturna, valorGuardiaPasiva, valorAdicional, FechaASqlFecha(VigenteDesde), FechaASqlFecha(VigenteHasta)]);
                    i += 1;
                } while (i < rNominaValoresR.length);

                await conn.commit();
                enviarMensaje(req, res, 'Generar nómina', 'Nómina generada correctamente', 'success');

            }
            catch (error) {          
                console.log(error);
                await conn.rollback();
                conn.release();
                enviarMensaje(req, res, 'Generar nómina', error.message, 'danger');
            }
        }
    }
    return res.redirect('/nominaValorizada');

});


module.exports = router;