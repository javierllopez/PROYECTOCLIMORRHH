const express = require('express');
const { Tabla } = require('../Clases/Tabla');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { confirmar } = require('../Middleware/render');
const { logueado } = require('../Middleware/validarUsuario');
const { FechaSqlAFechaCorta, FechaASqlFecha, FechaSqlAFecha, FechaLocalASqlDate, FechaHTMLaFecha, FechaUtcASqlDate } = require('../lib/libreria');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');
const ZONA_AR = 'America/Argentina/Buenos_Aires';
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
        const [tablaNominaValoreseRaw] = await pool.query(sqlNominaValorese);
        // Convertir fechas UTC (DATE) a objetos Date locales para mostrar correctamente en la vista
        const tablaNominaValorese = tablaNominaValoreseRaw.map(r => {
            const normalizar = (val) => {
                if (!val) return val;
                // Unificar a 'YYYY-MM-DD'
                const s = typeof val === 'string' ? val.substring(0, 10) : `${val.getUTCFullYear()}-${String(val.getUTCMonth() + 1).padStart(2, '0')}-${String(val.getUTCDate()).padStart(2, '0')}`;
                const [y, m, d] = s.split('-').map(Number);
                // Construir Date local en medianoche local
                return new Date(y, m - 1, d);
            };
            return {
                ...r,
                VigenteDesde: normalizar(r.VigenteDesde),
                VigenteHasta: normalizar(r.VigenteHasta)
            };
        });
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

        // Detectar si hay ítems de nómina sin correlativo en nominavaloresr para el período seleccionado
        const [faltantesRows] = await pool.query(`
                        SELECT COUNT(*) AS faltantes
                        FROM nomina n
                        LEFT JOIN nominavaloresr r
                            ON r.IdNomina = n.Id AND r.IdNominaValoresE = ?
                        WHERE r.Id IS NULL
                `, [idNomina]);
        const hayFaltantes = (faltantesRows && faltantesRows[0] && Number(faltantesRows[0].faltantes) > 0);

        return render(req, res, 'nominaValorizada', {
            encabezadoHTMLNominaValoresr: encabezadoHTMLNominaValoresr,
            tablaNominaValoresr: tablaNominaValoresr,
            paginadorNominaValoresr: paginadorNominaValoresr,
            funcionesNominaValoresr: funcionesNominaValoresr,
            permiteBorrarNominaValoresr: nominavaloresr.borrable,
            permiteEditarNominaValoresr: nominavaloresr.editable,
            tablaNominaValorese: tablaNominaValorese,
            idNomina: idNomina,
            hayFaltantes
        });
    }
    catch (err) {
        enviarMensaje(req, res, 'Nómina valorizada', err.message, 'danger');
        console.log(err);
    }


});

// Vista para agregar manualmente un registro faltante
router.get('/agregar/:idNominaValoresE', logueado, async (req, res) => {
    const { idNominaValoresE } = req.params;
    try {
        // Traer combo de ítems de nomina que no tienen correlativo en nominavaloresr para este período
        const [faltantes] = await pool.query(`
            SELECT n.Id, n.Descripcion
            FROM nomina n
            LEFT JOIN nominavaloresr r
              ON r.IdNomina = n.Id AND r.IdNominaValoresE = ?
            WHERE r.Id IS NULL
            ORDER BY n.Descripcion
        `, [idNominaValoresE]);
        // Traer vigencia para mostrar info contextual
        const [vig] = await pool.query('SELECT VigenteDesde, VigenteHasta FROM nominavalorese WHERE Id = ?', [idNominaValoresE]);
        const vigencia = vig && vig[0] ? vig[0] : null;
        return render(req, res, 'nominaAgregarManual', { idNominaValoresE, faltantes, vigencia });
    } catch (err) {
        enviarMensaje(req, res, 'Nómina valorizada', err.message, 'danger');
        return res.redirect('/nominaValorizada');
    }
});

// POST para guardar el registro manual
router.post('/agregar', logueado, async (req, res) => {
    const { idNominaValoresE, idNomina, sueldoBasico, guardiaDiurna, guardiaNocturna, guardiaPasiva } = req.body;
    try {
        // Validaciones mínimas
        const idNominaNum = Number(idNomina);
        const idE = Number(idNominaValoresE);
        if (!Number.isFinite(idNominaNum) || !Number.isFinite(idE)) {
            throw new Error('Datos inválidos.');
        }
        // Traer vigencia y datos de nomina para derivar horas/hora
        const [[ev]] = await pool.query('SELECT VigenteDesde, VigenteHasta FROM nominavalorese WHERE Id = ?', [idE]);
        const [[n]] = await pool.query('SELECT HorasMensuales, HorasGuardiaDiurna, HorasGuardiaNocturna FROM nomina WHERE Id = ?', [idNominaNum]);
        const hsMensuales = Number(n?.HorasMensuales) || 0;
        const hsGD = Number(n?.HorasGuardiaDiurna) || 0;
        const hsGN = Number(n?.HorasGuardiaNocturna) || 0;
        const sb = Number(sueldoBasico) || 0;
        const gd = Number(guardiaDiurna) || 0;
        const gn = Number(guardiaNocturna) || 0;
        const gp = Number(guardiaPasiva) || 0;
        const valorHoraSimple = sb > 0 && hsMensuales > 0 ? sb / hsMensuales : 0;
        const valorHora50 = valorHoraSimple > 0 ? valorHoraSimple * 1.5 : 0;
        const valorHora100 = valorHoraSimple > 0 ? valorHoraSimple * 2 : 0;
        const valorHoraGD = gd > 0 && hsGD > 0 ? gd / hsGD : 0;
        const valorHoraGN = gn > 0 && hsGN > 0 ? gn / hsGN : 0;

        const sqlIns = `INSERT INTO nominavaloresr (
            IdNomina, IdNominaValoresE, ValorSueldoBasico, HorasMensuales, ValorHoraSimple, ValorHora50, ValorHora100,
            ValorGuardiaDiurna, HsGuardiaDiurna, ValorHoraGuardiaDiurna, ValorGuardiaNocturna, HsGuardiaNocturna,
            ValorHoraGuardiaNocturna, ValorGuardiaPasiva, ValorAdicional, VigenciaDesde, VigenciaHasta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`;

        await pool.query(sqlIns, [
            idNominaNum, idE, sb, hsMensuales, valorHoraSimple, valorHora50, valorHora100,
            gd, hsGD, valorHoraGD, gn, hsGN, valorHoraGN, gp, ev.VigenteDesde, ev.VigenteHasta
        ]);
        enviarMensaje(req, res, 'Nómina valorizada', 'Ítem agregado correctamente.', 'success');
    } catch (err) {
        console.error('Error agregando ítem manual de nominavaloresr:', err);
        enviarMensaje(req, res, 'Nómina valorizada', err.message, 'danger');
    }
    return res.redirect('/nominaValorizada');
});

// API: devuelve flags de configuración del ítem de nómina seleccionado
router.get('/nomina/:id', logueado, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT InformaValorSueldoBasico, HaceGuardiasDiurnas, HaceGuardiasNocturnas, HaceGuardiasPasivas FROM nomina WHERE Id = ? LIMIT 1',
            [id]
        );
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Ítem no encontrado' });
        }
        const r = rows[0];
        return res.json({
            InformaValorSueldoBasico: !!Number(r.InformaValorSueldoBasico),
            HaceGuardiasDiurnas: !!Number(r.HaceGuardiasDiurnas),
            HaceGuardiasNocturnas: !!Number(r.HaceGuardiasNocturnas),
            HaceGuardiasPasivas: !!Number(r.HaceGuardiasPasivas)
        });
    } catch (err) {
        console.error('Error consultando ítem nómina:', err);
        return res.status(500).json({ error: 'Error de servidor' });
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

    // Construir fechas UTC partiendo del calendario local AR usando date-fns-tz
    const VigenteDesdeDate = VigenteDesde ? fromZonedTime(`${VigenteDesde} 00:00`, ZONA_AR) : null;
    const VigenteHastaDate = VigenteHasta ? fromZonedTime(`${VigenteHasta} 23:59:59.999`, ZONA_AR) : null;
    console.log("Vigencia Desde: " + VigenteDesdeDate + " Vigencia Hasta: " + VigenteHastaDate);
    const AumentoFactor = ((parseFloat(Aumento) / 100) + 1);
    IdNominaBase = parseInt(IdNominaBase);
    opcionNomina = parseInt(opcionNomina);

    // Si es una nómina nueva, genera una nueva nómina vacía
    //Valido que la nomina no se superponga con otras 

    try {
        const cadenaNominaValoreseCompeta = "SELECT * FROM nominavalorese";
        const [nominaValoreseCompleta] = await pool.query(cadenaNominaValoreseCompeta);

        // Validación de superposición de rangos de fechas (inclusive)
        // [desde,hasta] del nuevo período no debe solaparse con ninguno existente
        for (const fila of nominaValoreseCompleta) {
            const desdeStr = typeof fila.VigenteDesde === 'string' ? fila.VigenteDesde.substring(0,10) : FechaUtcASqlDate(fila.VigenteDesde);
            const hastaStr = typeof fila.VigenteHasta === 'string' ? fila.VigenteHasta.substring(0,10) : FechaUtcASqlDate(fila.VigenteHasta);
            const desdeExist = fromZonedTime(`${desdeStr} 00:00`, ZONA_AR);
            const hastaExist = fromZonedTime(`${hastaStr} 23:59:59.999`, ZONA_AR);
            const solapa = (VigenteDesdeDate <= hastaExist) && (VigenteHastaDate >= desdeExist);
            if (solapa) {
                throw new Error('Error en las fechas de vigencia');
            }
        }
    } catch (error) {
        console.log(error);
        // Devolver valores compatibles con inputs type=date (local calendar)
        return render(req, res, 'generarNomina', { Mensaje: { title: 'Atención', text: 'Error en las fechas de vigencia', icon: 'error' }, Paquete: { VigenteDesde: FechaLocalASqlDate(VigenteDesdeDate), VigenteHasta: FechaLocalASqlDate(VigenteHastaDate), Aumento: (parseFloat(Aumento) || 0), IdNominaBase: IdNominaBase } });

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
            const [rNominaValoresE] = await conn.query(sqlNominaValorese, [FechaUtcASqlDate(VigenteDesdeDate), FechaUtcASqlDate(VigenteHastaDate)]);
            let idNominaValoresE = rNominaValoresE.insertId;
            let i = 0;
            do {
                let sqlNominaR = "";
                sqlNominaR = "INSERT INTO nominavaloresr (IdNomina, IdNominaValoresE, ValorSueldoBasico, HorasMensuales, ValorHoraSimple, ValorHora50, ValorHora100, ValorGuardiaDiurna, HsGuardiaDiurna, ValorHoraGuardiaDiurna, ValorGuardiaNocturna, HsGuardiaNocturna, ValorHoraGuardiaNocturna, ValorGuardiaPasiva, ValorAdicional, VigenciaDesde, VigenciaHasta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? )";
                await conn.query(sqlNominaR, [nomina[i].Id, idNominaValoresE, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, FechaUtcASqlDate(VigenteDesdeDate), FechaUtcASqlDate(VigenteHastaDate)]);
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
                const [rNominaValoresE] = await conn.query(cadenaNominaValoresE, [FechaUtcASqlDate(VigenteDesdeDate), FechaUtcASqlDate(VigenteHastaDate)]);
                idNominaValoresE = rNominaValoresE.insertId;

                const [rNominaValoresR] = await conn.query(SelectCadenaNominaValoresR, [IdNominaBase]);
                let i = 0;
                do {
                    if (rNominaValoresR[i].ValorSueldoBasico > 0) {
                        valorSueldoBasico = rNominaValoresR[i].ValorSueldoBasico * AumentoFactor;
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
                        valorGuardiaDiurna = Math.round(rNominaValoresR[i].ValorGuardiaDiurna * AumentoFactor);
                        hsGuardiaDiurna = rNominaValoresR[i].HsGuardiaDiurna;
                        valorHoraGuardiaDiurna = valorGuardiaDiurna / hsGuardiaDiurna;
                    } else {
                        valorGuardiaDiurna = 0;
                        hsGuardiaDiurna = 0;
                        valorHoraGuardiaDiurna = 0;
                    }
                    if (rNominaValoresR[i].ValorGuardiaNocturna > 0) {
                        valorGuardiaNocturna = Math.round(rNominaValoresR[i].ValorGuardiaNocturna * AumentoFactor);
                        hsGuardiaNocturna = rNominaValoresR[i].HsGuardiaNocturna;
                        valorHoraGuardiaNocturna = valorGuardiaNocturna / hsGuardiaNocturna;
                    } else {
                        valorGuardiaNocturna = 0;
                        hsGuardiaNocturna = 0;
                        valorHoraGuardiaNocturna = 0;
                    }
                    if (rNominaValoresR[i].ValorGuardiaPasiva > 0) {
                        valorGuardiaPasiva = Math.round(rNominaValoresR[i].ValorGuardiaPasiva * AumentoFactor);
                    } else {
                        valorGuardiaPasiva = 0;
                    }
                    if (rNominaValoresR[i].ValorAdicional > 0) {
                        valorAdicional = Math.round(rNominaValoresR[i].ValorAdicional * AumentoFactor);
                    } else {
                        valorAdicional = 0;
                    }

                    await conn.query(InsertcadenaNominaValoresR, [rNominaValoresR[i].IdNomina, idNominaValoresE, valorSueldoBasico, horasMensuales, valorHoraSimple, valorHora50, valorHora100, valorGuardiaDiurna, hsGuardiaDiurna, valorHoraGuardiaDiurna, valorGuardiaNocturna, hsGuardiaNocturna, valorHoraGuardiaNocturna, valorGuardiaPasiva, valorAdicional, FechaUtcASqlDate(VigenteDesdeDate), FechaUtcASqlDate(VigenteHastaDate)]);
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