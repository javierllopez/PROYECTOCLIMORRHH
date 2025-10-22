const mysql = require('mysql2/promise');

const esProduccion = process.env.NODE_ENV === 'production' || Boolean(process.env.PORT);

const leerConfigDesdeEntorno = () => ({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || process.env.DB_USUARIO,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_NOMBRE,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
});

let configuracionBaseDatos = leerConfigDesdeEntorno();

const faltanDatosConexion = (config) => !config.host || !config.user || !config.database;

if (esProduccion) {
    if (faltanDatosConexion(configuracionBaseDatos)) {
        throw new Error('Faltan variables de entorno DB_* para la conexión MySQL en producción');
    }
} else if (faltanDatosConexion(configuracionBaseDatos)) {
    const { database } = require('./claves');
    configuracionBaseDatos = {
        ...database,
        port: database.port ? Number(database.port) : 3306
    };
}

const pool = mysql.createPool({
    ...configuracionBaseDatos,
    timezone: 'Z' // UTC
});

// Fijar zona horaria UTC por sesión
pool.on('connection', (conn) => {
    // conn aquí es la conexión base (callback-style), no la versión promesa
    conn.query("SET time_zone = '+00:00'", (e) => {
        if (e) {
            console.warn('No se pudo fijar time_zone UTC en la sesión:', e.message);
        }
    });
});

// Probar una conexión al iniciar (versión async/await)
(async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query("SET time_zone = '+00:00'");
        await connection.query('SELECT 1');
        console.log('Conexión a base de datos exitosa');
    } catch (err) {
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Conexión de datos perdida');
        } else if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('Demasiadas conexiones');
        } else if (err.code === 'ERRCONREFUSED'){
            console.error('La conexión fue rechazada');
        } else if (err.code === 'ER_DUP_ENTRY') {
            console.error('Clave primaria duplicada');
        } else {
            console.error('Error de conexión a base de datos:', err.message);
        }
    } finally {
        if (connection) connection.release();
    }
})();

const beginTransaction = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
    await connection.query("SET time_zone = '+00:00'");
    await connection.beginTransaction();
        console.log("Transaction started");
        return connection;
    } catch (err) {
        console.error("Error starting transaction:", err);
        if (connection) connection.release();
        throw err;
    }
};

const rollbackTransaction = async (connection) => {
    try {
        await connection.rollback();
        console.log("Transaction rolled back");
    } catch (err) {
        console.error("Error rolling back transaction:", err);
        throw err;
    } finally {
        if (connection) connection.release();
    }
};

const commitTransaction = async (connection) => {
    try {
        await connection.commit();
        console.log("Transaction committed");
    } catch (err) {
        console.error("Error committing transaction:", err);
        throw err;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    pool,
    beginTransaction,
    rollbackTransaction,
    commitTransaction
};
