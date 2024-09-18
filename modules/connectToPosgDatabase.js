const { Pool } = require('pg');

let pgPool;

// Function to create a new PostgreSQL connection pool
function createPool(credentials) {
    return new Pool({
        user: credentials.data.ODS_USERNAME,
        host: credentials.data.ODS_HOST,
        database: String(credentials.data.ODS_DATABASE),
        password: String(credentials.data.ODS_PASSWORD),
        port: credentials.data.ODS_PORT,
        idleTimeoutMillis: 30000,  // close idle clients after 30 seconds
        connectionTimeoutMillis: 2000,  // return an error after 2 seconds if connection could not be established
        max: 20  // maximum number of clients in the pool
    });
}

// Function to get or create a PostgreSQL connection pool
async function getPool(credentials) {
    if (!pgPool || !await isPoolHealthy()) {
        console.log("Creating a new PostgreSQL pool...");
        pgPool = createPool(credentials);
        // Add error handling for pool clients
        pgPool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
            pgPool = null; // Optionally reset the pool on error
        });
        console.log("PostgreSQL pool created.");
    }
    return pgPool;
}

// Function to check if the pool is healthy
async function isPoolHealthy() {
    if (pgPool) {
        try {
            const response = await pgPool.query('SELECT 1');
            return response.rowCount === 1; // Expecting one row with '1'
        } catch (error) {
            console.log("Pool health check failed:", error);
            return false;  // Pool is not healthy
        }
    }
    return false;  // No pool exists
}

// Function to connect to the PostgreSQL database and verify the connection
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
        pgPool.end();
        pgPool = null;
        throw err;
    }
}

module.exports = { connectToPosgDatabase };

// const { Pool } = require('pg');

// let pgPool;

// async function getPool(credentials) {
//     if (!pgPool) {
//         pgPool = new Pool({
//             user: credentials.data.ODS_USERNAME,
//             host: credentials.data.ODS_HOST,
//             database: String(credentials.data.ODS_DATABASE),
//             password: String(credentials.data.ODS_PASSWORD),
//             port: credentials.data.ODS_PORT,
//         });
//         console.log("PostgreSQL pool created.");
//     }
//     return pgPool;
// }

// async function connectToPosgDatabase(credentials) {
//     const pool = await getPool(credentials);

//     try {
//         const client = await pool.connect();
//         // Check if connection is alive
//         await client.query('SELECT 1');  // Simple query to test connection
//         console.log("ODS Database connection verified and established");
//         return client;
//     } catch (err) {
//         console.error('ODS Database connection error', err.stack);
//         // If a connection error occurs, invalidate the pool to ensure fresh connections
//         if (pgPool) {
//             pgPool.end();
//             pgPool = null;
//         }
//         throw err;
//     }
// }

// module.exports = { connectToPosgDatabase };
