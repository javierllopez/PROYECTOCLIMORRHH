const express = require('express');
const {pool} = require('../conexion');
const {render, enviarMensaje} = require('../Middleware/render');
const {logueado} = require('../Middleware/validarUsuario');
const {TotalHoras50, TotalHoras100, FechaASqlFecha, FechaSqlAFecha, ExtraerHora, FechaYHora, fechaHoraLocalAUtc} = require('../lib/libreria');
const router = express.Router();
const nivelAceptado = [1,2,3] //Esta ruta sólo permite usuarios nivel 1 (Administrador)

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.get('/', logueado, async (req, res) => {
    const sqlPersonal = 'SELECT * FROM personal WHERE idUsuario = ?';
    const sqlNominaHabilitada = 'SELECT nominahabilitada.IdCategoria, nominahabilitada.IdNomina, nomina.Id, nomina.Descripcion, nomina.InformaValorSueldoBasico, nomina.HorasMensuales, nomina.HaceGuardiasDiurnas, nomina.HorasGuardiaDiurna, nomina.HaceGuardiasNocturnas, nomina.HorasGuardiaNocturna, nomina.HaceGuardiasPasivas FROM nominahabilitada INNER JOIN nomina ON nominahabilitada.IdNomina = nomina.Id WHERE nominahabilitada.IdCategoria = ?';
    const sqlNovedades = `SELECT novedadesr.Id as IdNovedadesR, 
                                novedadesr.IdSector, 
                                sectores.Id, 
                                sectores.Descripcion AS Sector, 
                                novedadesr.IdEmpleado, 
                                DATE_FORMAT(novedadesr.Fecha, '%Y-%m-%d') AS Fecha, 
                                novedadesr.Hs50 AS Hs50, 
                                novedadesr.Hs100 AS Hs100, 
                                novedadesr.GuardiasDiurnas AS GD, 
                                novedadesr.GuardiasNocturnas AS GN, 
                                novedadesr.GuardiasPasivas AS GP, 
                                novedadesr.IdNomina, 
                                novedadesr.Inicio, 
                                novedadesr.Fin, 
                                nomina.Id, 
                                nomina.Descripcion AS Nomina, 
                                novedadesr.Monto as Monto, 
                                novedadesr.IdEstado as Estado,
                                novedadesr.ObservacionesEstado as ObservacionesEstado, 
                                novedadesr.MinutosAl50, 
                                novedadesr.MinutosAl100, 
                                novedadesr.Observaciones 
                                FROM novedadesr 
                                INNER JOIN sectores ON novedadesr.IdSector = sectores.Id 
                                INNER JOIN nomina ON novedadesr.IdNomina = nomina.Id 
                                WHERE novedadesr.IdEmpleado = ? 
                                ORDER BY novedadesr.IdEstado DESC, novedadesr.Fecha ASC`;
    const sqlNovedadesE = 'SELECT * FROM novedadese WHERE Actual = 1';
    const sqlNominaHabilitadaValores = 'SELECT nominahabilitada.IdCategoria, nominahabilitada.IdNomina, nomina.Id, nomina.Descripcion, nominavaloresr.IdNomina, nominavaloresr.ValorHora50, nominavaloresr.ValorHora100, nominavaloresr.ValorGuardiaDiurna, nominavaloresr.ValorGuardiaNocturna, nominavaloresr.ValorGuardiaPasiva, nominavaloresr.VigenciaDesde, nominavaloresr.VigenciaHasta FROM nominahabilitada INNER JOIN nomina ON nominahabilitada.IdNomina = nomina.Id INNER JOIN nominavaloresr ON nominahabilitada.IdNomina = nominavaloresr.IdNomina WHERE nominahabilitada.IdCategoria = ? AND nominavaloresr.VigenciaDesde <= ? AND nominavaloresr.VigenciaHasta >= ?';

    let botonHoras = false;
    let botonGuardias = false;
    let botonGuardiasPasivas = false;
    let hayLiquidacion = false;
    let novedadesHasta = null
    let nominaHabilitadaValores = [];
    let columnas = {Horas50: false, Horas100: false, GuardiasDiurnas: false, GuardiasNocturnas: false, GuardiasPasivas: false};
    let totalesPendientes = {
        totalMin50: 0,
        totalMin100: 0,
        totalGuardiasDiurnas: 0,
        totalGuardiasNocturnas: 0,
        totalGuardiasPasivas: 0,
        totalOtros: 0,
        totalMonto: 0
    }
    let totalesConfirmados = {
        totalMin50: 0,
        totalMin100: 0,
        totalGuardiasDiurnas: 0,
        totalGuardiasNocturnas: 0,
        totalGuardiasPasivas: 0,
        totalOtros: 0,
        totalMonto: 0        
    }
    let totalesCancelados = {
        totalMin50: 0,
        totalMin100: 0,
        totalGuardiasDiurnas: 0,
        totalGuardiasNocturnas: 0,
        totalGuardiasPasivas: 0,
        totalOtros: 0,
        totalMonto: 0
    }
    try {
        const [personal] = await pool.query(sqlPersonal, [req.session.idUsuario]);
        const [novedadesE] = await pool.query(sqlNovedadesE);
        const [nominaHabilitada] = await pool.query(sqlNominaHabilitada, [personal[0].IdCategoria]);
        const [novedades] = await pool.query(sqlNovedades, [personal[0].Id]);
        
        if (novedadesE.length > 0) {
            novedadesHasta = new Date(novedadesE[0].NovedadesHasta);
            hayLiquidacion = true;
            [nominaHabilitadaValores] = await pool.query(sqlNominaHabilitadaValores, [personal[0].IdCategoria, novedadesHasta, novedadesHasta]);
            for (let i = 0; i < nominaHabilitadaValores.length; i++) {
                if (nominaHabilitadaValores[i].ValorHora50 > 0) {
                    columnas.Horas50 = true;
                }
                if (nominaHabilitadaValores[i].ValorHora100 > 0) {
                    columnas.Horas100 = true;
                }
                if (nominaHabilitadaValores[i].ValorGuardiaDiurna > 0) {
                    columnas.GuardiasDiurnas = true;
                }
                if (nominaHabilitadaValores[i].ValorGuardiaNocturna > 0) {
                    columnas.GuardiasNocturnas = true;
                }
                if (nominaHabilitadaValores[i].ValorGuardiaPasiva > 0) {
                    columnas.GuardiasPasivas = true;
                }
            }
 
            for (let i = 0; i < novedades.length; i++) {
                if (novedades[i].Estado == 1 || novedades[i].Estado == 3) {
                totalesPendientes.totalMin50 += novedades[i].MinutosAl50;
                totalesPendientes.totalMin100 += novedades[i].MinutosAl100;
                totalesPendientes.totalGuardiasDiurnas += parseFloat(novedades[i].GD);
                totalesPendientes.totalGuardiasNocturnas += parseFloat(novedades[i].GN);
                totalesPendientes.totalGuardiasPasivas += parseFloat(novedades[i].GuardiasPasivas);
                totalesPendientes.totalMonto += parseFloat(novedades[i].Monto);
                }
                if (novedades[i].Estado == 2 || novedades[i].Estado == 4) {
                totalesCancelados.totalMin50 += novedades[i].MinutosAl50;
                totalesCancelados.totalMin100 += novedades[i].MinutosAl100;
                totalesCancelados.totalGuardiasDiurnas += parseFloat(novedades[i].GD);
                totalesCancelados.totalGuardiasNocturnas += parseFloat(novedades[i].GN);
                totalesCancelados.totalGuardiasPasivas += parseFloat(novedades[i].GuardiasPasivas);
                totalesCancelados.totalMonto += parseFloat(novedades[i].Monto);
                }
                if (novedades[i].Estado == 5) {
                totalesConfirmados.totalMin50 += novedades[i].MinutosAl50;
                totalesConfirmados.totalMin100 += novedades[i].MinutosAl100;
                totalesConfirmados.totalGuardiasDiurnas += parseFloat(novedades[i].GD);
                totalesConfirmados.totalGuardiasNocturnas += parseFloat(novedades[i].GN);
                totalesConfirmados.totalGuardiasPasivas += parseFloat(novedades[i].GuardiasPasivas);
                totalesConfirmados.totalMonto += parseFloat(novedades[i].Monto);
                }
            }
        }
        for (let i = 0; i < nominaHabilitada.length; i++) {
            if (nominaHabilitada[i].HaceGuardiasDiurnas) {
                botonGuardias = true;
            }
            if (nominaHabilitada[i].HaceGuardiasPasivas) {
                botonGuardiasPasivas = true;
            }
            if (nominaHabilitada[i].InformaValorSueldoBasico) {
                botonHoras = true;
            }
        };

        return render(req, res, 'novedades', { personal: personal[0], nominaHabilitada: nominaHabilitada[0], nominaValores: nominaHabilitadaValores, columnas: columnas, novedades: novedades, botonGuardias, botonGuardiasPasivas, botonHoras, hayLiquidacion, totalesPendientes, totalesConfirmados, totalesCancelados });

    } catch (error) {     
        enviarMensaje(req, res, "Error", error.message, 'danger');
        console.error(error);
        return res.redirect('/');
    }

});

// Carga de nuevas novedades

router.get('/agregarHoras/:Legajo', logueado, async (req, res) => {
    const { Legajo } = req.params;
    const sqlPersonal = 'SELECT * FROM personal WHERE Legajo = ?';
    const sqlNominaHabilitada = 'SELECT nominahabilitada.IdCategoria, nominahabilitada.IdNomina, nomina.Id, nomina.Descripcion FROM nominahabilitada INNER JOIN nomina ON nominahabilitada.IdNomina = nomina.Id WHERE nominahabilitada.IdCategoria = ?';
    
    try {
        const [personal] = await pool.query(sqlPersonal, [Legajo]);
        const [nominaHabilitada] = await pool.query(sqlNominaHabilitada, [personal[0].IdCategoria]);

        return render(req, res, 'EditarHoras', { nominaHabilitada: nominaHabilitada, Legajo: personal[0].Legajo, Apenom: personal[0].ApellidoYNombre, ItemNomina: nominaHabilitada[0].IdNomina });
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, "Error", error.message, 'error');
        return res.redirect('/novedades');

    }

});

router.post('/agregarHoras',logueado, async (req, res) => {
    const { Legajo, ItemNomina, FechaEntrada, HoraEntrada, FechaSalida, HoraSalida} = req.body;
    const sqlPersonal = 'SELECT * FROM personal WHERE Legajo = ?';
    const sqlCategorias = 'SELECT * FROM categorias WHERE Id = ?';
    const sqlSectores = 'SELECT * FROM sectores WHERE Id = ?';
    const sqlNominaValoresR = "SELECT * FROM nominavaloresr WHERE IdNomina = ? AND VigenciaDesde <= ? AND VigenciaHasta >= ?";
    const sqlNovedadesE = 'SELECT * FROM novedadese WHERE Actual = 1';
        const sqlNovedadesR = 'INSERT INTO novedadesr (IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, Hs50, Hs100, Monto, IdNomina, IdTurno, IdCategoria, IdEstado, IdSupervisor, MinutosAl50, MinutosAl100, Inicio, Fin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const sqlControlFecha = "SELECT 1 FROM novedadesr WHERE IdEmpleado = ? AND IdEstado NOT IN (2,4) AND Id <> ? AND Fin > ? AND Inicio < ? LIMIT 1";
    // Construye fechas en UTC a partir de fecha/hora locales del formulario
    const FechaDesde = fechaHoraLocalAUtc(FechaEntrada, HoraEntrada);
    const FechaHasta = fechaHoraLocalAUtc(FechaSalida, HoraSalida);
    let valorMinutos50 = 0;
    let valorMinutos100 = 0;
    let monto = 0;
    let area = 0;
    let idSupervisor = 0;
    

    try {
        
        if (FechaHasta < FechaDesde) {
            throw new Error('La fecha de salida no puede ser anterior a la fecha de entrada');
        }
        if (FechaDesde > new Date()) {
            throw new Error('La fecha de entrada no puede ser posterior a la fecha actual');
        }
        const [novedadesE] = await pool.query(sqlNovedadesE);
        if (novedadesE.length <= 0) {
            throw new Error('No hay liquidación en curso');
        }
        if (FechaDesde > novedadesE[0].NovedadesHasta) {
            throw new Error('No se pueden ingresar novedades posteriores al cierre de esta liquidación');
        }
        const [personal] = await pool.query(sqlPersonal, [Legajo]);
        if (personal.length <= 0) {
            throw new Error('Legajo no encontrado');
        }
        const [categorias] = await pool.query(sqlCategorias, [personal[0].IdCategoria]);
        if (categorias.area = "Administrativa") {
            area = 1;
        } else {
            area = 2;
        }
        //Controlo que las horas ingresadas no se superpongan con otras cargadas anteriormente
    console.log(`Controlando fechas: ${personal[0].Id}, ${FechaASqlFecha(FechaDesde)}, ${FechaASqlFecha(FechaHasta)}`);
    const [controlFecha] = await pool.query(sqlControlFecha, [personal[0].Id, FechaASqlFecha(FechaDesde), FechaASqlFecha(FechaDesde), FechaASqlFecha(FechaHasta), FechaASqlFecha(FechaHasta)]);
        if (controlFecha.length > 0) {
            throw new Error('Las horas ingresadas se superponen con otras ingresadas anteriormente'); 
        }

        const [sectores] = await pool.query(sqlSectores, [personal[0].IdSector]);
        idSupervisor = sectores[0].IdSupervisor;
    const [nominaValoresR] = await pool.query(sqlNominaValoresR, [ItemNomina, FechaASqlFecha(FechaDesde), FechaASqlFecha(FechaDesde)]);
        valorMinutos50 = nominaValoresR[0].ValorHora50 / 60 * TotalHoras50(FechaDesde, FechaHasta)[0];
        valorMinutos100 = nominaValoresR[0].ValorHora100 / 60 * TotalHoras100(FechaDesde, FechaHasta)[0];
        monto = valorMinutos50 + valorMinutos100;
    await pool.query(sqlNovedadesR, [
            novedadesE[0].Id, 
            area, 
            personal[0].IdSector, 
            personal[0].Id, 
            FechaEntrada, 
            TotalHoras50(FechaDesde, FechaHasta)[1], 
            TotalHoras100(FechaDesde, FechaHasta)[1], 
            monto, 
            nominaValoresR[0].IdNomina,
            personal[0].IdTurno,
            personal[0].IdCategoria,
            1, 
            idSupervisor,
            TotalHoras50(FechaDesde, FechaHasta)[0],
            TotalHoras100(FechaDesde, FechaHasta)[0],
            FechaASqlFecha(FechaDesde),
            FechaASqlFecha(FechaHasta)]);
        return res.redirect('/novedades');
    } catch (error) {
        enviarMensaje(req, res, "Error", error.message, 'warning');
        console.error(error);
        return res.redirect('/novedades/agregarHoras/' + Legajo);
    }


});

router.get('/EditarHoras/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sqlPersonal = 'SELECT * FROM personal WHERE Id = ?';
    const sqlNominaHabilitada = 'SELECT nominahabilitada.IdCategoria, nominahabilitada.IdNomina, nomina.Id, nomina.Descripcion FROM nominahabilitada INNER JOIN nomina ON nominahabilitada.IdNomina = nomina.Id WHERE nominahabilitada.IdCategoria = ?';
    const sqlNovedadesR = 'SELECT * FROM novedadesr WHERE Id = ?';
    try {
        const [novedadesR] = await pool.query(sqlNovedadesR, [Id]);
        if (novedadesR.length <= 0) {
            throw new Error('Novedad no encontrada');
        }
        const [personal] = await pool.query(sqlPersonal, [novedadesR[0].IdEmpleado]);
        if (personal.length <= 0) {
            throw new Error('Empleado no encontrado');
        }
        const [nominaHabilitada] = await pool.query(sqlNominaHabilitada, [personal[0].IdCategoria]);
        console.log(nominaHabilitada);
        return render(req, res, 'EditarHoras', {Id: Id, novedadesR: novedadesR[0], nominaHabilitada: nominaHabilitada, Legajo: personal[0].Legajo, Apenom: personal[0].ApellidoYNombre, ItemNomina: nominaHabilitada[0].IdNomina });
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, "Error", error.message, 'danger');
        return res.redirect('/novedades');

    }

});

router.post('/EditarHoras/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const { NominaHabilitada, FechaInicio, HoraInicio, FechaFin, HoraFin} = req.body;
    console.log(req.body);
    const sqlConsultaNovedadesR = 'SELECT * FROM novedadesr WHERE Id = ?';
    const sqlPersonal = 'SELECT * FROM personal WHERE Id = ?';
    const sqlNominaValoresR = "SELECT * FROM nominavaloresr WHERE IdNomina = ? AND VigenciaDesde <= ? AND VigenciaHasta >= ?";
    const sqlNovedadesE = 'SELECT * FROM novedadese WHERE Actual = 1';
        const sqlNovedadesR = 'UPDATE novedadesr SET Fecha = ?, Hs50 = ?, Hs100 = ?, Monto = ?, IdNomina = ?, IdEstado = ?, MinutosAl50 = ?, MinutosAl100 = ?, Inicio = ?, Fin = ? WHERE Id = ?';
        const sqlControlFecha = "SELECT * FROM novedadesr WHERE IdEmpleado = ? AND IdEstado NOT IN (2,4) AND Id <> ? AND Fin > ? AND Inicio < ? LIMIT 1";
    const FechaDesde = fechaHoraLocalAUtc(FechaInicio, HoraInicio);
    const FechaHasta = fechaHoraLocalAUtc(FechaFin, HoraFin);
    let valorMinutos50 = 0;
    let valorMinutos100 = 0;
    let monto = 0;
    

    try {
        const [consultaNovedadesR] = await pool.query(sqlConsultaNovedadesR, [Id]);
        if (consultaNovedadesR.length <= 0) {
            throw new Error('Novedad no encontrada');
        }
        if (FechaHasta < FechaDesde) {
            throw new Error('La fecha de salida no puede ser anterior a la fecha de entrada');
        }
        if (FechaDesde > new Date()) {
            throw new Error('La fecha de entrada no puede ser posterior a la fecha actual');
        }
        const [novedadesE] = await pool.query(sqlNovedadesE);
        if (novedadesE.length <= 0) {
            throw new Error('No hay liquidación en curso');
        }
        if (FechaDesde > novedadesE[0].NovedadesHasta) {
            throw new Error('No se pueden ingresar novedades posteriores al cierre de esta liquidación');
        }
        const [personal] = await pool.query(sqlPersonal, [consultaNovedadesR[0].IdEmpleado]);
        if (personal.length <= 0) {
            throw new Error('Legajo no encontrado');
        }

        //Controlo que las horas ingresadas no se superpongan con otras cargadas anteriormente

    const [controlFecha] = await pool.query(sqlControlFecha, [personal[0].Id, FechaASqlFecha(FechaDesde), FechaASqlFecha(FechaHasta)]);
        if (controlFecha.length > 0) {
            throw new Error('Las horas ingresadas se superponen con otras ingresadas anteriormente'); 
        }

        const [nominaValoresR] = await pool.query(sqlNominaValoresR, [NominaHabilitada, FechaASqlFecha(FechaDesde), FechaASqlFecha(FechaDesde)]);

        valorMinutos50 = nominaValoresR[0].ValorHora50 / 60 * TotalHoras50(FechaDesde, FechaHasta)[0];
        valorMinutos100 = nominaValoresR[0].ValorHora100 / 60 * TotalHoras100(FechaDesde, FechaHasta)[0];
        monto = valorMinutos50 + valorMinutos100;
    await pool.query(sqlNovedadesR, [
            FechaInicio, 
                        TotalHoras50(FechaDesde, FechaHasta)[1], 
                        TotalHoras100(FechaDesde, FechaHasta)[1], 
                        monto, 
                        nominaValoresR[0].IdNomina,
                        1, 
                        TotalHoras50(FechaDesde, FechaHasta)[0],
                        TotalHoras100(FechaDesde, FechaHasta)[0],
            FechaASqlFecha(FechaDesde),
            FechaASqlFecha(FechaHasta),
                        Id]);
        return res.redirect('/novedades');
    } catch (error) {
        enviarMensaje(req, res, "Error", error.message, 'warning');
        console.error(error);
        return res.redirect('/novedades/EditarHoras/' + Id);
    }


});

router.get('/Borrar/:IdNovedadesR', logueado, async (req, res) => {
    const { IdNovedadesR } = req.params;
    const sqlBorrar = 'DELETE FROM novedadesr WHERE Id = ?';
    try {
        await pool.query(sqlBorrar, [IdNovedadesR]);
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error en el servidor');
    }
    return res.redirect('/novedades');
});

router.get('/agregarGuardias/:Legajo', logueado, async (req, res) => {
    const { Legajo } = req.params;
    const sqlPersonal = 'SELECT * FROM personal WHERE Legajo = ?';
    const sqlNominaHabilitada = 'SELECT nominahabilitada.IdCategoria, nominahabilitada.IdNomina, nomina.Id, nomina.Descripcion, nomina.HaceGuardiasDiurnas FROM nominahabilitada INNER JOIN nomina ON nominahabilitada.IdNomina = nomina.Id WHERE nomina.HaceGuardiasDiurnas = 1 AND nominahabilitada.IdCategoria = ?';
    const sqlGuardias = 'SELECT * FROM guardias';
    try {
        const [personal] = await pool.query(sqlPersonal, [Legajo]);
        const [nominaHabilitada] = await pool.query(sqlNominaHabilitada, [personal[0].IdCategoria]);
        const [guardias] = await pool.query(sqlGuardias);

        if (nominaHabilitada.length <= 0) {
            throw new Error('Empleado no habilitado para hacer guardias');
        }

        return render(req, res, 'EditarGuardias', { guardias: guardias, Legajo: personal[0].Legajo, Apenom: personal[0].ApellidoYNombre});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error en el servidor');
    }

});
router.post('/agregarGuardias', logueado, async (req, res) => {
    const { Fecha, Legajo, IdGuardia, TipoGuardia, HoraInicio, HoraFin} = req.body;
    const sqlPersonal = 'SELECT * FROM personal WHERE Legajo = ?';
    const sqlCategorias = 'SELECT * FROM categorias WHERE Id = ?';
    const sqlSector = 'SELECT * FROM sectores WHERE Id = ?';
    const sqlNovedadesE = 'SELECT * FROM novedadese WHERE Actual = 1';
    const sqlGuardias = 'SELECT * FROM guardias WHERE Id = ?';
    const sqlNominaActualizada = 'SELECT * FROM nominavaloresr WHERE IdNomina = ? AND VigenciaDesde <= ? AND VigenciaHasta >= ?';
    const sqlNovedadesR = 'INSERT INTO novedadesr (IdNovedadesE, Area, IdSector, IdEmpleado, Fecha, GuardiasDiurnas, GuardiasNocturnas, Monto, IdGuardia, IdParcial, IdNomina, IdTurno, IdCategoria, IdEstado, IdSupervisor, MinutosGD, MinutosGN, Inicio, Fin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)';   
    const sqlConsultaNovedadesR = 'SELECT 1 FROM novedadesr WHERE IdEmpleado = ? AND IdEstado NOT IN (2,4) AND Fin > ? AND Inicio < ? LIMIT 1';
    let fechaInicio;
    let fechaFin;
    let monto = 0;
    let coeficienteGuardiaDiurna = 0;
    let coeficienteGuardiaNocturna = 0;
    let minutosGuardiaDiurna = 0;
    let minutosGuardiaNocturna = 0;


    try {
        const [Personal] = await pool.query(sqlPersonal, [Legajo]);
        if (Personal.length <= 0) {
            throw new Error('Legajo no encontrado');
        }
        const [Categorias] = await pool.query(sqlCategorias, [Personal[0].IdCategoria]);
        if (Categorias.length <= 0) {
            throw new Error('Categoría no encontrada');
        }
        const [Sectores] = await pool.query(sqlSector, [Personal[0].IdSector]);
        if (Sectores.length <= 0) {
            throw new Error('Sector no encontrado');
        }
        const [NovedadesE] = await pool.query(sqlNovedadesE);
        if (NovedadesE.length <= 0) {
            throw new Error('No hay liquidación en curso');
        }
        const [Guardias] = await pool.query(sqlGuardias, [IdGuardia]);
        if (Guardias.length <= 0) {
            throw new Error('Guardia no encontrada');
        }
        if (TipoGuardia == 1) {
            fechaInicio = fechaHoraLocalAUtc(Fecha, ExtraerHora(FechaSqlAFecha(Guardias[0].Inicio)));
            //Si la fecha de inicio es menor a la fecha de fin, sumo un día
            if (FechaSqlAFecha(Guardias[0].Inicio).getDate() < FechaSqlAFecha(Guardias[0].Fin).getDate()) {
                fechaFin = fechaHoraLocalAUtc(Fecha, ExtraerHora(FechaSqlAFecha(Guardias[0].Fin)));
                fechaFin.setDate(fechaFin.getDate() + 1);
            } else {
                fechaFin = fechaHoraLocalAUtc(Fecha, ExtraerHora(FechaSqlAFecha(Guardias[0].Fin)));
            }
        } else {
            fechaInicio = fechaHoraLocalAUtc(Fecha, HoraInicio);
            fechaFin = fechaHoraLocalAUtc(Fecha, HoraFin);
            if (fechaFin < fechaInicio) {
                fechaFin.setDate(fechaFin.getDate() + 1);
            }
        }
        if (fechaFin < fechaInicio) {
            throw new Error('La fecha de salida no puede ser anterior a la fecha de inicio');
        }
        if (fechaInicio > new Date()) {
            throw new Error('La fecha de inicio no puede ser posterior a la fecha actual');
        }
        if (fechaFin > new Date()) {
            throw new Error('La fecha de salida no puede ser posterior a la fecha actual');
        }
        if (fechaInicio > NovedadesE[0].NovedadesHasta) {
            throw new Error('No se pueden ingresar novedades posteriores al cierre de esta liquidación');
        }
    const [ConsultaNovedadesR] = await pool.query(sqlConsultaNovedadesR, [Personal[0].Id, FechaASqlFecha(fechaInicio), FechaASqlFecha(fechaFin)]);
        if (ConsultaNovedadesR.length > 0) {
            throw new Error('Las horas ingresadas se superponen con otras ingresadas anteriormente');
        }
        const [NominaActualizada] = await pool.query(sqlNominaActualizada, [Guardias[0].IdNomina, FechaASqlFecha(fechaInicio), FechaASqlFecha(fechaInicio)]);

        if (Guardias[0].Tipo == 1) {
            coeficienteGuardiaDiurna = ((fechaFin - fechaInicio) / 60000)/((Guardias[0].Fin - Guardias[0].Inicio)/60000)* Guardias[0].Cantidad;
            monto = coeficienteGuardiaDiurna * NominaActualizada[0].ValorGuardiaDiurna;
            minutosGuardiaDiurna = (fechaFin - fechaInicio) / 60000;
        } else {
            coeficienteGuardiaNocturna = ((fechaFin - fechaInicio) / 60000)/((Guardias[0].Fin - Guardias[0].Inicio)/60000)* Guardias[0].Cantidad;
            monto = coeficienteGuardiaNocturna * NominaActualizada[0].ValorGuardiaNocturna;
            minutosGuardiaNocturna = ((fechaFin - fechaInicio)/ 60000);
        }

        await pool.query(sqlNovedadesR, [
            NovedadesE[0].Id,
            Categorias[0].Area == "Administrativa" ? 1 : 2,
            Personal[0].IdSector,
            Personal[0].Id,
            Fecha,
            coeficienteGuardiaDiurna,
            coeficienteGuardiaNocturna,
            monto,
            IdGuardia,
            TipoGuardia,
            Guardias[0].IdNomina,
            Personal[0].IdTurno,
            Personal[0].IdCategoria,
            1,
            Sectores[0].IdSupervisor,
            minutosGuardiaDiurna,
            minutosGuardiaNocturna,
            fechaInicio,
            fechaFin
        ]);
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, "Error", error.message, 'warning');
        return res.redirect('/novedades/agregarGuardias/' + Legajo);
    }

    return res.redirect('/novedades');

});
router.get('/EditarGuardias/:Id', logueado, async (req, res) => {
    const { Id } = req.params;

    const sqlNovedadesR = 'SELECT * FROM novedadesr WHERE Id = ?';
    const sqlGuardias = 'SELECT * FROM guardias';
    const sqlPersonal = 'SELECT Id, Legajo, ApellidoYNombre FROM personal WHERE Id = ?';

    try {
        const [novedadesR] = await pool.query(sqlNovedadesR, [Id]);
        if (novedadesR.length <= 0) {
            throw new Error('Novedad no encontrada');
        }
        const [personal] = await pool.query(sqlPersonal, [novedadesR[0].IdEmpleado]);
        if (personal.length <= 0) {
            throw new Error('Legajo no encontrado');
        }
        const Apenom = personal[0].ApellidoYNombre;
 
        const [guardias] = await pool.query(sqlGuardias);

        if (novedadesR[0].MinutosAl50 > 0 || novedadesR[0].MinutosAl100 > 0) {
            return render(req,res,'EditarHoras', {Id: Id, Legajo: personal[0].Legajo, Apenom: Apenom, novedadesR: novedadesR[0], guardias: guardias});  
        }
        if (novedadesR[0].MinutosGD > 0 || novedadesR[0].MinutosGN > 0) {
            return render(req,res,'EditarGuardias', {Id: Id, Legajo: personal[0].Legajo, Apenom: Apenom, novedadesR: novedadesR[0], guardias: guardias});
        }
        else
        {
            throw new Error('Error al seleccionar el tipo de novedad a editar');
        }
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, "Error", error.message, 'warning');
        return res.redirect('/novedades');
    }
});
router.post('/EditarGuardia/:Id', logueado, async (req, res) => {
    const Id = req.params.Id;
    const { Legajo, Fecha, IdGuardia, TipoGuardia, HoraInicio, HoraFin } = req.body;
    const sqlPersonal = 'SELECT * FROM personal WHERE Legajo = ?';
    const sqlCategorias = 'SELECT * FROM categorias WHERE Id = ?';
    const sqlSector = 'SELECT * FROM sectores WHERE Id = ?';
    const sqlNovedadesE = 'SELECT * FROM novedadese WHERE Actual = 1';
    const sqlGuardias = 'SELECT * FROM guardias WHERE Id = ?';
    const sqlNominaActualizada = 'SELECT * FROM nominavaloresr WHERE IdNomina = ? AND VigenciaDesde <= ? AND VigenciaHasta >= ?';
    const sqlNovedadesR = 'UPDATE novedadesr SET Fecha = ?, GuardiasDiurnas = ?, GuardiasNocturnas = ?, Monto = ?, IdGuardia = ?, IdParcial = ?, IdEstado = ?, MinutosGD = ?, MinutosGN = ?, Inicio = ?, Fin = ? WHERE Id = ?';   
    const sqlConsultaNovedadesR = 'SELECT 1 FROM novedadesr WHERE IdEmpleado = ? AND IdEstado NOT IN (2,4) AND Id <> ? AND Fin > ? AND Inicio < ? LIMIT 1';
    let fechaInicio;
    let fechaFin;
    let monto = 0;
    let coeficienteGuardiaDiurna = 0;
    let coeficienteGuardiaNocturna = 0;
    let minutosGuardiaDiurna = 0;
    let minutosGuardiaNocturna = 0;


    try {
        const [Personal] = await pool.query(sqlPersonal, [Legajo]);
        if (Personal.length <= 0) {
            throw new Error('Legajo no encontrado');
        }
        const [Categorias] = await pool.query(sqlCategorias, [Personal[0].IdCategoria]);
        if (Categorias.length <= 0) {
            throw new Error('Categoría no encontrada');
        }
        const [Sectores] = await pool.query(sqlSector, [Personal[0].IdSector]);
        if (Sectores.length <= 0) {
            throw new Error('Sector no encontrado');
        }
        const [NovedadesE] = await pool.query(sqlNovedadesE);
        if (NovedadesE.length <= 0) {
            throw new Error('No hay liquidación en curso');
        }
        const [Guardias] = await pool.query(sqlGuardias, [IdGuardia]);
        if (Guardias.length <= 0) {
            throw new Error('Guardia no encontrada');
        }
        if (TipoGuardia == 1) {
            fechaInicio = fechaHoraLocalAUtc(Fecha, ExtraerHora(FechaSqlAFecha(Guardias[0].Inicio)));
            //Si la fecha de inicio es menor a la fecha de fin, sumo un día
            if (FechaSqlAFecha(Guardias[0].Inicio).getDate() < FechaSqlAFecha(Guardias[0].Fin).getDate()) {
                fechaFin = fechaHoraLocalAUtc(Fecha, ExtraerHora(FechaSqlAFecha(Guardias[0].Fin)));
                fechaFin.setDate(fechaFin.getDate() + 1);
            } else {
                fechaFin = fechaHoraLocalAUtc(Fecha, ExtraerHora(FechaSqlAFecha(Guardias[0].Fin)));
            }
        } else {
            fechaInicio = fechaHoraLocalAUtc(Fecha, HoraInicio);
            fechaFin = fechaHoraLocalAUtc(Fecha, HoraFin);
            if (fechaFin < fechaInicio) {
                fechaFin.setDate(fechaFin.getDate() + 1);
            }
        }
        if (fechaFin < fechaInicio) {
            throw new Error('La fecha de salida no puede ser anterior a la fecha de inicio');
        }
        if (fechaInicio > new Date()) {
            throw new Error('La fecha de inicio no puede ser posterior a la fecha actual');
        }
        if (fechaInicio > NovedadesE[0].NovedadesHasta) {
            throw new Error('No se pueden ingresar novedades posteriores al cierre de esta liquidación');
        }
    const [ConsultaNovedadesR] = await pool.query(sqlConsultaNovedadesR, [Personal[0].Id, Id, FechaASqlFecha(fechaInicio), FechaASqlFecha(fechaFin)]);
        if (ConsultaNovedadesR.length > 0) {
            throw new Error('Las horas ingresadas se superponen con otras ingresadas anteriormente');
        }
        const [NominaActualizada] = await pool.query(sqlNominaActualizada, [Guardias[0].IdNomina, FechaASqlFecha(fechaInicio), FechaASqlFecha(fechaInicio)]);

        if (Guardias[0].Tipo == 1) {
            coeficienteGuardiaDiurna = ((fechaFin - fechaInicio) / 60000)/((Guardias[0].Fin - Guardias[0].Inicio)/60000)* Guardias[0].Cantidad;
            monto = coeficienteGuardiaDiurna * NominaActualizada[0].ValorGuardiaDiurna;
            minutosGuardiaDiurna = (fechaFin - fechaInicio) / 60000;
        } else {
            coeficienteGuardiaNocturna = ((fechaFin - fechaInicio) / 60000)/((Guardias[0].Fin - Guardias[0].Inicio)/60000)* Guardias[0].Cantidad;
            monto = coeficienteGuardiaNocturna * NominaActualizada[0].ValorGuardiaNocturna;
            minutosGuardiaNocturna = ((fechaFin - fechaInicio)/ 60000);
        }

        await pool.query(sqlNovedadesR, [
            Fecha,
            coeficienteGuardiaDiurna,
            coeficienteGuardiaNocturna,
            monto,
            IdGuardia,
            TipoGuardia,
            1,
            minutosGuardiaDiurna,
            minutosGuardiaNocturna,
            fechaInicio,
            fechaFin, 
            Id
        ]);
    } catch (error) {
        console.error(error);
        enviarMensaje(req, res, "Error", error.message, 'warning');
        return res.redirect('/novedades/EditarGuardias/' + Id);
    }

    return res.redirect('/novedades');


});
module.exports = router;