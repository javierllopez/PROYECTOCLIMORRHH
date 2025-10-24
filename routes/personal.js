const express = require('express');
const { Tabla } = require('../Clases/Tabla');
const { pool } = require('../conexion');
const { logueado } = require('../Middleware/validarUsuario');
const {render} = require('../Middleware/render');
const { FechaSqlAFechaCorta, FechaASqlFecha, FechaSqlAFecha} = require('../lib/libreria');
const bcrypt = require('bcrypt');
const router = express.Router();
const nivelAceptado = [1]; //Nivel de usuario aceptado para esta ruta

const personal = new Tabla('personal', true, true);
personal.agregarCampo({ campo: 'Id', titulo: 'Id', tipoDato: 'numero', ancho: '10%', visible: false });
personal.agregarCampo({ campo: 'legajo', titulo: 'Legajo', tipoDato: 'numero', ancho: '10%' });
personal.agregarCampo({ campo: 'ApellidoYNombre', titulo: 'Nombre', tipoDato: 'texto', ancho: '15%' });
personal.agregarCampo({ campo: 'idSector', titulo: 'idSector', tipoDato: 'numero', ancho: '15%', visible: false });
personal.agregarCampo({ campo: 'Id', titulo: 'Id', alias: 'idS', tipoDato: 'numero', ancho: '20%', visible: false, tabla: 'sectores' });
personal.agregarCampo({ campo: 'Descripcion', titulo: 'Sector', alias: 'sector', tipoDato: 'texto', ancho: '15%', tabla: 'sectores' });
personal.agregarCampo({ campo: 'idCategoria', titulo: 'idCategoria', tipoDato: 'numero', ancho: '10%', visible: false });
personal.agregarCampo({ campo: 'Id', titulo: 'Id', alias: 'idC', tipoDato: 'numero', ancho: '10%', visible: false, tabla: 'categorias' });
personal.agregarCampo({ campo: 'Descripcion', titulo: 'Categoria', alias: 'categoria', tipoDato: 'texto', ancho: '15%', tabla: 'categorias' });
personal.agregarCampo({ campo: 'idTurno', titulo: 'idTurno', tipoDato: 'numero', ancho: '10%', visible: false });
personal.agregarCampo({ campo: 'Id', titulo: 'Id', alias: 'idT', tipoDato: 'numero', ancho: '10%', visible: false, tabla: 'turnos' });
personal.agregarCampo({ campo: 'Descripcion', titulo: 'Turno', alias: 'turno', tipoDato: 'texto', ancho: '15%', tabla: 'turnos' });
personal.agregarCampo({ campo: 'nivel', titulo: 'Rol', tipoDato: 'texto', ancho: '15%' });
personal.agregarCampo({ campo: 'FechaBaja', titulo: 'Fecha de Baja', tipoDato: 'fecha', ancho: '15%', visible: false });
personal.agregarRelacion(1, 'personal', 'idSector', 'sectores', 'id');
personal.agregarRelacion(1, 'personal', 'idCategoria', 'categorias', 'id');
personal.agregarRelacion(1, 'personal', 'idTurno', 'turnos', 'id');

router.all('*', logueado, (req, res, next) => {
    if (nivelAceptado.includes(req.session.nivelUsuario)) {
        return next();
    } else {
        return res.redirect('/');
    }
});

router.post('/filtrar', logueado, async (req, res) => {
    const { i, filtro } = req.body;
    if (!req.session.personal) {
        req.session.personal = {};
        req.session.personal.estructura = personal.exportarEstructura();
    } else {
        personal.importarEstructura(req.session.personal.estructura);
    };
    personal.cambiarFiltro(i, filtro);
    personal.paginaActual = 1;
    req.session.personal.estructura.paginaActual = 1;
    res.redirect('/personal');

});

router.post('/ordenar', logueado, async (req, res) => {
    const { campo } = req.body;
    if (!req.session.personal) {
        req.session.personal = {};
        req.session.personal.estructura = personal.exportarEstructura();
    } else {
        personal.importarEstructura(req.session.personal.estructura);
    };
    personal.cambiarOrden(campo);
    return res.redirect('/personal');
});

router.post('/paginar', logueado, async (req, res) => {
    const { pagina } = req.body;
    if (!req.session.personal) {
        req.session.personal = {};
        req.session.personal.estructura = personal.exportarEstructura();
    } else {
        personal.importarEstructura(req.session.personal.estructura);
    };
    req.session.personal.estructura.paginaActual = pagina;
    personal.paginaActual = pagina;
    return res.redirect('/personal');
});

router.get('/', logueado, async (req, res) => {
    if (!req.session.personal) {
        req.session.personal = {};
        req.session.personal.estructura = personal.exportarEstructura();
    } else {
        personal.importarEstructura(req.session.personal.estructura);
    };
    const filtroBaja = "FechaBaja IS NULL";
    personal.aplicarFiltroGeneral(filtroBaja);
    personal.getTotalRegistros();
    var sql = personal.getSQL();
    var encabezadoHTML = personal.getEncabezadoCSP();
    var paginador = await personal.getPaginadorCSP();
    var funciones = "";
 
    try {
        const [tabla, fields] = await pool.query(sql);
    return render(req, res, 'personal', { encabezadoHTML: encabezadoHTML, tabla: tabla, paginador: paginador, funciones: funciones, permiteBorrar: personal.borrable , permiteEditar: personal.editable });
    }
    catch(err) {
        console.log(err);
    }
   
});

//Rutas para edición de personal

//Agregar personal

router.get('/agregar', logueado, async (req, res) => {
    const sqlMax = 'SELECT MAX(legajo) as legajo FROM personal';
    const sqlSectores = 'SELECT * FROM sectores ORDER BY Descripcion';
    const sqlCategorias = 'SELECT categorias.Id, categorias.Descripcion, categorias.Area, nominahabilitada.Id as IdNominaHabilitada, nominahabilitada.IdCategoria, nominahabilitada.IdNomina AS IdNomina, nominahabilitada.IdEmpleado FROM categorias LEFT JOIN nominahabilitada ON categorias.Id = nominahabilitada.IdCategoria ORDER BY categorias.Descripcion';
    const sqlTurnos = 'SELECT * FROM turnos ORDER BY Descripcion';
    const sqlNominas = 'SELECT Id, Descripcion FROM nomina ORDER BY Descripcion';

    try {
        var[max] = await pool.query(sqlMax);
        var [sectores] = await pool.query(sqlSectores);
        var [categorias] = await pool.query(sqlCategorias);
        var [turnos] = await pool.query(sqlTurnos);
        var [nominas] = await pool.query(sqlNominas);
        var legajo =  max[0].legajo == null ? 1 : max[0].legajo + 1;


        return render(req, res, 'personalEditar', { sectores: sectores, categorias: categorias, turnos: turnos, nuevoLegajo: legajo, nominas: nominas });
    }
    catch(err) {
        console.log(err);
    }
});

router.post('/agregar', logueado, async (req, res) => {
    const { legajo, apellido, nombres, fechaNacimiento, fechaIngreso, CUIL, DNI, idSector, idCategoria, idTurno, correoElectronico, nivel, idNominaSeleccionada } = req.body;

    const sqlUsuario = "INSERT INTO usuarios (usuario, clave, activo, nivel, CorreoElectronico, primerAcceso) VALUES (?, ?, ?, ?, ?, ?)";
    const sqlPersonal = 'SELECT * FROM personal WHERE DNI = ?';
    const sqlLegajo = 'SELECT * FROM personal WHERE Legajo = ?';
    const sql = 'INSERT INTO personal (legajo, apellido, nombres, fechaNacimiento, fechaIngreso, CUIL, DNI, idSector, idCategoria, idTurno, nivel, correoElectronico, idUsuario) VALUES (?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?)';
    const sqlInsertNominaHabilitada = 'INSERT INTO nominahabilitada (IdNomina, IdEmpleado) VALUES (?, ?)';
    const conn = await pool.getConnection();
    try {
        const hashedPassword = await bcrypt.hash(DNI, 10);
        await conn.beginTransaction();
        const consultaLegajo = await conn.query(sqlLegajo, [legajo]);
        if (consultaLegajo[0].length > 0) {
            throw new Error('Ya existe un empleado con el legajo ingresado');
        }
        const consultaDni = await conn.query(sqlPersonal, [DNI]);
        if (consultaDni[0].length > 0) {
            throw new Error('Ya existe un empleado con el DNI ingresado');
        }
        const user = await conn.query(sqlUsuario, [DNI, hashedPassword, true, nivel, correoElectronico, true]);
        const idUsuario = user[0].insertId;
        await conn.query(sql, [legajo, apellido, nombres, FechaASqlFecha(new Date(fechaNacimiento)), FechaASqlFecha(new Date(fechaIngreso)), CUIL, DNI, idSector, idCategoria, idTurno, nivel, correoElectronico, idUsuario]);
        // Si se seleccionó una nómina manualmente, asociar en nominahabilitada
        if (idNominaSeleccionada !== null && idNominaSeleccionada !== undefined && idNominaSeleccionada !== '') {
            await conn.query(sqlInsertNominaHabilitada, [idNominaSeleccionada, idUsuario]);
        }
        await conn.commit();
        return res.redirect('/personal');
    }
    catch(err) {
        await conn.rollback();
        console.log(err);

        const sqlMax = 'SELECT MAX(legajo) as legajo FROM personal';
        const sqlSectores = 'SELECT * FROM sectores ORDER BY Descripcion';
        const sqlCategorias = 'SELECT categorias.Id, categorias.Descripcion, categorias.Area, nominahabilitada.Id as IdNominaHabilitada, nominahabilitada.IdCategoria, nominahabilitada.IdNomina AS IdNomina, nominahabilitada.IdEmpleado FROM categorias LEFT JOIN nominahabilitada ON categorias.Id = nominahabilitada.IdCategoria ORDER BY categorias.Descripcion';
        const sqlTurnos = 'SELECT * FROM turnos ORDER BY Descripcion';
        const sqlNominas = 'SELECT Id, Descripcion FROM nomina ORDER BY Descripcion';

        var[max] = await pool.query(sqlMax);
        var [sectores] = await pool.query(sqlSectores);
        var [categorias] = await pool.query(sqlCategorias);
        var [turnos] = await pool.query(sqlTurnos);
        var miLegajo =  max[0].legajo == null ? 1 : max[0].legajo + 1;
        var [nomina] = await pool.query(sqlNominas);
        return render(req, res, 'personalEditar', { Mensaje: { title: 'Atención', text: err.message, icon: 'error' }, sectores: sectores, categorias: categorias, turnos: turnos, nuevoLegajo: miLegajo, nominas: nomina });

    }
    finally {
        conn.release();
    }
});

router.get('/editar/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT * FROM personal WHERE Id = ?';
    const sqlSectores = 'SELECT * FROM sectores ORDER BY Descripcion';
    const sqlCategorias = 'SELECT categorias.Id, categorias.Descripcion, categorias.Area, nominahabilitada.Id as IdNominaHabilitada, nominahabilitada.IdCategoria, nominahabilitada.IdNomina AS IdNomina, nominahabilitada.IdEmpleado FROM categorias LEFT JOIN nominahabilitada ON categorias.Id = nominahabilitada.IdCategoria ORDER BY categorias.Descripcion';
    const sqlTurnos = 'SELECT * FROM turnos ORDER BY Descripcion';
    const sqlNominas = 'SELECT Id, Descripcion FROM nomina ORDER BY Descripcion';

    try {
        var [personal] = await pool.query(sql, [Id]);
        var [sectores] = await pool.query(sqlSectores);
        var [categorias] = await pool.query(sqlCategorias);
        var [turnos] = await pool.query(sqlTurnos);
        var [nominas] = await pool.query(sqlNominas);
        return render(req, res, 'personalEditar', { personal: personal[0], sectores: sectores, categorias: categorias, turnos: turnos, nominas: nominas });
    }
    catch(err) {
        console.log(err);
    }
});

router.post('/editar', logueado, async (req, res) => {
    const { Id, legajo, apellido, nombres, fechaNacimiento, fechaIngreso, CUIL, DNI, idSector, idCategoria, idTurno, correoElectronico, nivel, idNominaSeleccionada, IdUsuario } = req.body;
    const sql = 'UPDATE personal SET legajo = ?, apellido = ?, nombres = ?, fechaNacimiento = ?, fechaIngreso = ?, CUIL = ?, DNI = ?, idSector = ?, idCategoria = ?, idTurno = ?, correoElectronico = ?, nivel = ? WHERE Id = ?';
    const sqlInsertNominaHabilitada = 'INSERT INTO nominahabilitada (IdNomina, IdEmpleado) VALUES (?, ?)';
    const sqlDeleteNominaHabilitada = 'DELETE FROM nominahabilitada WHERE IdEmpleado = ?';
    const sqlUsuarios = 'UPDATE usuarios SET CorreoElectronico = ?, nivel = ? WHERE Id = ?';
    const conn = await pool.getConnection();
    console.log('IdUsuario', IdUsuario);
    console.log('Nivel', nivel);
    try {
        await conn.beginTransaction();
        await conn.query(sqlUsuarios, [correoElectronico, nivel, IdUsuario]);
        await conn.query(sql, [legajo, apellido, nombres, FechaASqlFecha(new Date(fechaNacimiento)), FechaASqlFecha(new Date(fechaIngreso)), CUIL, DNI, idSector, idCategoria, idTurno, correoElectronico, nivel, Id]);
        // Si se seleccionó una nómina manualmente, actualizar asociación en nominahabilitada
        if (idNominaSeleccionada && idCategoria) {
            await conn.query(sqlDeleteNominaHabilitada, [Id]);
            await conn.query(sqlInsertNominaHabilitada, [idNominaSeleccionada, Id]);
        }
        await conn.commit();
        return res.redirect('/personal');
    }
    catch(err) {
        await conn.rollback();
        console.log(err);
    }
    finally {
        conn.release();
    }
});

router.get('/baja/:Id', logueado, async (req, res) => {
    const { Id } = req.params;
    const sql = 'SELECT Id, ApellidoYNombre, IdUsuario FROM personal WHERE Id = ?';
    try {
        const [personal] = await pool.query(sql, [Id]);
        return render(req, res, 'personalBaja', { Id: Id, ApellidoYNombre: personal[0].ApellidoYNombre, IdUsuario: personal[0].IdUsuario });    
    }
    catch(err) {
        console.log(err);
    }
});
router.post('/baja', logueado, async (req, res) => {
    const { Id, fechaBaja, idUsuario } = req.body;
    const sql = 'UPDATE personal SET FechaBaja = ? WHERE Id = ?';
    const sqlBajaUsuario = 'UPDATE usuarios SET activo = 0 WHERE usuario = ?';
    const conn = await pool.getConnection();
    try {
        await conn.query(sql, [FechaASqlFecha(new Date(fechaBaja)), Id]);
        await conn.query(sqlBajaUsuario, [idUsuario]);
        await conn.commit();
        return res.redirect('/personal');
    }
    catch(err) {
        await conn.rollback();
        console.log(err);
    }
    finally {
        conn.release();
    }
});

// ===================== RUTAS DE IMPORTACIÓN DESDE EXCEL =====================
const multer = require('multer');
const ExcelJS = require('exceljs');
const upload = multer({ dest: 'uploads/' });

// Página para seleccionar archivo y mapear campos
router.get('/importar', logueado, (req, res) => {
    const campos = [
        { campo: 'Legajo', label: 'Legajo' },
        { campo: 'Apellido', label: 'Apellido' },
        { campo: 'Nombres', label: 'Nombres' },
        { campo: 'FechaNacimiento', label: 'Fecha de Nacimiento' },
        { campo: 'FechaIngreso', label: 'Fecha de Ingreso' },
        { campo: 'FechaBaja', label: 'Fecha de Baja' },
        { campo: 'CUIL', label: 'CUIL' },
        { campo: 'DNI', label: 'DNI' },
        { campo: 'IdSector', label: 'IdSector' },
        { campo: 'IdCategoria', label: 'IdCategoria' },
        { campo: 'IdTurno', label: 'IdTurno' },
        { campo: 'CorreoElectronico', label: 'Correo Electrónico' },
        { campo: 'Nivel', label: 'Nivel' }
    ];
    render(req, res, 'personalImportar', { campos });
});

// Recibe el archivo y muestra las columnas para mapear
router.post('/importar/preparar', logueado, upload.single('archivoExcel'), async (req, res) => {
    const campos = [
        { campo: 'Legajo', label: 'Legajo' },
        { campo: 'Apellido', label: 'Apellido' },
        { campo: 'Nombres', label: 'Nombres' },
        { campo: 'FechaNacimiento', label: 'Fecha de Nacimiento' },
        { campo: 'FechaIngreso', label: 'Fecha de Ingreso' },
        { campo: 'FechaBaja', label: 'Fecha de Baja' },
        { campo: 'CUIL', label: 'CUIL' },
        { campo: 'DNI', label: 'DNI' },
        { campo: 'IdSector', label: 'IdSector' },
        { campo: 'IdCategoria', label: 'IdCategoria' },
        { campo: 'IdTurno', label: 'IdTurno' },
        { campo: 'CorreoElectronico', label: 'Correo Electrónico' },
        { campo: 'Nivel', label: 'Nivel' }
    ];
    const tieneEncabezado = req.body.tieneEncabezado === 'on';
    const modoImportacion = req.body.modoImportacion || 'agregar';
    if (!req.file) {
        return render(req, res, 'personalImportar', { campos, Mensaje: { title: 'Error', text: 'No se seleccionó archivo.', icon: 'error' } });
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];
    let columnas = [];
    if (tieneEncabezado) {
        worksheet.getRow(1).eachCell(cell => columnas.push(cell.value));
    } else {
        worksheet.getRow(1).eachCell((cell, colNumber) => columnas.push('Columna ' + colNumber));
    }
    render(req, res, 'personalImportar', { campos, columnas, archivo: req.file.filename, tieneEncabezado, modoImportacion });
});

// Realiza la importación
router.post('/importar/ejecutar', logueado, async (req, res) => {
    const { archivo, tieneEncabezado, modoImportacion } = req.body;
    const mapeo = req.body;
    const campos = [ 'Legajo', 'Apellido', 'Nombres', 'FechaNacimiento', 'FechaIngreso', 'FechaBaja', 'CUIL', 'DNI', 'IdSector', 'IdCategoria', 'IdTurno', 'CorreoElectronico', 'Nivel' ];
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('uploads/' + archivo);
    const worksheet = workbook.worksheets[0];

    const tieneEncabezadoActivo = tieneEncabezado === 'on';
    const normalizarHeader = (valor) => {
        if (valor === undefined || valor === null) {
            return '';
        }
        if (valor instanceof Date) {
            return valor.toISOString();
        }
        if (typeof valor === 'object' && valor.text) {
            return String(valor.text).trim();
        }
        return String(valor).trim();
    };

    const extraerValorCelda = (valor) => {
        if (valor === undefined || valor === null) {
            return null;
        }
        if (valor instanceof Date) {
            return valor;
        }
        if (typeof valor === 'object') {
            if (valor.text !== undefined) {
                return String(valor.text).trim();
            }
            if (Array.isArray(valor.richText)) {
                return valor.richText.map(part => part.text).join('').trim();
            }
            if (valor.result !== undefined && valor.result !== null) {
                return valor.result;
            }
        }
        if (typeof valor === 'string') {
            return valor.trim();
        }
        return valor;
    };

    const headerMap = new Map();
    if (tieneEncabezadoActivo) {
        worksheet.getRow(1).eachCell((cell, colNumber) => {
            const etiqueta = normalizarHeader(cell.value);
            const original = cell.value === undefined || cell.value === null ? '' : String(cell.value);
            if (!headerMap.has(original)) {
                headerMap.set(original, colNumber);
            }
            if (!headerMap.has(etiqueta)) {
                headerMap.set(etiqueta, colNumber);
            }
        });
    } else {
        const primeraFila = worksheet.getRow(1);
        primeraFila.eachCell((cell, colNumber) => {
            const etiqueta = `Columna ${colNumber}`;
            headerMap.set(etiqueta, colNumber);
        });
    }

    const obtenerIndiceColumna = (seleccion) => {
        if (seleccion === undefined || seleccion === null || seleccion === '') {
            return null;
        }
        const clave = String(seleccion).trim();
        return headerMap.get(clave) || null;
    };

    let rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (tieneEncabezadoActivo && rowNumber === 1) {
            return;
        }
        let obj = {};
        campos.forEach(c => {
            const colIndex = obtenerIndiceColumna(mapeo[c]);
            if (!colIndex) {
                obj[c] = null;
                return;
            }
            const valor = extraerValorCelda(row.getCell(colIndex).value);
            obj[c] = valor;
        });
        rows.push(obj);
    });

    let insertados = 0;
    let actualizados = 0;
    let ignorados = 0;
    const legajosIgnorados = [];
    const sqlInsertPersonal = 'INSERT INTO personal (Legajo, Apellido, Nombres, FechaNacimiento, FechaIngreso, FechaBaja, CUIL, DNI, IdSector, IdCategoria, IdTurno, CorreoElectronico, nivel, idUsuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const sqlInsertUsuario = 'INSERT INTO usuarios (Usuario, Clave, Activo, Nivel, CorreoElectronico, primerAcceso) VALUES (?, ?, ?, ?, ?, ?)';
    const sqlExisteLegajo = 'SELECT Id, idUsuario FROM personal WHERE Legajo = ? LIMIT 1';
    const sqlUpdatePersonal = 'UPDATE personal SET Apellido = ?, Nombres = ?, FechaNacimiento = ?, FechaIngreso = ?, FechaBaja = ?, CUIL = ?, DNI = ?, IdSector = ?, IdCategoria = ?, IdTurno = ?, CorreoElectronico = ?, nivel = ? WHERE Legajo = ?';
    const sqlUpdateUsuario = 'UPDATE usuarios SET CorreoElectronico = ?, Nivel = ?, Activo = ? WHERE Id = ?';
    const sqlFindSector = 'SELECT Id FROM sectores WHERE Descripcion = ? LIMIT 1';
    const sqlInsertSector = "INSERT INTO sectores (Descripcion) VALUES ('NO DEFINIDO')";
    const sqlFindCategoria = 'SELECT Id FROM categorias WHERE Descripcion = ? LIMIT 1';
    const sqlInsertCategoria = "INSERT INTO categorias (Descripcion, Area) VALUES ('NO DEFINIDO', 1)";
    const sqlFindTurno = 'SELECT Id FROM turnos WHERE Descripcion = ? LIMIT 1';
    const sqlInsertTurno = "INSERT INTO turnos (Descripcion, Tipo) VALUES ('NO DEFINIDO', 'Semana Hábil')";
    let conn = await pool.getConnection();
    const bcrypt = require('bcrypt');
    try {
        if (modoImportacion === 'sobreescribir') {
            await conn.query('DELETE FROM personal');
            await conn.query('ALTER TABLE personal AUTO_INCREMENT = 1');
            await conn.query('DELETE FROM usuarios');
            await conn.query('ALTER TABLE usuarios AUTO_INCREMENT = 1');
        }
        for (let row of rows) {
            const legajo = row.Legajo;
            const legajoTexto = legajo !== undefined && legajo !== null && legajo !== '' ? String(legajo) : '(sin legajo)';
            try {
                if (legajo === undefined || legajo === null || legajo === '') {
                    ignorados++;
                    legajosIgnorados.push(legajoTexto);
                    continue;
                }

                let fechaNacimiento = row.FechaNacimiento ? new Date(row.FechaNacimiento) : null;
                let fechaIngreso = row.FechaIngreso ? new Date(row.FechaIngreso) : null;
                let fechaBaja = row.FechaBaja ? new Date(row.FechaBaja) : null;
                let fechaNacimientoSql = fechaNacimiento && !isNaN(fechaNacimiento) ? fechaNacimiento.toISOString().slice(0,10) : null;
                let fechaIngresoSql = fechaIngreso && !isNaN(fechaIngreso) ? fechaIngreso.toISOString().slice(0,10) : null;
                let fechaBajaSql = fechaBaja && !isNaN(fechaBaja) ? fechaBaja.toISOString().slice(0,10) : null;

                const [existeLegajo] = await conn.query(sqlExisteLegajo, [legajo]);
                if (existeLegajo.length > 0 && !fechaBajaSql) {
                    ignorados++;
                    legajosIgnorados.push(legajoTexto);
                    continue;
                }

                // Buscar o crear sector
                let [sector] = await conn.query(sqlFindSector, [row.IdSector]);
                let idSector;
                if (sector.length > 0) {
                    idSector = sector[0].Id;
                } else {
                    let [def] = await conn.query(sqlFindSector, ['NO DEFINIDO']);
                    if (def.length === 0) {
                        await conn.query(sqlInsertSector);
                        [def] = await conn.query(sqlFindSector, ['NO DEFINIDO']);
                    }
                    idSector = def[0].Id;
                }
                // Buscar o crear categoría
                let [categoria] = await conn.query(sqlFindCategoria, [row.IdCategoria]);
                let idCategoria;
                if (categoria.length > 0) {
                    idCategoria = categoria[0].Id;
                } else {
                    let [def] = await conn.query(sqlFindCategoria, ['NO DEFINIDO']);
                    if (def.length === 0) {
                        await conn.query(sqlInsertCategoria);
                        [def] = await conn.query(sqlFindCategoria, ['NO DEFINIDO']);
                    }
                    idCategoria = def[0].Id;
                }
                // Buscar o crear turno
                let [turno] = await conn.query(sqlFindTurno, [row.IdTurno]);
                let idTurno;
                if (turno.length > 0) {
                    idTurno = turno[0].Id;
                } else {
                    let [def] = await conn.query(sqlFindTurno, ['NO DEFINIDO']);
                    if (def.length === 0) {
                        await conn.query(sqlInsertTurno);
                        [def] = await conn.query(sqlFindTurno, ['NO DEFINIDO']);
                    }
                    idTurno = def[0].Id;
                }

                const correoNormalizado = (() => {
                    if (row.CorreoElectronico === undefined || row.CorreoElectronico === null) {
                        return null;
                    }
                    const valor = String(row.CorreoElectronico).trim();
                    return valor.length ? valor : null;
                })();

                const correoParaUsuario = correoNormalizado || '';

                if (existeLegajo.length > 0) {
                    const registroActual = existeLegajo[0];
                    await conn.query(sqlUpdatePersonal, [row.Apellido, row.Nombres, fechaNacimientoSql, fechaIngresoSql, fechaBajaSql, row.CUIL, row.DNI, idSector, idCategoria, idTurno, correoNormalizado, row.Nivel, legajo]);
                    if (registroActual.idUsuario) {
                        await conn.query(sqlUpdateUsuario, [correoParaUsuario, row.Nivel, 0, registroActual.idUsuario]);
                    }
                    actualizados++;
                    continue;
                }

                let idUsuario = null;
                if (!fechaBajaSql) {
                    if (row.DNI === undefined || row.DNI === null || row.DNI === '') {
                        throw new Error('El DNI es obligatorio para generar el usuario.');
                    }
                    const hashedPassword = await bcrypt.hash(row.DNI.toString(), 10);
                    const [usuarioResult] = await conn.query(sqlInsertUsuario, [row.DNI, hashedPassword, true, row.Nivel, correoParaUsuario, true]);
                    idUsuario = usuarioResult.insertId;
                }

                await conn.query(sqlInsertPersonal, [legajo, row.Apellido, row.Nombres, fechaNacimientoSql, fechaIngresoSql, fechaBajaSql, row.CUIL, row.DNI, idSector, idCategoria, idTurno, correoNormalizado, row.Nivel, idUsuario]);
                insertados++;
            } catch (err) {
                ignorados++;
                legajosIgnorados.push(legajoTexto);
                console.log(`Error al insertar fila: ${err.message}`);
                // Puedes loguear el error y la fila aquí si lo deseas
            }
        }
        await conn.commit();
        const detalleIgnorados = legajosIgnorados.length ? legajosIgnorados.join(', ') : 'Ninguno';
        render(req, res, 'personal', { Mensaje: { title: 'Importación finalizada', text: `Se importaron ${insertados} registros nuevos. Se actualizaron ${actualizados} registros existentes. Se ignoraron ${ignorados} registros. Legajos ignorados: ${detalleIgnorados}.`, icon: 'info' } });
    } catch (err) {
        await conn.rollback();
        render(req, res, 'personal', { Mensaje: { title: 'Error', text: err.message, icon: 'error' } });
    } finally {
        conn.release();
    }
});
// =================== FIN RUTAS DE IMPORTACIÓN DESDE EXCEL ===================

module.exports = router;