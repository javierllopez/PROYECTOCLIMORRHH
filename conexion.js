const mysql = require('mysql2/promise');
const {database} = require('./claves');


const pool = mysql.createPool({
    ...database,
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
