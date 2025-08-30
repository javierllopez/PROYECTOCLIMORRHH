const router = require('express').Router();
const { logueado } = require('../Middleware/validarUsuario');
const { pool } = require('../conexion');
const { render, confirmar } = require('../Middleware/render');
const sqlResultado = `
  SELECT 
    l.Area,
    l.Sector,
    s.Descripcion AS SectorNombre,
    l.IdEmpleado,
    p.ApellidoYNombre,
    l.Detalle,
    l.Monto,
    l.Vale
  FROM liquidaciones l
  LEFT JOIN sectores s ON s.Id = l.Sector
  LEFT JOIN personal p ON p.Id = l.IdEmpleado
  WHERE l.IdNovedadesE = ?
  ORDER BY FIELD(l.Area,'Administrativa','Operativa'), s.Descripcion, p.ApellidoYNombre
`;

async function obtenerResultado(actual) {
  const [rows] = await pool.query(sqlResultado, [actual.Id]);
  // Agrupar en memoria por Área y dentro de cada área por sector; calcular subtotales y totales
  const areas = [];
  const areasMap = new Map();
  const totalesPorArea = [];
  let totalGeneral = 0;

  for (const r of rows) {
    const areaKey = r.Area || 'Sin área';
    if (!areasMap.has(areaKey)) {
      const areaObj = { area: areaKey, grupos: [], subtotalArea: 0 };
      areaObj._sectoresMap = new Map(); // interno para acumular por sector
      areasMap.set(areaKey, areaObj);
      areas.push(areaObj);
    }
    const areaObj = areasMap.get(areaKey);

    const sectorKey = r.Sector || 0;
    if (!areaObj._sectoresMap.has(sectorKey)) {
      const sectorObj = { sectorId: sectorKey, sectorNombre: r.SectorNombre || 'Sin sector', items: [], subtotal: 0 };
      areaObj._sectoresMap.set(sectorKey, sectorObj);
      areaObj.grupos.push(sectorObj);
    }
    const g = areaObj._sectoresMap.get(sectorKey);
    const montoNum = Number(r.Monto) || 0;
    g.items.push({
      idEmpleado: r.IdEmpleado,
      apellidoYNombre: r.ApellidoYNombre || '-',
      detalle: r.Detalle || '',
      monto: montoNum,
      vale: r.Vale
    });
    g.subtotal += montoNum;
    areaObj.subtotalArea += montoNum;
    totalGeneral += montoNum;
  }

  // Armar totales por área y limpiar mapas internos
  for (const a of areas) {
    totalesPorArea.push({ area: a.area, total: a.subtotalArea });
    delete a._sectoresMap;
  }

  return { actual, areas, totalesPorArea, totalGeneral };
}

async function cargarModelo() {
  try {
  // Traer Periodo como string 'YYYY-MM-DD' para evitar corrimiento por huso horario
  const [rows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo, Observaciones FROM novedadese WHERE Actual = 1 LIMIT 1");
    if (!rows || rows.length === 0) {
      return { sinActual: true };
    }
    const actual = rows[0];
    let yaExiste = false;
    let siguienteVale = null;
    try {
      const [existeRows] = await pool.query('SELECT COUNT(*) AS total FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);
      yaExiste = (existeRows && existeRows[0] && Number(existeRows[0].total) > 0);
      if (yaExiste) {
        const [maxRows] = await pool.query('SELECT MAX(Vale) AS maxVale FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);
        const maxVale = maxRows && maxRows[0] && maxRows[0].maxVale ? Number(maxRows[0].maxVale) : null;
        if (Number.isFinite(maxVale)) siguienteVale = maxVale + 1;
      }
    } catch (e) {
      console.warn('No se pudo verificar liquidaciones existentes:', e.message);
    }
    return { actual, yaExiste, siguienteVale };
  } catch (err) {
    console.error(err);
    return { sinActual: true };
  }
}

async function procesarLiquidacion(actual, primerVale) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
  // Evitar truncado de GROUP_CONCAT si hay muchas fechas
  try { await conn.query('SET SESSION group_concat_max_len = 4096'); } catch {}

    // Borrar liquidaciones existentes para el período (reliquidación)
    await conn.query('DELETE FROM liquidaciones WHERE Periodo = ?', [actual.Periodo]);

    // Validar primer vale
    const inicioVale = Number(primerVale);
    if (!Number.isFinite(inicioVale) || inicioVale <= 0) {
      throw new Error('Debés indicar un número válido de primer vale (mayor a 0).');
    }

    // Preparar contador de vales (compatible con MySQL < 8, sin window functions)
    await conn.query('SET @rn := ? - 1', [inicioVale]);
    // Insertar agregados desde novedadesr del período actual, solo aceptadas (IdEstado = 5)
    await conn.query(
      `INSERT INTO liquidaciones (IdNovedadesE, Area, Periodo, Sector, IdEmpleado, Detalle, Monto, Vale)
       SELECT 
         t.IdNovedadesE,
         t.Area,
         t.Periodo,
         t.Sector,
         t.IdEmpleado,
         t.Detalle,
         t.Monto,
         (@rn := @rn + 1) AS Vale
       FROM (
         SELECT 
           e.Id AS IdNovedadesE,
           MIN(r.Area) AS Area,
           e.Periodo AS Periodo,
           r.IdSector AS Sector,
           r.IdEmpleado AS IdEmpleado,
           MIN(s.Descripcion) AS SectorNombre,
           MIN(p.ApellidoYNombre) AS ApellidoYNombre,
           CONCAT(
             GROUP_CONCAT(DATE_FORMAT(r.Fecha, '%d/%m') ORDER BY r.Fecha SEPARATOR ', '),
             CASE WHEN SUM(COALESCE(r.MinutosAl50,0)) > 0 
                  THEN CONCAT(' | Hs50: ', TIME_FORMAT(SEC_TO_TIME(SUM(COALESCE(r.MinutosAl50,0))*60), '%H:%i')) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.MinutosAl100,0)) > 0 
                  THEN CONCAT(' | Hs100: ', TIME_FORMAT(SEC_TO_TIME(SUM(COALESCE(r.MinutosAl100,0))*60), '%H:%i')) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.GuardiasDiurnas,0)) > 0 
                  THEN CONCAT(' | GD: ', ROUND(SUM(COALESCE(r.GuardiasDiurnas,0)),2)) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.GuardiasNocturnas,0)) > 0 
                  THEN CONCAT(' | GN: ', ROUND(SUM(COALESCE(r.GuardiasNocturnas,0)),2)) 
                  ELSE '' END,
             CASE WHEN SUM(COALESCE(r.GuardiasPasivas,0)) > 0 
                  THEN CONCAT(' | GP: ', ROUND(SUM(COALESCE(r.GuardiasPasivas,0)),2)) 
                  ELSE '' END
           ) AS Detalle,
           CAST(CEIL(SUM(COALESCE(r.Monto, 0)) / 10) * 10 AS DECIMAL(12,2)) AS Monto
         FROM novedadesr r
         INNER JOIN novedadese e ON e.Id = r.IdNovedadesE
         LEFT JOIN sectores s ON s.Id = r.IdSector
         LEFT JOIN personal p ON p.Id = r.IdEmpleado
         WHERE e.Id = ? AND r.IdEstado = 5
         GROUP BY e.Id, e.Periodo, r.IdSector, r.IdEmpleado
       ) AS t
       ORDER BY FIELD(t.Area,'Administrativa','Operativa'), t.SectorNombre, t.ApellidoYNombre, t.Sector, t.IdEmpleado`,
      [actual.Id]
    );

    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch {}
    // Propagar error más claro si falta la columna
    if (e && e.code === 'ER_BAD_FIELD_ERROR') {
      throw new Error('La tabla liquidaciones necesita la columna IdNovedadesE (y Periodo DATE). Ejecutá el script de alter en /sql para continuar.');
    }
    throw e;
  } finally {
    conn.release();
  }
}

// GET: muestra datos del período actual y botón para iniciar la liquidación
router.get('/', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  const { accion, forzar, primerVale } = req.query;
  if (!modelo.sinActual && accion === 'liquidar' && forzar === '1' && primerVale) {
    // Ejecutar directamente tras confirmación
    try {
  await procesarLiquidacion(modelo.actual, primerVale);
  const datos = await obtenerResultado(modelo.actual);
  return render(req, res, 'liquidacionesResultado', { ...datos, Mensaje: { title: 'Listo', text: 'Liquidación generada correctamente.', icon: 'success' } });
    } catch (err) {
      console.error('Error al procesar liquidación (GET):', err);
      const actualizado = await cargarModelo();
      const texto = err && err.message ? err.message : 'Ocurrió un problema al generar la liquidación.';
      return render(req, res, 'liquidacionesProcesar', { ...actualizado, Mensaje: { title: 'Error', text: texto, icon: 'error' } });
    }
  }
  // Mostrar alerta para pedir primer vale si viene accion=liquidar&forzar=1 sin número
  if (!modelo.sinActual && accion === 'liquidar' && forzar === '1' && !primerVale) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, pedirVale: true });
  }
  return render(req, res, 'liquidacionesProcesar', modelo);
});

// GET: consulta de la liquidación actual (solo visualizar resultados)
router.get('/resultado', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para consultar.', icon: 'warning' } });
  }
  try {
    const datos = await obtenerResultado(modelo.actual);
    return render(req, res, 'liquidacionesResultado', datos);
  } catch (err) {
    console.error('Error al obtener resultados de liquidación actual:', err);
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Error', text: 'No fue posible obtener la liquidación actual.', icon: 'error' } });
  }
});

// POST: procesa liquidación agrupando por Sector y Legajo y acumulando Monto
router.post('/', logueado, async (req, res) => {
  const modelo = await cargarModelo();
  if (modelo.sinActual) {
    return render(req, res, 'liquidacionesProcesar', { ...modelo, Mensaje: { title: 'Atención', text: 'No hay período actual para liquidar.', icon: 'warning' } });
  }

  const { actual } = modelo;

  // Verificar si hay novedades pendientes (IdEstado < 5)
  const [pendRows] = await pool.query('SELECT COUNT(*) AS total FROM novedadesr WHERE IdNovedadesE = ? AND IdEstado < 5', [actual.Id]);
  const pendientes = pendRows && pendRows[0] ? Number(pendRows[0].total) : 0;
  const forzar = req.query.forzar === '1' || req.body.forzar === '1';
  const primerVale = req.body.primerVale;
  if (pendientes > 0 && !forzar) {
    confirmar(
      req,
      res,
      `Existen ${pendientes} novedades con estado pendiente (IdEstado < 5). ¿Deseás continuar con la liquidación igualmente?`,
      `/liquidacionesProcesar?accion=liquidar&forzar=1${req.body.primerVale ? `&primerVale=${encodeURIComponent(req.body.primerVale)}` : ''}`,
      '/liquidacionesProcesar'
    );
    // Render inmediato para mostrar el diálogo de confirmación sin perder el primerVale
    return render(req, res, 'liquidacionesProcesar', modelo);
  }

  try {
    if (!primerVale) {
      // Mostrar alerta para pedir primer vale desde POST también
      return render(req, res, 'liquidacionesProcesar', { ...modelo, pedirVale: true, Mensaje: { title: 'Falta dato', text: 'Indicá el número del primer vale.', icon: 'warning' } });
    }
  await procesarLiquidacion(actual, primerVale);
  const datos = await obtenerResultado(actual);
  return render(req, res, 'liquidacionesResultado', { ...datos, Mensaje: { title: 'Listo', text: 'Liquidación generada correctamente.', icon: 'success' } });
  } catch (err) {
    console.error('Error al procesar liquidación:', err);
    const modeloError = await cargarModelo();
    const texto = err && err.message ? err.message : 'Ocurrió un problema al generar la liquidación.';
    return render(req, res, 'liquidacionesProcesar', { ...modeloError, Mensaje: { title: 'Error', text: texto, icon: 'error' } });
  }
});

module.exports = router;
