// const { Pool } = require('pg'); // PostgreSQL client

// async function connectToPosgDatabase(credentials) {
//     const pgPool = new Pool({
//         user: credentials.data.ODS_USERNAME,
//         host: credentials.data.ODS_HOST,
//         database: String(credentials.data.ODS_DATABASE),
//         password: String(credentials.data.ODS_PASSWORD),
//         port: credentials.data.ODS_PORT,
//     });

//     try {
//         const client = await pgPool.connect();
//         console.log("ODS Database connection established");
//         return client; 
//         // Perform database operations here, then close connection
//         // client.release();
//     } catch (err) {
//         console.error('ODS Database connection error', err.stack);
//     }
// }

// module.exports = { connectToPosgDatabase };

const { Pool } = require('pg');

let pgPool;

async function getPool(credentials) {
    if (!pgPool) {
        pgPool = new Pool({
            user: credentials.data.ODS_USERNAME,
            host: credentials.data.ODS_HOST,
            database: String(credentials.data.ODS_DATABASE),
            password: String(credentials.data.ODS_PASSWORD),
            port: credentials.data.ODS_PORT,
        });
        console.log("PostgreSQL pool created.");
    }
    return pgPool;
}

async function connectToPosgDatabase(credentials) {
    const pool = await getPool(credentials);

    try {
        const client = await pool.connect();
        // Check if connection is alive
        await client.query('SELECT 1');  // Simple query to test connection
        console.log("ODS Database connection verified and established");
        return client;
    } catch (err) {
        console.error('ODS Database connection error', err.stack);
        // If a connection error occurs, invalidate the pool to ensure fresh connections
        if (pgPool) {
            pgPool.end();
            pgPool = null;
        }
        throw err;
    }
}

module.exports = { connectToPosgDatabase };
