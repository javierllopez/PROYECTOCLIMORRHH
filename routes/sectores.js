const express = require('express');
const {Tabla} = require('../Clases/Tabla');
const {pool} = require('../conexion');
const multer = require('multer');
const ExcelJS = require('exceljs'); // Usar exceljs en vez de xlsx
const {render, enviarMensaje} = require('../Middleware/render');
const {logueado} = require('../Middleware/validarUsuario');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });


const nivelAceptado = [1]; //Niveles de usuario que pueden acceder a la ruta

const sectores = new Tabla('sectores', true, false);
sectores.agregarCampo({campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%'});
sectores.agregarCampo({campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '80%'});

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.post('/filtrar', logueado, async (req, res) => {
    const { i, filtro } = req.body;
    if (!req.session.sectores) {
        req.session.sectores = {};
        req.session.sectores.estructura = sectores.exportarEstructura();
    } else {
        sectores.importarEstructura(req.session.sectores.estructura);
    };
    sectores.cambiarFiltro(i, filtro);
    sectores.paginaActual = 1;
    req.session.sectores.estructura.paginaActual = 1;
    res.redirect('/sectores')
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.sectores) {
        req.session.sectores = {};
        req.session.sectores.estructura = sectores.exportarEstructura();
    }else {
        sectores.importarEstructura(req.session.sectores.estructura);
    };
    sectores.cambiarOrden(campo);
    res.redirect('/sectores');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.sectores) {
        req.session.sectores = {};
        req.session.sectores.estructura = sectores.exportarEstructura();
    }else {
        sectores.importarEstructura(req.session.sectores.estructura);
    };

    req.session.sectores.estructura.paginaActual = pagina;
    sectores.paginaActual = pagina;
    res.redirect('/sectores');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.sectores) {
        req.session.sectores = {};
        req.session.sectores.estructura = sectores.exportarEstructura();
    }else {
        sectores.importarEstructura(req.session.sectores.estructura);
    };
    sectores.getTotalRegistros();
    var sql = sectores.getSQL();
    var encabezadoHTML = sectores.getEncabezadoCSP();
    var paginador = await sectores.getPaginadorCSP();
    var funciones = "";
 
    try {
        const [tabla] = await pool.query(sql);

    return render(req,res,'sectores',{encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: sectores.borrable , permiteEditar: sectores.editable });

    }
    catch(err) {
        enviarMensaje(req, res, 'Error', err.message, 'error');
        console.log(err);
        return res.redirect('/sectores');
    }

});

//Rutas de edicion de sectores

//Ruta para cargar página que agregará un nuevo sector

router.get('/editar', logueado, async (req, res) => {
    const sqlPersonal = "SELECT Id, ApellidoYNombre, nivel FROM personal WHERE nivel = 2";

    try {
        [personal] = await pool.query(sqlPersonal);

    return render(req,res,'sector', {personal: personal});
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }
});

// Ruta para cargar página que  editara el sector seleccionado 

router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sqlPersonal = "SELECT Id, ApellidoYNombre, idUsuario, nivel FROM personal WHERE nivel = 2";
    const sql = 'SELECT * FROM sectores WHERE Id = ?';

    try {
        const [personal] = await pool.query(sqlPersonal);
        const [sector] = await pool.query(sql, [Id]);
        return render(req,res,'sector', { sector: sector[0], Id: Id, personal: personal });

    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

});

//Ruta para agregar un nuevo sector

router.post('/editar', logueado, async (req, res) => {
    const {Descripcion, Supervisor}= req.body;
    const sql = "INSERT INTO sectores (Descripcion, IdSupervisor) VALUES (?, ?)";

    try {
        await pool.query(sql, [Descripcion, Supervisor]);
        enviarMensaje(req, res, 'Sector agregado', 'El sector fue agregado correctamente', 'success');
        return res.redirect('/sectores');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

});

// Rutas para editar sectores

//Ruta para editar un sector
router.post('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const {Descripcion, Supervisor}= req.body;
    const sql = "UPDATE sectores SET Descripcion = ?, IdSupervisor = ? WHERE Id = ?";

    try {
        await pool.query(sql, [Descripcion, Supervisor, Id]);
        enviarMensaje(req, res, 'Sector modificado', 'El sector fue editado correctamente', 'success');
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

    return res.redirect('/sectores');
});


// ===================== RUTAS DE IMPORTACIÓN DESDE EXCEL =====================

// Página para seleccionar archivo y mapear campos
router.get('/importar', logueado, (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'IdSupervisor', label: 'Supervisor' }
    ];
    render(req, res, 'sectoresImportar', { campos });
});

// Recibe el archivo y muestra las columnas para mapear
router.post('/importar/preparar', logueado, upload.single('archivoExcel'), async (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'IdSupervisor', label: 'Supervisor' }
    ];
    const tieneEncabezado = req.body.tieneEncabezado === 'on';
    const modoImportacion = req.body.modoImportacion || 'agregar';
    if (!req.file) {
        enviarMensaje(req, res, 'Error', 'No se subió ningún archivo', 'error');
        return res.redirect('/sectores/importar');
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
        // Si no tiene encabezado, usar letras de columna
        const firstRow = worksheet.getRow(1);
        firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columnas.push(`Columna ${colNumber}`);
        });
    }
    render(req, res, 'sectoresImportar', { campos, columnas, archivo: req.file.filename, tieneEncabezado, modoImportacion });
});

// Realiza la importación
router.post('/importar/ejecutar', logueado, async (req, res) => {
    const { Descripcion, IdSupervisor, archivo, tieneEncabezado, modoImportacion } = req.body;
    if (!archivo) {
        enviarMensaje(req, res, 'Error', 'No se encontró el archivo para importar', 'error');
        return res.redirect('/sectores/importar');
    }
    const mapeo = {Descripcion: Descripcion, IdSupervisor: IdSupervisor};
    const campos = [ 'Descripcion', 'IdSupervisor' ];
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('uploads/' + archivo);
    const worksheet = workbook.worksheets[0];
    let rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (tieneEncabezado === 'on') {
            if (rowNumber > 1) {
                const rowObj = {};
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    // ExcelJS columns are 1-based, but JS arrays are 0-based
                    const header = worksheet.getRow(1).getCell(colNumber).value;
                    rowObj[header] = cell.value;
                });
                // Solo agregar si hay algún dato en la fila
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
        // Asegurar que mapeo siempre sea un objeto
        // Reconstruir mapeo si viene como campos planos
        let mapeoObj = mapeo;
        if (!mapeoObj || typeof mapeoObj !== 'object') {
            mapeoObj = {
                Descripcion: req.body['mapeo[Descripcion]'],
                IdSupervisor: req.body['mapeo[IdSupervisor]']
            };
        }
        if (!mapeoObj || !mapeoObj.Descripcion) {
            enviarMensaje(req, res, 'Error', 'No se recibieron los datos de mapeo de columnas. Intente nuevamente.', 'error');
            return res.redirect('/sectores/importar');
        }

        if (modoImportacion === 'sobreescribir') {
            await pool.query('DELETE FROM sectores');
            await pool.query('ALTER TABLE sectores AUTO_INCREMENT = 1');
        }
        for (let row of rows) {
            let values = [];
            for (let campo of campos) {
                const columna = mapeoObj ? mapeoObj[campo] : null;
                // Permitir mapeo insensible a mayúsculas/minúsculas
                let valor = null;
                if (columna) {
                    const key = Object.keys(row).find(k => k && k.toLowerCase() === columna.toLowerCase());
                    valor = key ? row[key] : null;
                }
                values.push(valor);
            }
            if (values[0] && values[0].toString().trim() !== '') {
                await pool.query('INSERT INTO sectores (Descripcion, IdSupervisor) VALUES (?, ?)', values);
                insertados++;
            }
        }
        enviarMensaje(req, res, 'Importación finalizada', `Se importaron ${insertados} registros.`, 'success');
    } catch (err) {
        console.log(err);
        enviarMensaje(req, res, 'Error', err.message, 'error');
    }
    return res.redirect('/sectores');
});
// =================== FIN RUTAS DE IMPORTACIÓN DESDE EXCEL ===================

module.exports = router;