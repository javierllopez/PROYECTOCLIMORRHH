const express = require('express');
const {Tabla} = require('../Clases/Tabla');
const {pool} = require('../conexion');
const {render, enviarMensaje} = require('../Middleware/render');
const {logueado} = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1]; // Niveles de usuario que pueden acceder a esta ruta

const turnos = new Tabla('turnos', true, false);
turnos.agregarCampo({campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%'});
turnos.agregarCampo({campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '60%'});
turnos.agregarCampo({campo: 'Tipo', titulo: 'Tipo', tipoDato: 'texto', ancho: '20%', visible_sm: false});

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.post('/filtrar', logueado, async (req, res) => {
    const { i, filtro } = req.body;
    if (!req.session.turnos) {
        req.session.turnos = {};
        req.session.turnos.estructura = turnos.exportarEstructura();
    } else {
        turnos.importarEstructura(req.session.turnos.estructura);
    };
    turnos.cambiarFiltro(i, filtro);
    turnos.paginaActual = 1;
    req.session.turnos.estructura.paginaActual = 1;
    res.redirect('/turnos')
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.turnos) {
        req.session.turnos = {};
        req.session.turnos.estructura = turnos.exportarEstructura();
    }else {
        turnos.importarEstructura(req.session.turnos.estructura);
    };
    turnos.cambiarOrden(campo);
    res.redirect('/turnos');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.turnos) {
        req.session.turnos = {};
        req.session.turnos.estructura = turnos.exportarEstructura();
    }else {
        turnos.importarEstructura(req.session.turnos.estructura);
    };
    console.log('página desde /paginar: ' + pagina);
    req.session.turnos.estructura.paginaActual = pagina;
    turnos.paginaActual = pagina;
    res.redirect('/turnos');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.turnos) {
        req.session.turnos = {};
        req.session.turnos.estructura = turnos.exportarEstructura();
    }else {
        turnos.importarEstructura(req.session.turnos.estructura);
    };
    turnos.getTotalRegistros();
    var sql = turnos.getSQL();
    var encabezadoHTML = turnos.getEncabezadoCSP();
    var paginador = await turnos.getPaginadorCSP();
    var funciones = "";
 
    try {
        const [tabla, fields] = await pool.query(sql);

    return render(req, res, 'turnos', {encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: turnos.borrable , permiteEditar: turnos.editable });
    }
    catch(err) {
        enviarMensaje(req, res, 'Error en la base de datos', err.message, 'danger');
        console.log(err);
    }

});

// Ruta para cargar página que  editara el turno seleccionado

//Ruta para cargar página que agregará un nuevo turno

router.get('/editar', logueado, async (req, res) => {
 
    return render(req,res, 'turno');
});

// Ruta para cargar página que  editara el turno seleccionado   
router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    var cadena = "";
    const sql = 'SELECT * FROM turnos WHERE Id = ?';

    try {
        const [turno] = await pool.query(sql, [Id]);
        return render(req, res,'turno', { turno: turno[0], Id: Id });

    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Turnos', error.message, 'danger');
        console.error(error);
    }
});

//Ruta para agregar un nuevo turno
router.post('/editar', logueado, async (req, res) => {
    const {Descripcion, Tipo}= req.body;
    const iTipo = parseInt(Tipo);
    const sql = "INSERT INTO turnos (Descripcion, Tipo) VALUES (?, ?)";


    try {
        await pool.query(sql, [Descripcion, iTipo]);
        enviarMensaje(req, res, 'Turnos', 'Turno agregado correctamente', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Turnos', error.message, 'danger');
        console.error(error);
    }

    return res.redirect('/turnos');
});

//Ruta para editar una categoría
router.post('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const {Descripcion, Tipo}= req.body;
    const iTipo = parseInt(Tipo);
    const sql = "UPDATE turnos SET Descripcion = ?, Tipo = ? WHERE Id = ?";

    try {
        await pool.query(sql, [Descripcion, iTipo, Id]);
        enviarMensaje(req, res, 'Turnos', 'Turno editado correctamente', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Turnos', error.message, 'danger');
        console.error(error);
    }

    return res.redirect('/turnos');
});

const multer = require('multer');
const ExcelJS = require('exceljs');
const upload = multer({ dest: 'uploads/' });
// ===================== RUTAS DE IMPORTACIÓN DESDE EXCEL =====================

// Página para seleccionar archivo y mapear campos
router.get('/importar', logueado, (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'Tipo', label: 'Tipo' }
    ];
    render(req, res, 'turnosImportar', { campos });
});

// Recibe el archivo y muestra las columnas para mapear
router.post('/importar/preparar', logueado, upload.single('archivoExcel'), async (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'Tipo', label: 'Tipo' }
    ];
    const tieneEncabezado = req.body.tieneEncabezado === 'on';
    const modoImportacion = req.body.modoImportacion || 'agregar';
    if (!req.file) {
        enviarMensaje(req, res, 'Error', 'No se subió ningún archivo', 'error');
        return res.redirect('/turnos/importar');
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];
    let columnas = [];
    if (tieneEncabezado) {
        const firstRow = worksheet.getRow(1);
        firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columnas.push(cell.value);
        });
    } else {
        const firstRow = worksheet.getRow(1);
        firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columnas.push(`Columna ${colNumber}`);
        });
    }
    render(req, res, 'turnosImportar', { campos, columnas, archivo: req.file.filename, tieneEncabezado, modoImportacion });
});

// Realiza la importación
router.post('/importar/ejecutar', logueado, async (req, res) => {
    const { Descripcion, Tipo, archivo, tieneEncabezado, modoImportacion } = req.body;
    if (!archivo) {
        enviarMensaje(req, res, 'Error', 'No se encontró el archivo para importar', 'error');
        return res.redirect('/turnos/importar');
    }
    const mapeo = {Descripcion: Descripcion, Tipo: Tipo};
    const campos = [ 'Descripcion', 'Tipo' ];
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('uploads/' + archivo);
    const worksheet = workbook.worksheets[0];
    let rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (tieneEncabezado === 'on') {
            if (rowNumber > 1) {
                const rowObj = {};
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const header = worksheet.getRow(1).getCell(colNumber).value;
                    rowObj[header] = cell.value;
                });
                if (Object.values(rowObj).some(v => v !== null && v !== undefined && v.toString().trim() !== '')) {
                    rows.push(rowObj);
                }
            }
        } else {
            const rowObj = {};
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                rowObj[`Columna ${colNumber}`] = cell.value;
            });
            if (Object.values(rowObj).some(v => v !== null && v !== undefined && v.toString().trim() !== '')) {
                rows.push(rowObj);
            }
        }
    });
    let insertados = 0;
    try {
        let mapeoObj = mapeo;
        if (!mapeoObj || typeof mapeoObj !== 'object') {
            mapeoObj = {
                Descripcion: req.body['mapeo[Descripcion]'],
                Tipo: req.body['mapeo[Tipo]']
            };
        }
        if (!mapeoObj || !mapeoObj.Descripcion) {
            enviarMensaje(req, res, 'Error', 'No se recibieron los datos de mapeo de columnas. Intente nuevamente.', 'error');
            return res.redirect('/turnos/importar');
        }
        if (modoImportacion === 'sobreescribir') {
            await pool.query('DELETE FROM turnos');
            await pool.query('ALTER TABLE turnos AUTO_INCREMENT = 1');
        }
        for (let row of rows) {
            let values = [];
            for (let campo of campos) {
                const columna = mapeoObj ? mapeoObj[campo] : null;
                let valor = null;
                if (columna) {
                    const key = Object.keys(row).find(k => k && k.toLowerCase() === columna.toLowerCase());
                    valor = key ? row[key] : null;
                }
                values.push(valor);
            }
            if (values[0] && values[0].toString().trim() !== '') {
                await pool.query('INSERT INTO turnos (Descripcion, Tipo) VALUES (?, ?)', values);
                insertados++;
            }
        }
        enviarMensaje(req, res, 'Importación finalizada', `Se importaron ${insertados} registros.`, 'success');
    } catch (err) {
        console.log(err);
        enviarMensaje(req, res, 'Error', err.message, 'danger');
    }
    return res.redirect('/turnos');
});
// =================== FIN RUTAS DE IMPORTACIÓN DESDE EXCEL ===================

module.exports = router;