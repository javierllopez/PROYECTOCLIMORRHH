const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const { logueado } = require('../Middleware/validarUsuario');
const { render, enviarMensaje } = require('../Middleware/render');

const router = express.Router();
const nivelesPermitidos = [1];

const almacenamiento = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname) || '.xlsx';
    cb(null, `novedades-import-${Date.now()}${extension}`);
  }
});

const upload = multer({
  storage: almacenamiento,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls'].includes(extension)) {
      return cb(new Error('Formato de archivo inválido. Solo se permiten archivos Excel (.xlsx o .xls).'));
    }
    cb(null, true);
  }
});

router.all('*', logueado, (req, res, next) => {
  if (nivelesPermitidos.includes(req.session.nivelUsuario)) {
    return next();
  }
  return res.redirect('/');
});

router.get('/', (req, res) => {
  return render(req, res, 'novedadesImportar', {});
});

router.post('/', (req, res) => {
  upload.single('archivoNovedades')(req, res, async (error) => {
    if (error) {
      enviarMensaje(req, res, 'Importación de novedades', error.message, 'error');
      return res.redirect('/novedades/importar');
    }

    if (!req.file) {
      enviarMensaje(req, res, 'Importación de novedades', 'Seleccioná un archivo de Excel para continuar.', 'warning');
      return res.redirect('/novedades/importar');
    }

    try {
      await fs.unlink(req.file.path);
    } catch (_) {
      // Si no se puede eliminar el archivo temporal no interrumpimos el flujo.
    }

    const sobrescribir = req.body.sobrescribir === 'on';
    const mensajeDetalle = sobrescribir
      ? 'Se reemplazarán los datos existentes del período seleccionado.'
      : 'Los datos se incorporarán respetando la información existente.';

    enviarMensaje(
      req,
      res,
      'Importación en preparación',
      `El archivo "${req.file.originalname}" se recibió correctamente. ${mensajeDetalle} Esta funcionalidad estará disponible en una próxima versión.`,
      'info'
    );
    return res.redirect('/novedades/importar');
  });
});

module.exports = router;
