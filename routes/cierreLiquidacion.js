const router = require('express').Router();
const { pool } = require('../conexion');
const { logueado } = require('../Middleware/validarUsuario');
const { render, confirmar } = require('../Middleware/render');

async function obtenerActual() {
  const [rows] = await pool.query("SELECT Id, DATE_FORMAT(Periodo, '%Y-%m-%d') AS Periodo FROM novedadese WHERE Actual = 1 LIMIT 1");
  return rows && rows[0] ? rows[0] : null;
}

router.get('/', logueado, async (req, res) => {
  const actual = await obtenerActual();
  if (!actual) {
    return render(req, res, 'liquidacionesProcesar', { Mensaje: { title: 'Atención', text: 'No hay período actual para cerrar.', icon: 'warning' } });
  }
  confirmar(
    req,
    res,
    `Vas a cerrar la liquidación del período ${actual.Periodo}. Se archivarán novedades, liquidaciones y ajustes. ¿Confirmás?`,
    `/cierreLiquidacion/confirmar`,
    '/liquidacionesProcesar/resultado'
  );
  return render(req, res, 'liquidacionesProcesar', { actual });
});

router.get('/confirmar', logueado, async (req, res) => {
  const actual = await obtenerActual();
  if (!actual) {
    return render(req, res, 'liquidacionesProcesar', { Mensaje: { title: 'Atención', text: 'No hay período actual para cerrar.', icon: 'warning' } });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const idE = actual.Id;
    // 1) Pasar novedadesr -> novedadesr_historico (si existe)
    try {
      await conn.query(
        `INSERT INTO novedadesr_historico (
          IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, GuardiasPasivas, Monto, IdGuardia, IdParcial, IdNomina, IdTurno, IdCategoria, IdEstado, ObservacionesEstado, IdSupervisor, MinutosAl50, MinutosAl100, MinutosGD, MinutosGN, Inicio, Fin, IdMotivo, IdReemplazo, Observaciones, CreadoPorAdmin
        )
        SELECT IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, GuardiasPasivas, Monto, IdGuardia, IdParcial, IdNomina, IdTurno, IdCategoria, IdEstado, ObservacionesEstado, IdSupervisor, MinutosAl50, MinutosAl100, MinutosGD, MinutosGN, Inicio, Fin, IdMotivo, IdReemplazo, Observaciones, CreadoPorAdmin
        FROM novedadesr WHERE IdNovedadesE = ?`,
        [idE]
      );
    } catch {}
    // 2) Pasar liquidaciones -> liquidaciones_historico
    await conn.query(
      `INSERT INTO liquidaciones_historico (IdNovedadesE, Area, Periodo, Sector, IdEmpleado, Detalle, Monto, Vale)
       SELECT IdNovedadesE, Area, Periodo, Sector, IdEmpleado, Detalle, Monto, Vale
       FROM liquidaciones WHERE IdNovedadesE = ?`,
      [idE]
    );
    // 3) Pasar ajustes -> ajustes_historico
    try {
      await conn.query(
        `INSERT INTO ajustes_historico (IdNovedadesE, IdEmpleado, Descripcion, Monto, IdUsuario, TimeStamp)
         SELECT ?, IdEmpleado, Descripcion, Monto, IdUsuario, TimeStamp
         FROM ajustes`,
        [idE]
      );
    } catch {}
    // 4) Eliminar datos de trabajo
    try { await conn.query('DELETE FROM novedadesr WHERE IdNovedadesE = ?', [idE]); } catch {}
    try { await conn.query('DELETE FROM liquidaciones WHERE IdNovedadesE = ?', [idE]); } catch {}
    try { await conn.query('DELETE FROM ajustes'); } catch {}
    // 5) Marcar novedadese como no-Actual
    await conn.query('UPDATE novedadese SET Actual = 0 WHERE Id = ?', [idE]);

    await conn.commit();
    return render(req, res, 'liquidacionesProcesar', { Mensaje: { title: 'Listo', text: `Liquidación del período ${actual.Periodo} cerrada correctamente.`, icon: 'success' } });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('Error en cierre de liquidación:', err);
    return render(req, res, 'liquidacionesProcesar', { Mensaje: { title: 'Error', text: 'No fue posible cerrar la liquidación.', icon: 'error' } });
  } finally {
    conn.release();
  }
});

module.exports = router;
