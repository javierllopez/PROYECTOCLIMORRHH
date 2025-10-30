const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { pool } = require('../conexion');
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

// Middlewares de acceso específicos para evitar redirecciones en endpoints JSON
function requiereAdmin(req, res, next) {
  if (!req.session || !req.session.usuario) return res.redirect('/login');
  if (!nivelesPermitidos.includes(req.session.nivelUsuario)) return res.redirect('/');
  return next();
}

function requiereAdminJson(req, res, next) {
  if (!req.session || !req.session.usuario) return res.status(401).json({ error: 'no-autorizado' });
  if (!nivelesPermitidos.includes(req.session.nivelUsuario)) return res.status(403).json({ error: 'sin-permiso' });
  return next();
}

router.get('/', requiereAdmin, (req, res) => {
  return render(req, res, 'novedadesImportar', {});
});

// --- Gestión de trabajos (background) para evitar timeouts y mejorar UX
const { randomUUID } = require('crypto');
const trabajos = new Map(); // id -> estado

function crearTrabajo() {
  const id = randomUUID();
  const t = {
    id,
    estado: 'pendiente', // pendiente | procesando | terminado | error
    columnas: [],
    totalFilas: 0,
    procesadas: 0,
    vacias: 0,
    errores: 0,
    // contadores de tratamiento de datos
    liqsEncontradas: 0,
    liqsCreadas: 0,
    personasEncontradas: 0,
    personasNoEncontradas: 0,
    preparadas: 0,
    // validación de horas
    horas50Validas: 0,
    horas50Invalidas: 0,
    horas100Validas: 0,
    horas100Invalidas: 0,
    ejemploFilas: [],
    mensaje: null,
    error: null,
    iniciadoEn: Date.now(),
    finalizadoEn: null,
  };
  trabajos.set(id, t);
  return t;
}

function actualizarTrabajo(id, patch) {
  const t = trabajos.get(id);
  if (t) Object.assign(t, patch);
  return trabajos.get(id);
}

setInterval(() => {
  const ahora = Date.now();
  for (const [id, t] of trabajos.entries()) {
    if (t.finalizadoEn && (ahora - t.finalizadoEn) > 60 * 60 * 1000) {
      trabajos.delete(id);
    }
  }
}, 10 * 60 * 1000);

// Inicia la importación en background
router.post('/', requiereAdmin, (req, res) => {
  upload.single('archivoNovedades')(req, res, async (error) => {
    if (error) {
      enviarMensaje(req, res, 'Importación de novedades', error.message, 'error');
      return res.redirect('/novedades/importar');
    }

    if (!req.file) {
      enviarMensaje(req, res, 'Importación de novedades', 'Seleccioná un archivo de Excel para continuar.', 'warning');
      return res.redirect('/novedades/importar');
    }

    const sobrescribir = req.body.sobrescribir === 'on';

    const trabajo = crearTrabajo();
    actualizarTrabajo(trabajo.id, { estado: 'procesando' });

    setImmediate(() => {
      procesarExcelNovedades({ ruta: req.file.path, sobrescribir, trabajoId: trabajo.id })
        .catch(err => {
          actualizarTrabajo(trabajo.id, { estado: 'error', error: err.message, finalizadoEn: Date.now() });
        });
    });

    return res.redirect(`/novedades/importar/estado/${trabajo.id}`);
  });
});

// Vista de estado (HTML)
router.get('/estado/:id', requiereAdmin, (req, res) => {
  const { id } = req.params;
  const t = trabajos.get(id);
  if (!t) {
    enviarMensaje(req, res, 'Importación de novedades', 'No se encontró el proceso solicitado.', 'error');
    return res.redirect('/novedades/importar');
  }
  return render(req, res, 'novedadesImportarEstado', { trabajoId: id });
});

// Endpoint JSON para polling
router.get('/estado/:id.json', requiereAdminJson, (req, res) => {
  const { id } = req.params;
  const t = trabajos.get(id);
  if (!t) return res.status(404).json({ error: 'Trabajo no encontrado' });
  return res.json({
    id: t.id,
    estado: t.estado,
    columnas: t.columnas,
    totalFilas: t.totalFilas,
    procesadas: t.procesadas,
    vacias: t.vacias,
    errores: t.errores,
    liqsEncontradas: t.liqsEncontradas,
    liqsCreadas: t.liqsCreadas,
    personasEncontradas: t.personasEncontradas,
    personasNoEncontradas: t.personasNoEncontradas,
    preparadas: t.preparadas,
    insertadosHistorico: t.insertadosHistorico,
    omitidosPorMotivo: t.omitidosPorMotivo,
    horas50Validas: t.horas50Validas,
    horas50Invalidas: t.horas50Invalidas,
    horas100Validas: t.horas100Validas,
    horas100Invalidas: t.horas100Invalidas,
    ejemploFilas: t.ejemploFilas,
    mensaje: t.mensaje,
    error: t.error,
    finalizado: t.estado === 'terminado' || t.estado === 'error'
  });
});

// Worker: lee el Excel, detecta columnas y recorre filas (sin escribir en DB aún)
async function procesarExcelNovedades({ ruta, sobrescribir, trabajoId }) {
  const workbook = new ExcelJS.Workbook();

  const normalizarHeader = (valor) => {
    if (valor === undefined || valor === null) return '';
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'object' && valor.text) return String(valor.text).trim();
    return String(valor).trim();
  };
  const extraerValorCelda = (valor) => {
    if (valor === undefined || valor === null) return null;
    if (valor instanceof Date) return valor; // dejamos Date; el tratamiento vendrá luego
    if (typeof valor === 'object') {
      if (valor.text !== undefined) return String(valor.text).trim();
      if (Array.isArray(valor.richText)) return valor.richText.map(p => p.text).join('').trim();
      if (valor.result !== undefined && valor.result !== null) return valor.result;
    }
    if (typeof valor === 'string') return valor.trim();
    return valor;
  };

  // Helpers de período y formateo
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const toPeriodoSql = (valor) => {
    if (valor == null) return null;
    if (valor instanceof Date && !isNaN(valor)) {
      const y = valor.getUTCFullYear();
      const m = valor.getUTCMonth() + 1;
      return `${y}-${pad2(m)}-01`;
    }
    const s = String(valor).trim();
    // soportar mm/yyyy o m/yyyy
    const m1 = s.match(/^([0-1]?\d)\/(\d{4})$/);
    if (m1) {
      const m = Math.max(1, Math.min(12, parseInt(m1[1], 10)));
      const y = parseInt(m1[2], 10);
      return `${y}-${pad2(m)}-01`;
    }
    // soportar yyyy-mm-dd
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) {
      const y = parseInt(m2[1], 10);
      const m = parseInt(m2[2], 10);
      return `${y}-${pad2(m)}-01`;
    }
    return null;
  };

  try {
    await workbook.xlsx.readFile(ruta);
    const ws = workbook.worksheets[0];
    if (!ws) throw new Error('No se encontró ninguna hoja en el archivo.');

    // Encabezados
    const headers = [];
    ws.getRow(1).eachCell((cell) => headers.push(normalizarHeader(cell.value)));
    actualizarTrabajo(trabajoId, { columnas: headers });

    let total = 0, procesadas = 0, vacias = 0, errores = 0;
    let liqsEncontradas = 0, liqsCreadas = 0, personasEncontradas = 0, personasNoEncontradas = 0, preparadas = 0;
    let insertadosHistorico = 0;
    let horas50Validas = 0, horas50Invalidas = 0, horas100Validas = 0, horas100Invalidas = 0;
    const omitidosPorMotivo = {};
    const ejemplo = [];

    // Identificar índice de columnas clave
    const idxPeriodo = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'periodo' || h.toLowerCase() === 'período');
      return i >= 0 ? i : 0; // fallback primera columna
    })();
    const idxLegajo = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'legajo');
      if (i >= 0) return i;
      // fallback a columna 17 (index 16)
      return 16;
    })();
    const idxArea = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'area');
      return i >= 0 ? i : 1; // columna 2
    })();
    const idxSector2 = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'sector 2');
      return i >= 0 ? i : 2; // columna 3
    })();
    const idxFecha = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'fecha');
      return i >= 0 ? i : 4; // columna 5
    })();
    const idxHs50 = (() => {
      const i = headers.findIndex(h => h.toLowerCase().includes('hs al 50'));
      return i >= 0 ? i : 5; // columna 6
    })();
    const idxHs100 = (() => {
      const i = headers.findIndex(h => h.toLowerCase().includes('hs al 100'));
      return i >= 0 ? i : 6; // columna 7
    })();
    const idxGD = (() => {
      const i = headers.findIndex(h => h.toLowerCase().includes('guardias diurnas'));
      return i >= 0 ? i : 7; // columna 8
    })();
    const idxGN = (() => {
      const i = headers.findIndex(h => h.toLowerCase().includes('guardias nocturnas'));
      return i >= 0 ? i : 8; // columna 9
    })();
    const idxGP = (() => {
      const i = headers.findIndex(h => h.toLowerCase().includes('guardias pasivas'));
      return i >= 0 ? i : 9; // columna 10
    })();
    const idxMonto = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'monto');
      return i >= 0 ? i : 10; // columna 11
    })();
    const idxMotivo = (() => {
      const i = headers.findIndex(h => h.toLowerCase() === 'motivo');
      return i >= 0 ? i : 11; // columna 12
    })();

    // Conexión DB y caches
    const conn = await pool.getConnection();
    try {
      const cachePeriodo = new Map(); // 'YYYY-MM' -> IdNovedadesE
      const cacheLegajo = new Map();  // legajo(string) -> { Id, IdTurno, IdCategoria }
      const cacheSector = new Map();  // descripcion -> { Id, IdSupervisor }
      const cacheMotivo = new Map();  // descripcion -> Id

      const sqlSelNovedadesE = 'SELECT Id FROM novedadese WHERE YEAR(Periodo)=? AND MONTH(Periodo)=? LIMIT 1';
      const sqlInsNovedadesE = 'INSERT INTO novedadese (Periodo, Observaciones, Actual) VALUES (?, ?, 0)';
      const sqlSelPersonal = 'SELECT Id, IdTurno, IdCategoria FROM personal WHERE Legajo = ? LIMIT 1';
      const sqlSelSector = 'SELECT Id, IdSupervisor FROM sectores WHERE Descripcion = ? LIMIT 1';
      const sqlSelMotivo = 'SELECT Id FROM motivos WHERE Descripcion = ? LIMIT 1';
      const sqlInsMotivo = 'INSERT INTO motivos (Descripcion, InformaReemplazo, DescripcionObligatoria, TieneSubmotivos) VALUES (?, 0, 0, 0)';
      const sqlSelSectorNoDef = "SELECT Id, IdSupervisor FROM sectores WHERE Descripcion = 'NO DEFINIDO' LIMIT 1";
      const sqlInsSectorNoDef = "INSERT INTO sectores (Descripcion) VALUES ('NO DEFINIDO')";
      // Insert histórico: cubrimos las columnas NOT NULL (incluye IdNomina e IdSupervisor)
      // Campos opcionales permanecen NULL (IdGuardia, IdParcial, Inicio, Fin, IdReemplazo, Observaciones, CreadoPorAdmin)
      const sqlInsHistorico = `INSERT INTO novedadesr_historico (
        IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, GuardiasPasivas, Monto,
        IdNomina, IdTurno, IdCategoria, IdEstado, ObservacionesEstado, IdSupervisor, MinutosAl50, MinutosAl100, MinutosGD, MinutosGN, IdMotivo
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // saltar encabezado
        total++;
        try {
          const obj = {};
          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber - 1] || `Columna ${colNumber}`;
            obj[key] = extraerValorCelda(cell.value);
          });
          const esVacia = Object.values(obj).every(v => v === null || v === '' || v === undefined);
          if (esVacia) {
            vacias++;
          } else {
            procesadas++;
            if (ejemplo.length < 5) ejemplo.push(obj);
          }
        } catch (e) {
          errores++;
        }
      });

      // Utilidades de parseo
      const toDateSql = (valor) => {
        if (valor == null) return null;
        if (valor instanceof Date && !isNaN(valor)) return valor.toISOString().slice(0, 10);
        const s = String(valor).trim();
        // dd/mm/yyyy
        const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m1) {
          const d = parseInt(m1[1], 10), m = parseInt(m1[2], 10), y = parseInt(m1[3], 10);
          const dt = new Date(Date.UTC(y, m - 1, d));
          return dt.toISOString().slice(0, 10);
        }
        // yyyy-mm-dd
        const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m2) {
          const y = parseInt(m2[1], 10), m = parseInt(m2[2], 10), d = parseInt(m2[3], 10);
          const dt = new Date(Date.UTC(y, m - 1, d));
          return dt.toISOString().slice(0, 10);
        }
        return null;
      };
      const toTiempoStrYMin = (valor) => {
        // Acepta 'hh:mm' como string, Date (usa horas/minutos UTC) o numérico Excel (fracción del día)
        if (valor == null || valor === '') return { str: null, min: null };
        // Date de Excel
        if (valor instanceof Date && !isNaN(valor)) {
          const hh = valor.getUTCHours();
          const mm = valor.getUTCMinutes();
          return { str: `${pad2(hh)}:${pad2(mm)}`, min: hh * 60 + mm };
        }
        // Numérico Excel (fracción de día)
        if (typeof valor === 'number' && isFinite(valor)) {
          const totalMin = Math.round(valor * 24 * 60);
          const hh = Math.floor(totalMin / 60);
          const mm = totalMin % 60;
          return { str: `${pad2(hh)}:${pad2(mm)}`, min: totalMin };
        }
        // String 'hh:mm'
        if (typeof valor === 'string') {
          const s = valor.trim();
          const m = s.match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return { str: null, min: null };
          const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
          return { str: `${pad2(hh)}:${pad2(mm)}`, min: hh * 60 + mm };
        }
        return { str: null, min: null };
      };

      // Segundo recorrido: tratamiento (separado para simplificar manejo async)
      for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
        const row = ws.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;
        // Obtener Periodo y Legajo por índice para robustez
        const valorPeriodo = extraerValorCelda(row.getCell(idxPeriodo + 1)?.value);
        const periodoSql = toPeriodoSql(valorPeriodo);
        if (!periodoSql) { errores++; omitidosPorMotivo['periodo inválido'] = (omitidosPorMotivo['periodo inválido'] || 0) + 1; continue; }

        const key = periodoSql.slice(0, 7); // YYYY-MM
        let idNovedadesE = cachePeriodo.get(key);
        if (idNovedadesE === undefined) {
          const year = Number(key.slice(0, 4));
          const month = Number(key.slice(5, 7));
          const [rows] = await conn.query(sqlSelNovedadesE, [year, month]);
          if (rows.length > 0) {
            idNovedadesE = rows[0].Id;
            cachePeriodo.set(key, idNovedadesE);
            liqsEncontradas++;
          } else {
            const obs = `Novedades del período ${key.slice(5, 7)}/${key.slice(0, 4)}`;
            const [ins] = await conn.query(sqlInsNovedadesE, [periodoSql, obs]);
            idNovedadesE = ins.insertId;
            cachePeriodo.set(key, idNovedadesE);
            liqsCreadas++;
          }
        }

        // Legajo
        const valorLegajo = extraerValorCelda(row.getCell(idxLegajo + 1)?.value);
        const legajoStr = valorLegajo === null || valorLegajo === undefined ? '' : String(valorLegajo).trim();
        let idPersonal, idTurnoPers = null, idCategoriaPers = null;
        if (!legajoStr) {
          idPersonal = null;
          personasNoEncontradas++;
          omitidosPorMotivo['legajo vacío'] = (omitidosPorMotivo['legajo vacío'] || 0) + 1;
        } else if (cacheLegajo.has(legajoStr)) {
          const pers = cacheLegajo.get(legajoStr);
          idPersonal = pers ? pers.Id : null;
          idTurnoPers = pers ? pers.IdTurno : null;
          idCategoriaPers = pers ? pers.IdCategoria : null;
        } else {
          const [persRows] = await conn.query(sqlSelPersonal, [legajoStr]);
          if (persRows.length > 0) {
            idPersonal = persRows[0].Id;
            idTurnoPers = persRows[0].IdTurno;
            idCategoriaPers = persRows[0].IdCategoria;
            cacheLegajo.set(legajoStr, { Id: idPersonal, IdTurno: idTurnoPers, IdCategoria: idCategoriaPers });
            personasEncontradas++;
          } else {
            idPersonal = null;
            cacheLegajo.set(legajoStr, null);
            personasNoEncontradas++;
            omitidosPorMotivo['empleado no encontrado'] = (omitidosPorMotivo['empleado no encontrado'] || 0) + 1;
          }
        }

        // Si no hay empleado válido, no se puede continuar con inserción
        if (!idPersonal) { errores++; continue; }

        // Area
        const areaRaw = extraerValorCelda(row.getCell(idxArea + 1)?.value);
        const areaStr = (areaRaw ? String(areaRaw).trim().toUpperCase() : '');
        const areaEnum = (areaStr === 'ADMINISTRACION' || areaStr === 'ADMINISTRACIÓN') ? 'Administrativa' : 'Operativa';

        // Sector por descripción
        const sectorDesc = extraerValorCelda(row.getCell(idxSector2 + 1)?.value);
        let idSector = null, idSupervisor = 0;
        if (sectorDesc && cacheSector.has(sectorDesc)) {
          const s = cacheSector.get(sectorDesc);
          idSector = s.Id; idSupervisor = s.IdSupervisor || 0;
        } else if (sectorDesc) {
          const [secRows] = await conn.query(sqlSelSector, [sectorDesc]);
          if (secRows.length > 0) {
            idSector = secRows[0].Id;
            idSupervisor = secRows[0].IdSupervisor || 0;
            cacheSector.set(sectorDesc, { Id: idSector, IdSupervisor: idSupervisor });
          } else {
            // Crear/usar NO DEFINIDO
            let sdef = cacheSector.get('NO DEFINIDO');
            if (!sdef) {
              let [defRows] = await conn.query(sqlSelSectorNoDef);
              if (defRows.length === 0) {
                await conn.query(sqlInsSectorNoDef);
                [defRows] = await conn.query(sqlSelSectorNoDef);
              }
              sdef = { Id: defRows[0].Id, IdSupervisor: defRows[0].IdSupervisor || 0 };
              cacheSector.set('NO DEFINIDO', sdef);
            }
            idSector = sdef.Id;
            idSupervisor = sdef.IdSupervisor || 0;
            // y registramos el sector desconocido como mapeado a NO DEFINIDO en cache para próximas filas
            cacheSector.set(sectorDesc, sdef);
          }
        } else {
          // sin sector: usar NO DEFINIDO
          let sdef = cacheSector.get('NO DEFINIDO');
          if (!sdef) {
            let [defRows] = await conn.query(sqlSelSectorNoDef);
            if (defRows.length === 0) {
              await conn.query(sqlInsSectorNoDef);
              [defRows] = await conn.query(sqlSelSectorNoDef);
            }
            sdef = { Id: defRows[0].Id, IdSupervisor: defRows[0].IdSupervisor || 0 };
            cacheSector.set('NO DEFINIDO', sdef);
          }
          idSector = sdef.Id;
          idSupervisor = sdef.IdSupervisor || 0;
        }

        // Fecha
        const fechaVal = extraerValorCelda(row.getCell(idxFecha + 1)?.value);
        const fechaSql = toDateSql(fechaVal);
        if (!fechaSql) { errores++; omitidosPorMotivo['fecha inválida'] = (omitidosPorMotivo['fecha inválida'] || 0) + 1; continue; }

        // Horas 50/100 y minutos
        const vHs50 = extraerValorCelda(row.getCell(idxHs50 + 1)?.value);
        const vHs100 = extraerValorCelda(row.getCell(idxHs100 + 1)?.value);
        const hs50 = toTiempoStrYMin(vHs50);
        const hs100 = toTiempoStrYMin(vHs100);
        // Validación de horas: sólo contamos filas con dato informado
        if (vHs50 !== null && vHs50 !== '') {
          if (hs50.min != null) horas50Validas++; else horas50Invalidas++;
        }
        if (vHs100 !== null && vHs100 !== '') {
          if (hs100.min != null) horas100Validas++; else horas100Invalidas++;
        }

        // Guardias y monto
        const gdRaw = extraerValorCelda(row.getCell(idxGD + 1)?.value);
        const gnRaw = extraerValorCelda(row.getCell(idxGN + 1)?.value);
        const gpRaw = extraerValorCelda(row.getCell(idxGP + 1)?.value);
        const montoRaw = extraerValorCelda(row.getCell(idxMonto + 1)?.value);
        const gd = (gdRaw === null || gdRaw === '') ? null : Number(gdRaw);
        const gn = (gnRaw === null || gnRaw === '') ? null : Number(gnRaw);
        const gp = (gpRaw === null || gpRaw === '') ? null : Number(gpRaw);
        const monto = (montoRaw === null || montoRaw === '') ? null : Number(montoRaw);

        const minutosGD = gd != null ? Math.round(gd * 420) : null;
        const minutosGN = gn != null ? Math.round(gn * 600) : null;

        // Motivo
        const motivoDescRaw = extraerValorCelda(row.getCell(idxMotivo + 1)?.value);
        const motivoDesc = motivoDescRaw == null ? '' : String(motivoDescRaw).trim();
        let idMotivo = null;
        if (motivoDesc) {
          if (cacheMotivo.has(motivoDesc)) {
            idMotivo = cacheMotivo.get(motivoDesc);
          } else {
            const [mRows] = await conn.query(sqlSelMotivo, [motivoDesc]);
            if (mRows.length > 0) {
              idMotivo = mRows[0].Id;
              cacheMotivo.set(motivoDesc, idMotivo);
            } else {
              const [insM] = await conn.query(sqlInsMotivo, [motivoDesc]);
              idMotivo = insM.insertId;
              cacheMotivo.set(motivoDesc, idMotivo);
            }
          }
        }

        // IdTurno / IdCategoria desde personal
        const idTurno = idTurnoPers != null ? idTurnoPers : null;
        const idCategoria = idCategoriaPers != null ? idCategoriaPers : null;
        if (idTurno == null || idCategoria == null) { errores++; omitidosPorMotivo['datos empleado incompletos'] = (omitidosPorMotivo['datos empleado incompletos'] || 0) + 1; continue; }

        // Insertar en historico
        const valores = [
          cachePeriodo.get(periodoSql.slice(0,7)), // IdNovedadesE garantizado arriba en cache
          areaEnum,
          idSector,
          idPersonal,
          fechaSql,
          hs50.str,
          hs100.str,
          gd,
          gn,
          gp,
          monto,
          0, // IdNomina (no disponible en importación, se utiliza 0 como valor neutro)
          idTurno,
          idCategoria,
          6, // IdEstado = 6
          'Datos importados',
          idSupervisor || 0, // IdSupervisor requerido por esquema
          hs50.min,
          hs100.min,
          minutosGD,
          minutosGN,
          idMotivo,
        ];

        try {

          await conn.query(sqlInsHistorico, valores);
          console.log(' --- INSERCIÓN HISTÓRICO --- ');
          console.log('Valores:', valores);
          insertadosHistorico++;
        } catch (e) {
          // Si por restricciones NOT NULL de algún campo ignorado fallara, lo contamos como omitido
          console.log('Error inserción histórico:', e);
          const clave = 'error inserción (restricción)';
          omitidosPorMotivo[clave] = (omitidosPorMotivo[clave] || 0) + 1;
          errores++;
          continue;
        }
        preparadas++;

        if (preparadas % 50 === 0) {
          actualizarTrabajo(trabajoId, {
            totalFilas: total,
            procesadas,
            vacias,
            errores,
            liqsEncontradas,
            liqsCreadas,
            personasEncontradas,
            personasNoEncontradas,
            preparadas,
            horas50Validas,
            horas50Invalidas,
            horas100Validas,
            horas100Invalidas
          });
        }
      }

      actualizarTrabajo(trabajoId, { liqsEncontradas, liqsCreadas, personasEncontradas, personasNoEncontradas, preparadas });
    } finally {
      conn.release();
    }

    // Armar resumen omitidos
    const clavesOmitidos = Object.keys(omitidosPorMotivo);
    let resumenOmitidos = 'Ninguno';
    if (clavesOmitidos.length) {
      resumenOmitidos = clavesOmitidos.map(k => `${k}: ${omitidosPorMotivo[k]}`).join(' | ');
    }
    const totalTratados = procesadas; // filas no vacías recorridas
    const mensaje = `Archivo leído: ${total} filas (procesadas: ${procesadas}, vacías: ${vacias}, errores: ${errores}). Insertados en histórico: ${insertadosHistorico}. Omitidos por motivo: ${resumenOmitidos}. Total tratados: ${totalTratados}. Columnas detectadas: ${headers.join(', ')}.`;
    actualizarTrabajo(trabajoId, {
      estado: 'terminado',
      totalFilas: total,
      procesadas,
      vacias,
      errores,
      liqsEncontradas,
      liqsCreadas,
      personasEncontradas,
      personasNoEncontradas,
      preparadas,
      insertadosHistorico,
      omitidosPorMotivo,
      horas50Validas,
      horas50Invalidas,
      horas100Validas,
      horas100Invalidas,
      ejemploFilas: ejemplo,
      mensaje,
      finalizadoEn: Date.now(),
    });
  } catch (err) {
    actualizarTrabajo(trabajoId, { estado: 'error', error: err.message, finalizadoEn: Date.now() });
  } finally {
    try { await fs.unlink(ruta); } catch (_) { }
  }
}

module.exports = router;
