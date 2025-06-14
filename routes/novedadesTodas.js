const express = require('express');
const { pool } = require('../conexion');
const { render, enviarMensaje } = require('../Middleware/render');
const { logueado } = require('../Middleware/validarUsuario');
const { TotalHoras50, TotalHoras100, FechaASqlFecha, FechaHTMLaFecha, FechaSqlAFecha, ExtraerHora, FechaYHora } = require('../lib/libreria');
const router = express.Router();
const nivelAceptado = [1, 2, 3] //Esta ruta sólo permite usuarios nivel 1 (Administrador)

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.get('/', logueado, async (req, res) => {
    const sqlNovedadesE = 'SELECT * FROM novedadese WHERE actual = 1';
    const sqlNovedadesR = `
        SELECT novedadesr.Id as IdNovedadesR,
        novedadesr.Fecha as Fecha,
        novedadesr.IdEmpleado as IdEmpleado,
        personal.Id as IdPersonal,
        personal.ApellidoYNombre as ApellidoYNombre,
        novedadesr.IdSector as IdSector,
        sectores.Descripcion as Sector,
        novedadesr.Hs50 as Hs50,
        novedadesr.Hs100 as Hs100,
        novedadesr.GuardiasDiurnas as GuardiasDiurnas,
        novedadesr.GuardiasNocturnas as GuardiasNocturnas,
        novedadesr.GuardiasPasivas as GuardiasPasivas,
        novedadesr.Monto as Monto,
        novedadesr.IdNomina as IdNominaNovedadesR,
        nomina.Id as IdNomina,
        nomina.Descripcion as DescripcionNomina,
        novedadesr.IdEstado as IdEstado,
        novedadesr.ObservacionesEstado as ObservacionesEstado,
        novedadesr.MinutosAl50 as MinutosAl50,
        novedadesr.MinutosAl100 as MinutosAl100,
        novedadesr.MinutosGD as MinutosGD,
        novedadesr.MinutosGN as MinutosGN,
        novedadesr.Inicio as Inicio,
        novedadesr.Fin as Fin,
        novedadesr.IdMotivo as IdMotivo,
        motivos.Descripcion as Motivo,
        novedadesr.IdReemplazo as IdReemplazo, 
        personal2.Id as IdReemplazo,
        personal2.ApellidoYNombre as Reemplazo,
        novedadesr.Observaciones as Observaciones,
        novedadesR.CreadoPorAdmin as CreadoPorAdmin
        FROM novedadesr
        INNER JOIN personal ON novedadesr.IdEmpleado = personal.Id
        INNER JOIN sectores ON novedadesr.IdSector = sectores.Id
        INNER JOIN nomina ON novedadesr.IdNomina = nomina.Id
        INNER JOIN motivos ON novedadesr.IdMotivo = motivos.Id
        LEFT JOIN personal AS personal2 ON novedadesr.IdReemplazo = personal2.Id
        WHERE novedadesr.IdNovedadesE = ? AND novedadesr.IdEstado > 2
        ORDER BY personal.ApellidoYNombre, novedadesr.Fecha ASC
    `;
    try {
        const [novedadesE] = await pool.query(sqlNovedadesE);

        if (novedadesE.length === 0) {
            throw new Error('No existe una liquidación actual con novedades');
        }

        const [novedadesR] = await pool.query(sqlNovedadesR, [novedadesE[0].Id]);

        return render(req, res, 'novedadesTodas', { novedades: novedadesR });
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/');
    }

});
router.post('/OK', logueado, async (req, res) => {
    const { Id } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 5 WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Aprobada', 'La novedad fue aprobada', 'success');
        return res.redirect('/novedadesTodas');
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas');
    }
});
router.post('/deshacer', logueado, async (req, res) => {
    const { Id } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 3 WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Deshecha', 'La novedad fue deshecha', 'success');
        return res.redirect('/novedadesTodas');
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas');
    }
});
router.post('/NO', logueado, async (req, res) => {
    const { Id, ObservacionesEstado } = req.body;
    const sql = 'UPDATE novedadesr SET IdEstado = 4, ObservacionesEstado = ? WHERE Id = ?';
    try {
        await pool.query(sql, ['Rechazado por Recursos Humanos. Motivo: ' + ObservacionesEstado, Id]);
        enviarMensaje(req, res, 'Novedad Rechazada', 'La novedad fue rechazada', 'success');
        return res.redirect('/novedadesTodas');
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas');
    }
});
router.get('/Agregar', logueado, async (req, res) => {
    const sqlPersonal = "SELECT * FROM personal WHERE FechaBaja IS NULL ORDER BY ApellidoYNombre ASC";
    const sqlSectores = 'SELECT * FROM sectores ORDER BY Descripcion ASC';
    const sqlNomina = 'SELECT * FROM nomina ORDER BY Descripcion ASC';
    const sqlMotivos = 'SELECT * FROM motivos ORDER BY Descripcion ASC';
    const sqlGuardias = 'SELECT * FROM guardias ORDER BY Descripcion ASC';
    try {
        const [personal] = await pool.query(sqlPersonal);
        const [sectores] = await pool.query(sqlSectores);
        const [nomina] = await pool.query(sqlNomina);
        const [motivos] = await pool.query(sqlMotivos);
        const [guardias] = await pool.query(sqlGuardias);
        return render(req, res, 'novedadesAgregar', { personal, sectores, nomina, motivos, guardias });
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas');
    }
});
router.post('/Borrar', logueado, async (req, res) => {
    const { Id } = req.body;
    const sql = 'DELETE FROM novedadesr WHERE Id = ?';
    try {
        await pool.query(sql, [Id]);
        enviarMensaje(req, res, 'Novedad Borrada', 'La novedad fue borrada', 'success');
        return res.redirect('/novedadesTodas');
    }
    catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas');
    }
});
router.post('/Agregar', logueado, async (req, res) => {
    const { IdEmpleado,
        Sector,
        Nomina,
        FechaHoras,
        HoraInicio,
        HoraFin,
        FechaGuardia,
        GuardiaRealizada,
        TipoGuardia,
        InicioGuardiaParcial,
        FinGuardiaParcial,
        MotivoExtra,
        IdEmpleadoReemplazoExtra,
        DescripcionObligatoriaExtra,
        TipoNovedad } = req.body;

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
        let _GuardiasPasivas = 0;
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
        if (TipoNovedad == 'Horas') {
            // Unir fecha y hora para crear Date de entrada y salida en hora local
            let [year, month, day] = FechaHoras.split('-').map(Number);
            let [hInicio, mInicio] = HoraInicio.split(':').map(Number);
            let [hFin, mFin] = HoraFin.split(':').map(Number);
            // Crear fechas en hora local (no UTC)
            let entrada = new Date(year, month - 1, day, hInicio, mInicio, 0, 0);
            let salida = new Date(year, month - 1, day, hFin, mFin, 0, 0);
            // Si la hora de fin es menor o igual a la de inicio, sumar un día a la fecha de salida
            if (hFin < hInicio || (hFin === hInicio && mFin <= mInicio)) {
                salida.setDate(salida.getDate() + 1);
            }
            _Inicio = entrada;
            _Fin = salida;
        } else if (TipoNovedad == 'Guardias') {
            [guardias] = await pool.query(sqlGuardias, [GuardiaRealizada]);
            if (guardias.length === 0) {
                throw new Error('Guardia no encontrada');
            }
            _IdGuardia = GuardiaRealizada;
            if (TipoGuardia == 1) {
                _IdParcial = 1;     //Guardia completa
                _Inicio = new Date(FechaHTMLaFecha(FechaGuardia).toDateString() + ' ' + ExtraerHora(guardias[0].Inicio));
                _Fin = new Date(FechaHTMLaFecha(FechaGuardia).toDateString() + ' ' + ExtraerHora(guardias[0].Fin));


                if (_Inicio > _Fin) _Fin.setDate(_Fin.getDate() + 1);

            } else if (TipoGuardia == 2) {
                _IdParcial = 2;     //Guardia parcial
                _Inicio = new Date(FechaHTMLaFecha(FechaGuardia) + ' ' + InicioGuardiaParcial);
                _Fin = new Date(FechaHTMLaFecha(FechaGuardia) + ' ' + FinGuardiaParcial);
                if (_Inicio > _Fin) {
                    _Fin.setDate(_Fin.getDate() + 1);
                }
            }
            else {
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
        const [ControlFecha] = await pool.query(sqlControlFecha, [IdEmpleado, FechaASqlFecha(_Inicio), FechaASqlFecha(_Inicio), FechaASqlFecha(_Fin), FechaASqlFecha(_Fin)]);
        if (ControlFecha.length > 0) {
            throw new Error('El empleado ya tiene una novedad en esa fecha y horario');
        }
        const [sector] = await pool.query(sqlSectores, [Sector]);
        if (sector.length === 0) {
            throw new Error('Sector no encontrado');
        }
        _IdSector = sector[0].Id;
        _IdSupervisor = sector[0].IdSupervisor;
        const [personal] = await pool.query(sqlPersonal, [IdEmpleado]);
        if (personal.length === 0) {
            throw new Error('Empleado no encontrado');
        }
        _IdEmpleado = personal[0].Id;
        const [nominaValores] = await pool.query(sqlNomina, [Nomina, FechaASqlFecha(_Inicio), FechaASqlFecha(_Inicio)]);
        if (nominaValores.length === 0) {
            throw new Error('No se encontraron valores de nómina para la fecha seleccionada');
        }
        const [motivo] = await pool.query(sqlMotivos, [MotivoExtra]);
        if (motivo.length === 0) {
            throw new Error('Motivo no encontrado');
        }
        _IdMotivo = motivo[0].Id;
        if (motivo[0].InformaReemplazo == 1) {
            if (IdEmpleadoReemplazoExtra == 0) {
                throw new Error('El motivo seleccionado requiere un empleado de reemplazo');
            } else {
                _IdReemplazo = IdEmpleadoReemplazoExtra;
            }
        }
        if (motivo[0].DescripcionObligatoria == 1) {
            if (DescripcionObligatoriaExtra == '') {
                throw new Error('El motivo seleccionado requiere una descripción obligatoria');
            } else {
                _Observaciones = DescripcionObligatoriaExtra;
            }
        }

        const [categoria] = await pool.query(sqlCategorias, [personal[0].IdCategoria]);
        if (categoria.length === 0) {
            throw new Error('Categoría no encontrada');
        }
        _Area = categoria[0].Area
        _IdCategoria = personal[0].IdCategoria;
        _IdTurno = personal[0].IdTurno;

        const [nomina] = await pool.query(sqlNomina, [Nomina, FechaASqlFecha(_Inicio), FechaASqlFecha(_Inicio)]);
        if (nomina.length === 0) {
            throw new Error('No se encontraron valores de nómina para la fecha seleccionada');
        }
        if (nomina[0].IdNomina != Nomina) {
            throw new Error('No se encontraron valores de nómina para la fecha seleccionada');
        }
        _IdNomina = nomina[0].IdNomina;
        //-------------------------------------------------------------------------------------------------
        //----------------------------------Si son horas extras--------------------------------------------
        //-------------------------------------------------------------------------------------------------
        if (TipoNovedad == 'Horas') {
            const extraerHs50 = TotalHoras50(_Inicio, _Fin);
            console.log('Inicio:', _Inicio, 'Fin:', _Fin, 'Minutos:', extraerHs50[0], 'Horas:', extraerHs50[1]);
            _MinutosAl50 = extraerHs50[0] !== undefined ? extraerHs50[0] : 0;
            _Hs50 = extraerHs50[1] !== undefined ? extraerHs50[1] : '';
            const [extraerHs100] = TotalHoras100(_Inicio, _Fin);
            _MinutosAl100 = extraerHs100[0] !== undefined ? extraerHs100[0] : 0;
            _Hs100 = extraerHs100[1] !== undefined ? extraerHs100[1] : '';
            _IdNomina = Nomina;
            _Monto = (_MinutosAl50 * nominaValores[0].ValorHora50 / 60) + (_MinutosAl100 * nominaValores[0].ValorHora100 / 60);
        }
        //-------------------------------------------------------------------------------------------------
        //----------------------------------Si son guardias------------------------------------------------
        //-------------------------------------------------------------------------------------------------
        if (TipoNovedad == 'Guardias') {
            // Si es una guardia completa saco la hora de entrada y salida de la tabla de guardias
            if (TipoGuardia == 1) {
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
                if (TipoGuardia == 2) {
                    _CoeficienteGuardia = (_Fin - _Inicio) / (guardias[0].Fin - guardias[0].Inicio) * guardias[0].Cantidad;
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
                FechaASqlFecha(_Inicio),
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

        return res.redirect('/novedadesTodas');
    } catch (error) {
        console.log(error);
        enviarMensaje(req, res, 'Error', error.message, 'error');
        return res.redirect('/novedadesTodas/Agregar');
    }

});
module.exports = router;