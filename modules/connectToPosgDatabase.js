const { Pool } = require('pg'); // PostgreSQL client

async function connectToPosgDatabase(credentials) {
    const pgPool = new Pool({
        user: credentials.data.ODS_USERNAME,
        host: credentials.data.ODS_HOST,
        database: String(credentials.data.ODS_DATABASE),
        password: String(credentials.data.ODS_PASSWORD),
        port: credentials.data.ODS_PORT,
    });

    try {
        const client = await pgPool.connect();
        console.log("ODS Database connection established");
        return client; 
        // Perform database operations here, then close connection
        // client.release();
    } catch (err) {
        console.error('ODS Database connection error', err.stack);
    }
}

module.exports = { connectToPosgDatabase };

