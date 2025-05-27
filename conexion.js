const mysql = require('mysql2/promise');
const {database} = require('./claves');


const pool = mysql.createPool(database);



pool.getConnection((err,connection) => {
    if (err){
        if(err.code === "PROTOCOL_CONNECTION_LOST") {
            console.error("Conexion de datos perdida");
        }
        if (err.code === "ER_CON_COUNT_ERROR") {
            console.error("Demasiadas conexiones");
        }
        if (err.code === "ERRCONREFUSED"){
            console.error("La conexión fue rechazada");
        }
        if (err.code === "ER_DUP_ENTRY") {
            console.error("clave primaria duplicada");
        }

    }
    if (connection) connection.release();
        console.log("Conexión a base de datos exitosa");
    return;
});

const beginTransaction = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
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
