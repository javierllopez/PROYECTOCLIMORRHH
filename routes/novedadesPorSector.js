const express = require('express');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { TotalHoras50, TotalHoras100, FechaASqlFecha, FechaHTMLaFecha, FechaSqlAFecha, ExtraerHora, FechaYHora, FechaLocalASqlDate } = require('../lib/libreria');
const { logueado } = require('../Middleware/validarUsuario');
const router = express.Router();
const nivelAceptado = [1, 2, 3];

router.all('*', logueado, (req, res, next) => {
  if (nivelAceptado.includes(req.session.nivelUsuario)) {
    return next();
  } else {
    return res.redirect('/');
  }
});

// Vista para seleccionar sector
router.get('/Seleccionar', async (req, res) => {
  try {
    const [sectores] = await pool.query('SELECT Id, Descripcion FROM sectores ORDER BY Descripcion');
    return render(req, res, 'novedadesPorSectorSeleccionar', { sectores });
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Error al cargar los sectores', 'danger');
  }
});

// Vista para mostrar novedades agrupadas por sector
router.get('/', async (req, res) => {
  const { IdSector } = req.query;
  if (!IdSector) {
    return res.redirect('/novedadesPorSector/Seleccionar');
  }
  try {
    const [sector] = await pool.query('SELECT * FROM sectores WHERE Id = ?', [IdSector]);
    if (sector.length === 0) {
      enviarMensaje(req, res, 'Error', 'El sector seleccionado no existe', 'error');
      return res.redirect('/novedadesPorSector/Seleccionar');
    }
    const [novedades] = await pool.query(`
      SELECT n.Id, DATE_FORMAT(n.Fecha, '%Y-%m-%d') AS Fecha, n.IdEmpleado, p.ApellidoYNombre, n.IdEstado, n.Hs50, n.Hs100, n.GuardiasDiurnas, n.GuardiasNocturnas, n.Monto, n.Inicio, n.Fin, n.ObservacionesEstado, n.MinutosAl50, n.MinutosAl100,n.MinutosGD, n.MinutosGN, n.IdMotivo, m.Descripcion as Motivo, n.Observaciones, n.CreadoPorAdmin, p2.ApellidoYNombre as Reemplazo
      FROM novedadesr n
      INNER JOIN personal p ON n.IdEmpleado = p.Id
      INNER JOIN motivos m ON n.IdMotivo = m.Id
      LEFT JOIN personal p2 ON n.IdReemplazo = p2.Id
      WHERE n.IdSector = ? AND n.IdEstado > 2
      ORDER BY p.ApellidoYNombre, n.Fecha ASC
    `, [IdSector]);
    return render(req, res, 'novedadesPorSector', { sector: sector[0], novedades });
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Error al cargar las novedades', 'danger');
    return res.redirect('/novedadesPorSector/Seleccionar');
  }
});
router.post('/OK', logueado, async (req, res) => {
  const { Id, IdSector } = req.body;
  const sql = 'UPDATE novedadesr SET IdEstado = 5 WHERE Id = ?';
  try {
    await pool.query(sql, [Id]);
    enviarMensaje(req, res, 'Novedad Aprobada', 'La novedad fue aprobada', 'success');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
  catch (error) {
    console.log(error);
    enviarMensaje(req, res, 'Error', error.message, 'error');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
});
router.post('/deshacer', logueado, async (req, res) => {
  const { Id, IdPersonal, IdSector } = req.body;
  // Bloquear si está liquidado
  const [rows] = await pool.query('SELECT IdEstado FROM novedadesr WHERE Id = ?', [Id]);
  if (rows.length && rows[0].IdEstado === 6) {
    enviarMensaje(req, res, 'Atención', 'No se puede deshacer una novedad liquidada.', 'warning');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
  const sql = 'UPDATE novedadesr SET IdEstado = 3 WHERE Id = ?';
  try {
    await pool.query(sql, [Id]);
    enviarMensaje(req, res, 'Novedad Deshecha', 'La novedad fue deshecha', 'success');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
  catch (error) {
    console.log(error);
    enviarMensaje(req, res, 'Error', error.message, 'error');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
});
router.post('/NO', logueado, async (req, res) => {
  const { Id, ObservacionesEstado, IdSector } = req.body;
  const sql = 'UPDATE novedadesr SET IdEstado = 4, ObservacionesEstado = ? WHERE Id = ?';
  try {
    await pool.query(sql, ['Rechazado por Recursos Humanos. Motivo: ' + ObservacionesEstado, Id]);
    enviarMensaje(req, res, 'Novedad Rechazada', 'La novedad fue rechazada', 'success');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
  catch (error) {
    console.log(error);
    enviarMensaje(req, res, 'Error', error.message, 'error');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
}
);
router.post('/Borrar', logueado, async (req, res) => {
  const { Id, IdSector } = req.body;
  // Bloquear si está liquidado
  const [rows] = await pool.query('SELECT IdEstado FROM novedadesr WHERE Id = ?', [Id]);
  if (rows.length && rows[0].IdEstado === 6) {
    enviarMensaje(req, res, 'Atención', 'No se puede borrar una novedad liquidada.', 'warning');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
  const sql = 'DELETE FROM novedadesr WHERE Id = ?';
  try {
    await pool.query(sql, [Id]);
    enviarMensaje(req, res, 'Novedad Borrada', 'La novedad fue borrada', 'success');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
  catch (error) {
    console.log(error);
    enviarMensaje(req, res, 'Error', error.message, 'error');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
});

// Vista para agregar novedad por sector
router.get('/Agregar', async (req, res) => {
  const { IdSector } = req.query;
  if (!IdSector) {
    return res.redirect('/novedadesPorSector/Seleccionar');
  }
  try {
    // Obtener datos del sector
    const [sector] = await pool.query('SELECT Id, Descripcion FROM sectores WHERE Id = ?', [IdSector]);
    if (sector.length === 0) {
      enviarMensaje(req, res, 'Error', 'El sector seleccionado no existe', 'error');
      return res.redirect('/novedadesPorSector/Seleccionar');
    }
    // Obtener empleados del sector
    // Obtener empleados activos del sector cuyo campo fechabaja está vacío
    const [empleados] = await pool.query(
      'SELECT Id, ApellidoYNombre, IdCategoria FROM personal WHERE IdSector = ? AND (fechabaja IS NULL) ORDER BY ApellidoYNombre',
      [IdSector]
    );
    //Obtener otra lista de todos los empleados para el combo de reemplazos
    const [empleadosReemplazo] = await pool.query(
      'SELECT Id, ApellidoYNombre FROM personal WHERE (fechabaja IS NULL) ORDER BY ApellidoYNombre'
    );
    // Obtener nóminas habilitadas
    const [nominas] = await pool.query('SELECT nomina.Id, nomina.Descripcion, nomina.HorasMensuales, nomina.HaceGuardiasDiurnas, nominahabilitada.IdCategoria, nominahabilitada.IdNomina FROM nomina JOIN nominahabilitada ON nomina.Id = nominahabilitada.IdNomina ORDER BY nomina.Descripcion');
    // Obtener motivos
    const [motivos] = await pool.query('SELECT Id, Descripcion, InformaReemplazo, DescripcionObligatoria FROM motivos ORDER BY Descripcion');
    // Obtener lista de tipos de guardia
    const [guardias] = await pool.query('SELECT * FROM guardias ORDER BY Descripcion');

    return render(req, res, 'novedadesPorSectorAgregar', {
      sector: sector[0],
      empleados,
      empleadosReemplazo,
      nominas,
      motivos,
      guardias
    });
  } catch (error) {
    console.error(error);
    enviarMensaje(req, res, 'Atención', 'Error al cargar el formulario de alta', 'error');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
});

//Ruta para grabar agregar novedades por sector
router.post('/Agregar', async (req, res) => {
  const { IdPersonal,
    IdSector,
    TipoNovedad,
    IdNomina,
    Motivo,
    empleadoReemplazo,
    Observaciones,
    Fecha,
    Inicio,
    Fin,
    FechaGuardia,
    GuardiaRealizada,
    TipoGuardia,
    InicioGuardiaParcial,
    FinGuardiaParcial
  } = req.body;

  const sqlNovedadesE = 'SELECT * FROM novedadese WHERE actual = 1';
  const sqlSectores = 'SELECT * FROM sectores WHERE Id = ?';
  const sqlCategorias = 'SELECT * FROM categorias WHERE Id = ?';
  const sqlPersonal = 'SELECT * FROM personal WHERE Id = ?';
  const sqlMotivos = 'SELECT * FROM motivos WHERE Id = ?';
  const sqlNomina = `SELECT Id, 
                              IdNomina, 
                              ValorHora50, 
                              ValorHora100, 
                              ValorGuardiaDiurna, 
                              ValorGuardiaNocturna, 
                              VigenciaDesde, 
                              VigenciaHasta 
                              FROM nominavaloresr 
                              WHERE IdNomina = ? AND VigenciaDesde <= ? AND VigenciaHasta >= ?`;
  const sqlGuardias = 'SELECT * FROM guardias WHERE Id = ?';
  const sqlNovedadesR = 'INSERT INTO novedadesr (IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, GuardiasDiurnas, GuardiasNocturnas, Monto, IdGuardia, IdParcial, IdNomina, IdTurno, IdCategoria, IdEstado, ObservacionesEstado, IdSupervisor, MinutosAl50, MinutosAl100, MinutosGD, MinutosGN, Inicio, Fin, IdMotivo, IdReemplazo, Observaciones, CreadoPorAdmin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)';
  const sqlControlFecha = "SELECT * FROM novedadesr WHERE IdEmpleado = ? AND ((Inicio <= ? AND Fin >= ?) OR (Inicio <= ? AND Fin >= ?)) AND IdEstado <> 2 AND IdEstado <> 4";
  try {
    let _IdNovedadesE = 0;
    let _Area = 0;
    let _IdSector = 0;
    let _IdEmpleado = 0;
    let _Inicio = new Date();
    let _Fin = new Date();
    let _Hs50 = '';
    let _Hs100 = '';
    let _GuardiasDiurnas = 0;
    let _GuardiasNocturnas = 0;
    let _Monto = 0;
    let _IdGuardia = 0;
    let _IdParcial = 0;
    let _IdNomina = 0;
    let _IdTurno = 0;
    let _IdCategoria = 0;
    let _IdEstado = 5;
    let _ObservacionesEstado = 'Cargado por Recursos Humanos';
    let _IdSupervisor = 0;
    let _MinutosAl50 = 0;
    let _MinutosAl100 = 0;
    let _MinutosGD = 0;
    let _MinutosGN = 0;
    let _IdMotivo = 0;
    let _IdReemplazo = 0;
    let _Observaciones = '';
    let _CoeficienteGuardia = 0;
    let guardias = [];
    //-------------Defino las variables de la fecha y hora de acuerdo al tipo de novedad-----------------
    if (TipoNovedad == 'horas') {
      // Unir fecha y hora para crear Date de entrada y salida en hora local
      let [year, month, day] = Fecha.split('-').map(Number);
      let [hInicio, mInicio] = Inicio.split(':').map(Number);
      let [hFin, mFin] = Fin.split(':').map(Number);
      // Crear fechas en hora local
      let entrada = new Date(Date.UTC(year, month - 1, day, hInicio, mInicio, 0, 0));
      let salida = new Date(Date.UTC(year, month - 1, day, hFin, mFin, 0, 0));
      // Si la hora de fin es menor o igual a la de inicio, sumar un día a la fecha de salida
      if (hFin < hInicio || (hFin === hInicio && mFin <= mInicio)) {
        salida.setUTCDate(salida.getUTCDate() + 1);
      }
      // Guardar en UTC (formato MySQL)
      function toMySQLDatetimeUTC(date) {
        const pad = n => n < 10 ? '0' + n : n;
        return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
      }
      _Inicio = new Date(toMySQLDatetimeUTC(entrada));
      _Fin = new Date(toMySQLDatetimeUTC(salida));
    } else if (TipoNovedad == 'guardia') {
      [guardias] = await pool.query(sqlGuardias, [GuardiaRealizada]);
      if (guardias.length === 0) {
        throw new Error('Guardia no encontrada');
      }
      _IdGuardia = GuardiaRealizada;
      function toMySQLDatetimeUTC(date) {
        const pad = n => n < 10 ? '0' + n : n;
        return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
      }
      if (TipoGuardia == "Completa") {
        _IdParcial = 1;     //Guardia completa
        let [anio, mes, dia] = FechaGuardia.split('-').map(Number);
        let [hIni, mIni] = ExtraerHora(guardias[0].Inicio).split(':').map(Number);
        let [hFin, mFin] = ExtraerHora(guardias[0].Fin).split(':').map(Number);
        // Crear fechas en UTC
        // Si la hora de fin es menor o igual a la de inicio, sumar un día a la fecha de fin
        let entrada = new Date(Date.UTC(anio, mes - 1, dia, hIni, mIni, 0, 0));
        let salida = new Date(Date.UTC(anio, mes - 1, dia, hFin, mFin, 0, 0));
        if (entrada > salida) salida.setUTCDate(salida.getUTCDate() + 1);
        _Inicio = new Date(toMySQLDatetimeUTC(entrada));
        _Fin = new Date(toMySQLDatetimeUTC(salida));
      } else if (TipoGuardia == "Parcial") {
        _IdParcial = 2;     //Guardia parcial
        let [anio, mes, dia] = FechaGuardia.split('-').map(Number);
        let [hIni, mIni] = InicioGuardiaParcial.split(':').map(Number);
        let [hFin, mFin] = FinGuardiaParcial.split(':').map(Number);
        let inicio = new Date(Date.UTC(anio, mes - 1, dia, hIni, mIni, 0, 0));
        let fin = new Date(Date.UTC(anio, mes - 1, dia, hFin, mFin, 0, 0));
        if (inicio > fin) fin.setUTCDate(fin.getUTCDate() + 1);
        _Inicio = new Date(toMySQLDatetimeUTC(inicio));
        _Fin = new Date(toMySQLDatetimeUTC(fin));
      } else {
        throw new Error('Tipo de guardia no válido');
      }
    } else {
      throw new Error('Tipo de novedad no válido');
    }
    //-------------------------------------------------------------------------------------------------
    const [novedadesE] = await pool.query(sqlNovedadesE);
    if (novedadesE.length === 0) {
      throw new Error('No existe una liquidación actual con novedades');
    }
    _IdNovedadesE = novedadesE[0].Id;
    if (_Fin <= _Inicio) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
    }
    if (_Inicio > new Date()) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha actual');
    }
    if (_Fin > new Date()) {
      throw new Error('La fecha de fin no puede ser posterior a la fecha actual');
    }
    const [ControlFecha] = await pool.query(sqlControlFecha, [IdPersonal, FechaASqlFecha(_Inicio), FechaASqlFecha(_Inicio), FechaASqlFecha(_Fin), FechaASqlFecha(_Fin)]);
    if (ControlFecha.length > 0) {
      throw new Error('El empleado ya tiene una novedad en esa fecha y horario');
    }
    const [sector] = await pool.query(sqlSectores, [IdSector]);
    if (sector.length === 0) {
      throw new Error('Sector no encontrado');
    }
    _IdSector = sector[0].Id;
    _IdSupervisor = sector[0].IdSupervisor;
    const [personal] = await pool.query(sqlPersonal, [IdPersonal]);
    if (personal.length === 0) {
      throw new Error('Empleado no encontrado');
    }
    _IdEmpleado = personal[0].Id;
    _IdNomina = parseInt(IdNomina);
    const [nominaValores] = await pool.query(sqlNomina, [_IdNomina, FechaASqlFecha(_Inicio), FechaASqlFecha(_Inicio)]);
    //console.log('Nomina:', _IdNomina);
    if (nominaValores.length === 0) {
      throw new Error('No se encontraron valores de nómina para la fecha seleccionada');
    }
    const [motivo] = await pool.query(sqlMotivos, [Motivo]);
    if (motivo.length === 0) {
      throw new Error('Motivo no encontrado');
    }
    _IdMotivo = motivo[0].Id;
    if (motivo[0].InformaReemplazo == 1) {
      if (parseInt(empleadoReemplazo) == 0) {
        throw new Error('El motivo seleccionado requiere un empleado de reemplazo');
      } else {
        _IdReemplazo = parseInt(empleadoReemplazo);
      }
    }
    if (motivo[0].DescripcionObligatoria == 1) {
      if (Observaciones == '') {
        throw new Error('El motivo seleccionado requiere una descripción obligatoria');
      } else {
        _Observaciones = Observaciones;
      }
    }

    const [categoria] = await pool.query(sqlCategorias, [personal[0].IdCategoria]);
    if (categoria.length === 0) {
      throw new Error('Categoría no encontrada');
    }
    _Area = categoria[0].Area
    _IdCategoria = personal[0].IdCategoria;
    _IdTurno = personal[0].IdTurno;

//    const [nomina] = await pool.query(sqlNomina, [_IdNomina, FechaASqlFecha(_Inicio), FechaASqlFecha(_Inicio)]);
//    if (nomina.length === 0) {
//      throw new Error('No se encontraron valores de nómina para la fecha seleccionada');
//    }
//    if (nomina[0].IdNomina != _IdNomina) {
//      throw new Error('No se encontraron valores de nómina para la fecha seleccionada');
//    }
//    _IdNomina = nomina[0].IdNomina;
    //-------------------------------------------------------------------------------------------------
    //----------------------------------Si son horas extras--------------------------------------------
    //-------------------------------------------------------------------------------------------------
    if (TipoNovedad == 'horas') {
      const extraerHs50 = TotalHoras50(_Inicio, _Fin);
      console.log('Inicio:', _Inicio, 'Fin:', _Fin, 'Minutos:', extraerHs50[0], 'Horas:', extraerHs50[1]);
      _MinutosAl50 = extraerHs50[0] !== undefined ? extraerHs50[0] : 0;
      _Hs50 = extraerHs50[1] !== undefined ? extraerHs50[1] : '';
      const [extraerHs100] = TotalHoras100(_Inicio, _Fin);
      _MinutosAl100 = extraerHs100[0] !== undefined ? extraerHs100[0] : 0;
      _Hs100 = extraerHs100[1] !== undefined ? extraerHs100[1] : '';
//      _IdNomina = Nomina;
      _Monto = (_MinutosAl50 * nominaValores[0].ValorHora50 / 60) + (_MinutosAl100 * nominaValores[0].ValorHora100 / 60);
    }
    //-------------------------------------------------------------------------------------------------
    //----------------------------------Si son guardias------------------------------------------------
    //-------------------------------------------------------------------------------------------------
    if (TipoNovedad == 'guardia') {
      // Si es una guardia completa saco la hora de entrada y salida de la tabla de guardias
      if (TipoGuardia == "Completa") {
        console.log('Guardia completa', nominaValores[0]);
        _CoeficienteGuardia = guardias[0].Cantidad;
        if (guardias[0].Tipo == 1) {
          _Monto = _CoeficienteGuardia * nominaValores[0].ValorGuardiaDiurna;
          _GuardiasDiurnas = _CoeficienteGuardia;
          _MinutosGD = (_Fin - _Inicio) / 60000;
        } else {
          _Monto = _CoeficienteGuardia * nominaValores[0].ValorGuardiaNocturna;
          _GuardiasNocturnas = _CoeficienteGuardia;
          _MinutosGN = (_Fin - _Inicio) / 60000;
        }
      } else {
        // Si es una guardia parcial saco la hora de entrada y salida de los campos del formulario
        if (TipoGuardia == "Parcial") {
          _CoeficienteGuardia = (_Fin - _Inicio) / (guardias[0].Fin - guardias[0].Inicio) * guardias[0].Cantidad;
          console.log(_Fin - _Inicio);
          console.log('Inicio Guardia:', guardias[0].Inicio, 'Fin Guardia:', guardias[0].Fin);
          console.log('Diferencia:', guardias[0].Fin - guardias[0].Inicio);
          console.log('Coeficiente Guardia:', _CoeficienteGuardia);
          if (guardias[0].Tipo == 1) {
            _Monto = _CoeficienteGuardia * nominaValores[0].ValorGuardiaDiurna;
            _GuardiasDiurnas = _CoeficienteGuardia;
            _MinutosGD = (_Fin - _Inicio) / 60000;
          } else {
            _Monto = _CoeficienteGuardia * nominaValores[0].ValorGuardiaNocturna;
            _GuardiasNocturnas = _CoeficienteGuardia;
            _MinutosGN = (_Fin - _Inicio) / 60000;
          }
        }

      }
    }

    //Ejecuto la instrucción SQL para insertar la novedad
    await pool.query(sqlNovedadesR,
      [_IdNovedadesE,
        _Area,
        _IdSector,
        _IdEmpleado,
  FechaLocalASqlDate(_Inicio),
        _Hs50,
        _Hs100,
        _GuardiasDiurnas,
        _GuardiasNocturnas,
        _Monto,
        _IdGuardia,
        _IdParcial,
        _IdNomina,
        _IdTurno,
        _IdCategoria,
        _IdEstado,
        _ObservacionesEstado,
        _IdSupervisor,
        _MinutosAl50,
        _MinutosAl100,
        _MinutosGD,
        _MinutosGN,
        FechaASqlFecha(_Inicio),
        FechaASqlFecha(_Fin),
        _IdMotivo,
        _IdReemplazo,
        _Observaciones
      ]);

    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  } catch (error) {
    console.log(error);
    enviarMensaje(req, res, 'Error', error.message, 'error');
    return res.redirect(`/novedadesPorSector?IdSector=${IdSector}`);
  }
});
module.exports = router;
