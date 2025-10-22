const express = require('express');
const {Tabla} = require('../Clases/Tabla');
const {pool} = require('../conexion');
const {render, enviarMensaje} = require('../Middleware/render');
const {logueado} = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1] //Esta ruta sólo permite usuarios nivel 1 (Administrador)

const categorias = new Tabla('categorias', true, false);
categorias.agregarCampo({campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%'});
categorias.agregarCampo({campo: 'Descripcion', titulo: 'Descripcion', tipoDato: 'texto', ancho: '60%'});
categorias.agregarCampo({campo: 'Area', titulo: 'Area', tipoDato: 'texto', ancho: '20%', visible_sm: false});

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});
router.post('/filtrar', logueado, async (req, res) => {

    const { i, filtro } = req.body;
    if (!req.session.categorias) {
        req.session.categorias = {};
        req.session.categorias.estructura = categorias.exportarEstructura();
    } else {
        categorias.importarEstructura(req.session.categorias.estructura);
    };
    categorias.cambiarFiltro(i, filtro);
    categorias.paginaActual = 1;
    req.session.categorias.estructura.paginaActual = 1;
    res.redirect('/categorias')
});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.categorias) {
        req.session.categorias = {};
        req.session.categorias.estructura = categorias.exportarEstructura();
    }else {
        categorias.importarEstructura(req.session.categorias.estructura);
    };
    categorias.cambiarOrden(campo);
    res.redirect('/categorias');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.categorias) {
        req.session.categorias = {};
        req.session.categorias.estructura = categorias.exportarEstructura();
    }else {
        categorias.importarEstructura(req.session.categorias.estructura);
    };
    req.session.categorias.estructura.paginaActual = pagina;
    categorias.paginaActual = pagina;
    res.redirect('/categorias');
});

router.get('/', logueado, async (req, res) => {

    if (!req.session.categorias) {
        req.session.categorias = {};
        req.session.categorias.estructura = categorias.exportarEstructura();
    }else {
        categorias.importarEstructura(req.session.categorias.estructura);
    };
    categorias.getTotalRegistros();
    var sql = categorias.getSQL();
    var encabezadoHTML = categorias.getEncabezadoCSP();
    var paginador = await categorias.getPaginadorCSP();
    var funciones = "";
 
    try {
        const [tabla] = await pool.query(sql);
    return render(req,res,'categorias', {encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: categorias.borrable , permiteEditar: categorias.editable});
    }
    catch(err) {
        console.log(err);
    }

});
// Rutas para agregar y editar categorías

//Ruta para cargar página que agregará una nueva categoría
router.get('/editar', logueado, async (req, res) => {

    const sqlItemsNomina = 'SELECT * FROM nomina ORDER BY Descripcion';
    
    try {
        const [ItemsNomina] = await pool.query(sqlItemsNomina);
        return render(req,res,'categoria', {ItemsNomina: ItemsNomina});
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

});

// Ruta para cargar página que  editara la categoría seleccionada   
router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM categorias WHERE Id = ?';
    const sqlItemsNomina = 'SELECT * FROM nomina ORDER BY Descripcion';
    const sqlItemsHabilitados = "SELECT nominahabilitada.IdCategoria, nominahabilitada.IdNomina, nomina.Id, nomina.Descripcion as Descripcion FROM nominahabilitada INNER JOIN nomina ON nominahabilitada.IdNomina = nomina.Id WHERE nominahabilitada.IdCategoria = ?";
    const items = [];
    try {
        const [categoria] = await pool.query(sql, [Id]);
        const [ItemsNomina] = await pool.query(sqlItemsNomina);
        const [itemsHabilitados] = await pool.query(sqlItemsHabilitados, [Id]);

        for (let i = 0; i < itemsHabilitados.length; i++) {
            items.push({itemId: itemsHabilitados[i].Id, itemDescripcion: itemsHabilitados[i].Descripcion});
        }

        return render(req,res,'categoria', { categoria: categoria[0], Id: Id, ItemsNomina: ItemsNomina, itemsHabilitados: items});
    } catch (error) {
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);

        return res.redirect('/categorias');
    }

});

//Ruta para agregar una nueva categoría
router.post('/editar', logueado, async (req, res) => {
    const {Descripcion, Area}= req.body;
    const itemsHabilitados = JSON.parse(req.body.Items);

    const iArea = parseInt(Area);
    const sql = "INSERT INTO categorias (Descripcion, Area) VALUES (?, ?)";
    const sqlItemsNomina = 'INSERT INTO nominahabilitada (IdCategoria, IdNomina) VALUES (?, ?)';


    try {
        let conn = await pool.getConnection();
        await conn.beginTransaction();
        const [result] = await conn.query(sql, [Descripcion, iArea]);
        const IdCategoria = result.insertId;
        for (let i = 0; i < itemsHabilitados.length; i++) {
            await conn.query(sqlItemsNomina, [IdCategoria, itemsHabilitados[i].itemId]);
        }
        conn.commit();
        enviarMensaje(req, res, 'Categoría agregada', 'La categoría se ha agregado correctamente', 'success');

    } catch (error) {
        // Handle the error here
        conn.rollback();
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }
    return res.redirect('/categorias');
});

//Ruta para editar una categoría
router.post('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const {Descripcion, Area}= req.body;
    const iArea = parseInt(Area);
    const itemsHabilitados = JSON.parse(req.body.Items);
    const sql = "UPDATE categorias SET Descripcion = ?, Area = ? WHERE Id = ?";
    const sqlItemsNomina = 'INSERT INTO nominahabilitada (IdCategoria, IdNomina) VALUES (?, ?)';

    console.log (itemsHabilitados);
    let conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM nominahabilitada WHERE IdCategoria = ?', [Id]);
        await pool.query(sql, [Descripcion, iArea, Id]);
        for (let i = 0; i < itemsHabilitados.length; i++) {
            await conn.query(sqlItemsNomina, [Id, itemsHabilitados[i].itemId]);
        }
        conn.commit();
        enviarMensaje(req, res, 'Categoría actualizada', 'La categoría se ha editado correctamente', 'success');
    } catch (error) {
        conn.rollback();
        // Handle the error here
        enviarMensaje(req, res, 'Error', error.message, 'error');
        console.error(error);
    }

    return res.redirect('/categorias');
});

router.post('/agregarItemAutorizado',logueado, async (req, res) => {
    const {IdCategoria, IdNomina}= req.body;
    const sql = 'INSERT INTO nominahabilitada (IdCategoria, IdNomina) VALUES (?, ?)';
    try {
        await pool.query(sql, [IdCategoria, IdNomina]);
    } catch (error) {
        // Handle the error here
        console.error(error);
    }

    return res.redirect('/categorias/editar/' + IdCategoria);
});

const multer = require('multer');
const ExcelJS = require('exceljs');
const upload = multer({ dest: 'uploads/' });
// ===================== RUTAS DE IMPORTACIÓN DESDE EXCEL =====================

// Página para seleccionar archivo y mapear campos
router.get('/importar', logueado, (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'Area', label: 'Área' }
    ];
    render(req, res, 'categoriasImportar', { campos });
});

// Recibe el archivo y muestra las columnas para mapear
router.post('/importar/preparar', logueado, upload.single('archivoExcel'), async (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'Area', label: 'Área' }
    ];
    const tieneEncabezado = req.body.tieneEncabezado === 'on';
    const modoImportacion = req.body.modoImportacion || 'agregar';
    if (!req.file) {
        enviarMensaje(req, res, 'Error', 'No se subió ningún archivo', 'error');
        return res.redirect('/categorias/importar');
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
    render(req, res, 'categoriasImportar', { campos, columnas, archivo: req.file.filename, tieneEncabezado, modoImportacion });
});

// Realiza la importación
router.post('/importar/ejecutar', logueado, async (req, res) => {
    const { Descripcion, Area, archivo, tieneEncabezado, modoImportacion } = req.body;
    if (!archivo) {
        enviarMensaje(req, res, 'Error', 'No se encontró el archivo para importar', 'error');
        return res.redirect('/categorias/importar');
    }
    const mapeo = {Descripcion: Descripcion, Area: Area};
    const campos = [ 'Descripcion', 'Area' ];
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
                Area: req.body['mapeo[Area]']
            };
        }
        if (!mapeoObj || !mapeoObj.Descripcion) {
            enviarMensaje(req, res, 'Error', 'No se recibieron los datos de mapeo de columnas. Intente nuevamente.', 'error');
            return res.redirect('/categorias/importar');
        }
        if (modoImportacion === 'sobreescribir') {
            await pool.query('DELETE FROM categorias');
            await pool.query('ALTER TABLE categorias AUTO_INCREMENT = 1');
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
                await pool.query('INSERT INTO categorias (Descripcion, Area) VALUES (?, ?)', values);
                insertados++;
            }
        }
        enviarMensaje(req, res, 'Importación finalizada', `Se importaron ${insertados} registros.`, 'success');
    } catch (err) {
        console.log(err);
        enviarMensaje(req, res, 'Error', err.message, 'error');
    }
    return res.redirect('/categorias');
});
// =================== FIN RUTAS DE IMPORTACIÓN DESDE EXCEL ===================

module.exports = router;