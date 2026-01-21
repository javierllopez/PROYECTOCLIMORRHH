const { FechaHTMLaFecha, fechaHoraLocalAUtc, FechaASqlFecha } = require('./libreria');

const ESTADO_PROGRAMADA = 'programada';
const ESTADO_ACTIVA = 'activa';
const ESTADO_FINALIZADA = 'finalizada';
const MOTIVO_MANUAL = 'delegacion_manual';
const MOTIVO_PROGRAMADA = 'delegacion_programada';
const MOTIVO_RESTAURACION = 'restauracion';

const toMysqlDateTime = (date) => {
  if (!date) return null;
  return FechaASqlFecha(date);
};

const buildRange = (desdeStr, hastaStr) => {
  const fechaInicio = FechaHTMLaFecha(desdeStr);
  if (!fechaInicio) {
    throw new Error('La fecha de inicio es obligatoria.');
  }
  const fechaFin = hastaStr ? FechaHTMLaFecha(hastaStr) : null;
  if (fechaFin && fechaFin < fechaInicio) {
    throw new Error('La fecha de finalización debe ser mayor o igual a la fecha de inicio.');
  }
  const inicioUtc = fechaHoraLocalAUtc(fechaInicio, '00:00');
  const finUtc = fechaFin ? fechaHoraLocalAUtc(fechaFin, '23:59') : null;
  if (finUtc) {
    finUtc.setSeconds(finUtc.getSeconds() + 59);
  }
  return {
    inicioUtc,
    finUtc,
    inicioSql: toMysqlDateTime(inicioUtc),
    finSql: finUtc ? toMysqlDateTime(finUtc) : null,
  };
};

const validarDisponibilidad = async (conn, { supervisorId, delegadoId, inicioSql, finSql }) => {
  const finEvaluacion = finSql || '2999-12-31 23:59:59';
  const [rows] = await conn.query(
    `SELECT id FROM delegaciones_supervisor
     WHERE estado IN ('programada', 'activa')
       AND (supervisor_id = ? OR delegado_id = ?)
       AND (? <= IFNULL(fecha_hasta, '2999-12-31 23:59:59'))
       AND (IFNULL(?, '2999-12-31 23:59:59') >= fecha_desde)
     LIMIT 1`,
    [supervisorId, delegadoId, inicioSql, finSql]
  );
  if (rows.length) {
    throw new Error('Existe otra delegación activa o programada que se solapa en las fechas seleccionadas.');
  }
};

const obtenerUsuario = async (conn, idUsuario, { requireActivo = true } = {}) => {
  const [[usuario]] = await conn.query('SELECT Id, Nivel, Activo FROM usuarios WHERE Id = ?', [idUsuario]);
  if (!usuario || (requireActivo && !usuario.Activo)) {
    throw new Error('El usuario seleccionado no está activo.');
  }
  return usuario;
};

const registrarAudit = async (conn, {
  usuarioId,
  rolAnterior,
  rolNuevo,
  motivo,
  referencia,
  supervisorOriginalId,
  fechaDesde,
  fechaHasta,
  ejecutadoPor,
  ipOrigen,
  userAgent,
}) => {
  await conn.query(
    `INSERT INTO audit_roles
     (usuario_id, rol_anterior, rol_nuevo, motivo, referencia, supervisor_original_id, fecha_desde, fecha_hasta, ejecutado_por, ip_origen, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuarioId,
      String(rolAnterior),
      String(rolNuevo),
      motivo,
      referencia,
      supervisorOriginalId || null,
      fechaDesde || null,
      fechaHasta || null,
      ejecutadoPor || null,
      ipOrigen || null,
      userAgent || null,
    ]
  );
};

const crearDelegacion = async (pool, {
  supervisorId,
  delegadoUsuarioId,
  fechaDesde,
  fechaHasta,
  ejecutadoPor,
  ipOrigen,
  userAgent,
}) => {
  if (supervisorId === delegadoUsuarioId) {
    throw new Error('No podés delegarte a vos mismo.');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const supervisor = await obtenerUsuario(conn, supervisorId);
    const delegado = await obtenerUsuario(conn, delegadoUsuarioId);

    const { inicioUtc, finUtc, inicioSql, finSql } = buildRange(fechaDesde, fechaHasta);

    const [[delegacionActiva]] = await conn.query(
      `SELECT rol_supervisor_original
         FROM delegaciones_supervisor
         WHERE delegado_id = ? AND estado = 'activa'
         ORDER BY fecha_desde ASC
         LIMIT 1`,
      [delegado.Id]
    );
    const nivelBaseDelegado = delegacionActiva ? Number(delegacionActiva.rol_supervisor_original) || delegado.Nivel : delegado.Nivel;

    await validarDisponibilidad(conn, {
      supervisorId,
      delegadoId: delegadoUsuarioId,
      inicioSql,
      finSql,
    });

    const ahora = new Date();
    const esActiva = inicioUtc <= ahora && (!finUtc || finUtc >= ahora);
    const estado = esActiva ? ESTADO_ACTIVA : ESTADO_PROGRAMADA;

    const [resultado] = await conn.query(
      `INSERT INTO delegaciones_supervisor
       (supervisor_id, delegado_id, fecha_desde, fecha_hasta, rol_supervisor_original, estado)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        supervisor.Id,
        delegado.Id,
        inicioSql,
        finSql,
        String(nivelBaseDelegado),
        estado,
      ]
    );

    if (estado === ESTADO_ACTIVA && delegado.Nivel !== 2) {
      await conn.query('UPDATE usuarios SET Nivel = ? WHERE Id = ?', [2, delegado.Id]);
      await registrarAudit(conn, {
        usuarioId: delegado.Id,
        rolAnterior: delegado.Nivel,
        rolNuevo: 2,
        motivo: MOTIVO_MANUAL,
        referencia: `delegacion:${resultado.insertId}`,
        supervisorOriginalId: supervisor.Id,
        fechaDesde: inicioSql,
        fechaHasta: finSql,
        ejecutadoPor,
        ipOrigen,
        userAgent,
      });
    }

    await conn.commit();
    return { id: resultado.insertId, estado };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const procesarDelegaciones = async (pool, {
  ejecutadoPor = null,
  ipOrigen = null,
  userAgent = null,
} = {}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ahora = new Date();
    const ahoraSql = toMysqlDateTime(ahora);

    const [paraActivar] = await conn.query(
      `SELECT * FROM delegaciones_supervisor
       WHERE estado = 'programada' AND fecha_desde <= ?
       FOR UPDATE`,
      [ahoraSql]
    );

    for (const delegacion of paraActivar) {
      const delegado = await obtenerUsuario(conn, delegacion.delegado_id, { requireActivo: false });
      if (delegado.Nivel !== 2) {
        await conn.query('UPDATE usuarios SET Nivel = ? WHERE Id = ?', [2, delegado.Id]);
        await registrarAudit(conn, {
          usuarioId: delegado.Id,
          rolAnterior: delegado.Nivel,
          rolNuevo: 2,
          motivo: MOTIVO_PROGRAMADA,
          referencia: `delegacion:${delegacion.id}`,
          supervisorOriginalId: delegacion.supervisor_id,
          fechaDesde: delegacion.fecha_desde,
          fechaHasta: delegacion.fecha_hasta,
          ejecutadoPor,
          ipOrigen,
          userAgent,
        });
      }
      await conn.query(
        `UPDATE delegaciones_supervisor
         SET estado = ?, actualizado_en = NOW()
         WHERE id = ?`,
        [ESTADO_ACTIVA, delegacion.id]
      );
    }

    const [paraFinalizar] = await conn.query(
      `SELECT * FROM delegaciones_supervisor
       WHERE estado = 'activa'
         AND fecha_hasta IS NOT NULL
         AND fecha_hasta < ?
       FOR UPDATE`,
      [ahoraSql]
    );

    for (const delegacion of paraFinalizar) {
      const nivelOriginal = Number(delegacion.rol_supervisor_original) || 3;
      const delegado = await obtenerUsuario(conn, delegacion.delegado_id, { requireActivo: false });
      if (delegado.Nivel !== nivelOriginal) {
        await conn.query('UPDATE usuarios SET Nivel = ? WHERE Id = ?', [nivelOriginal, delegado.Id]);
        await registrarAudit(conn, {
          usuarioId: delegado.Id,
          rolAnterior: delegado.Nivel,
          rolNuevo: nivelOriginal,
          motivo: MOTIVO_RESTAURACION,
          referencia: `delegacion:${delegacion.id}`,
          supervisorOriginalId: delegacion.supervisor_id,
          fechaDesde: delegacion.fecha_desde,
          fechaHasta: delegacion.fecha_hasta,
          ejecutadoPor,
          ipOrigen,
          userAgent,
        });
      }
      await conn.query(
        `UPDATE delegaciones_supervisor
         SET estado = ?, actualizado_en = NOW()
         WHERE id = ?`,
        [ESTADO_FINALIZADA, delegacion.id]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const obtenerDelegacionActivaPara = async (pool, usuarioId) => {
  const [rows] = await pool.query(
    `SELECT d.id,
            d.fecha_desde,
            d.fecha_hasta,
            ps.ApellidoYNombre AS supervisorNombre
     FROM delegaciones_supervisor d
     LEFT JOIN personal ps ON ps.idUsuario = d.supervisor_id
     WHERE d.delegado_id = ? AND d.estado = 'activa'
     ORDER BY d.fecha_desde DESC
     LIMIT 1`,
    [usuarioId]
  );
  if (!rows.length) return null;
  const delegacion = rows[0];
  const fechaDesdeTexto = formatoFechaMensaje(delegacion.fecha_desde);
  const fechaHastaTexto = delegacion.fecha_hasta ? formatoFechaMensaje(delegacion.fecha_hasta) : null;
  return {
    id: delegacion.id,
    supervisorNombre: delegacion.supervisorNombre || 'otro supervisor',
    fechaDesdeTexto,
    fechaHastaTexto,
  };
};

const formatoFechaMensaje = (fechaStr) => {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const ano = fecha.getFullYear();
  return `${dia}/${mes}/${ano}`;
};

module.exports = {
  crearDelegacion,
  procesarDelegaciones,
  obtenerDelegacionActivaPara,
};
