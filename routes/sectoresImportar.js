const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { logueado } = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1];

const upload = multer({ dest: 'uploads/' });

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

// Página para seleccionar archivo y mapear campos
router.get('/importar', logueado, (req, res) => {
    // Campos de la tabla sectores (excepto Id)
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'IdSupervisor', label: 'Supervisor' }
    ];
    render(req, res, 'sectoresImportar', { campos });
});

// Recibe el archivo y muestra las columnas para mapear
router.post('/importar/preparar', logueado, upload.single('archivoExcel'), (req, res) => {
    const campos = [
        { campo: 'Descripcion', label: 'Descripción' },
        { campo: 'IdSupervisor', label: 'Supervisor' }
    ];
    if (!req.file) {
        enviarMensaje(req, res, 'Error', 'No se subió ningún archivo', 'error');
        return res.redirect('/sectores/importar');
    }
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const columnas = data[0];
    render(req, res, 'sectoresImportar', { campos, columnas, archivo: req.file.filename });
});

// Realiza la importación
router.post('/importar/ejecutar', logueado, async (req, res) => {
    const { mapeo, archivo } = req.body;
    if (!archivo) {
        enviarMensaje(req, res, 'Error', 'No se encontró el archivo para importar', 'error');
        return res.redirect('/sectores/importar');
    }
    const campos = [ 'Descripcion', 'IdSupervisor' ];
    const workbook = xlsx.readFile('uploads/' + archivo);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    let insertados = 0;
    for (let row of data) {
        let values = [];
        for (let campo of campos) {
            const columna = mapeo[campo];
            values.push(row[columna] || null);
        }
        try {
            await pool.query('INSERT INTO sectores (Descripcion, IdSupervisor) VALUES (?, ?)', values);
            insertados++;
        } catch (err) {
            // Puedes manejar errores de fila aquí si lo deseas
        }
    }
    enviarMensaje(req, res, 'Importación finalizada', `Se importaron ${insertados} registros.`, 'success');
    return res.redirect('/sectores');
});

module.exports = router;
