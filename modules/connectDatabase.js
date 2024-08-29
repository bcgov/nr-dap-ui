const { getCredentialsFromVault } = require('./getCredentialsFromVault');
const { connectToPosgDatabase } = require('./connectToPosgDatabase');
const { connectToOracleDatabase } = require('./connectToOracleDatabase');
const config = require('./config');

let credentialsCache = {};  // Cache credentials for each secretName
let connectionCache = {};  // Cache database connections by dbType

async function connectDatabase(secretName) {
    try {
        let credentials = credentialsCache[secretName];
        if (!credentials) {
            // Fetch credentials if not cached
            credentials = await getCredentialsFromVault(
                config.brokerUrl,
                config.brokerJwt,
                config.vaultUrl,
                config.vaultEnv,
                secretName
            );
            if (credentials) {
                credentialsCache[secretName] = credentials;
                console.log("Credentials retrieved and cached.");
            } else {
                console.log("No credentials found for secret:", secretName);
                return null;
            }
        } else {
            console.log("Using cached credentials.");
        }

        const dbType = credentials.data.dbtype;
        let connectionInfo = connectionCache[dbType];

        if (connectionInfo && connectionInfo.isConnected) {
            try {
                // Check if the existing connection is still valid
                await connectionInfo.connection.query('SELECT 1');  // PostgreSQL example
                console.log("Using existing database connection.");
                return connectionInfo.connection;
            } catch (err) {
                console.log("Existing connection is no longer valid, reconnecting...");
                connectionInfo.isConnected = false;  // Mark as disconnected
            }
        }

        // Establish a new connection if no valid connection exists
        if (dbType === 'postgresql') {
            const connection = await connectToPosgDatabase(credentials);
            connectionCache[dbType] = { connection: connection, isConnected: true };
            return connection;
        } else if (dbType === 'oracle') {
            const connection = await connectToOracleDatabase(credentials);
            connectionCache[dbType] = { connection: connection, isConnected: true };
            return connection;
        } else {
            console.log("Unsupported database type:", dbType);
            return null;
        }
    } catch (error) {
        console.error("An error occurred while establishing a connection:", error);
        return null;
    }
}

function useCredentials(secretName) {
    const credentials = credentialsCache[secretName];
    if (!credentials) {
        console.log(`Credentials are not set or missing for: ${secretName}`);
        return null;  // Return null to handle this gracefully in calling code
    }
    return credentials.data.zoneb_schema;  // Assuming 'zoneb_schema' is part of the credentials structure
}

module.exports = { connectDatabase, useCredentials };


// const { getCredentialsFromVault } = require('./getCredentialsFromVault');
// const { connectToPosgDatabase } = require('./connectToPosgDatabase');
// const { connectToOracleDatabase } = require('./connectToOracleDatabase');
// const config = require('./config');


// let credentialsCache = {};
// let connectionCache = {};

// async function connectDatabase(secretName) {
//     try {
//         let credentials = credentialsCache[secretName];
//         if (!credentials) {
//             credentials = await getCredentialsFromVault(config.brokerUrl, config.brokerJwt, config.vaultUrl, config.vaultEnv, secretName);
//             credentialsCache[secretName] = credentials;
//             console.log("Credentials retrieved and cached.");
//         } else {
//             console.log("Using cached credentials.");
//         }
//         // console.log(JSON.stringify(credentials, null, 2));
//         if (credentials) {
//             const dbType = credentials.data.dbtype;
//             let connectionInfo = connectionCache[dbType];

//             if (connectionInfo && connectionInfo.isConnected) {
//                 try {
//                     // Simple query to check if connection is still valid
//                     await connectionInfo.connection.query('SELECT 1');
//                     console.log("Using existing database connection.");
//                     return connectionInfo.connection;
//                 } catch (err) {
//                     console.log("Existing connection is no longer valid, reconnecting...");
//                     connectionInfo.isConnected = false; // Mark as disconnected
//                 }
//             }

//             if (dbType === 'postgresql') {
//                 const connection = await connectToPosgDatabase(credentials);
//                 connectionCache[dbType] = { connection: connection, isConnected: true };
//                 return connection;
//             } else if (dbType === 'oracle') {
//                 const connection = await connectToOracleDatabase(credentials);
//                 connectionCache[dbType] = { connection: connection, isConnected: true };
//                 return connection;
//             }
//         } else {
//             console.log("No credentials found for secret:", secretName);
//         }
//     } catch (error) {
//         console.error("An error occurred while establishing a connection:", error);
//     }
// }

// function useCredentials(secretName) {
//     const credentials = credentialsCache[secretName];
//     if (!credentials) {
//         console.log(`Credentials are not set or missing for: ${secretName}`);
//         return credentials.data.zoneb_schema; // Return null to handle this more gracefully in calling code
//     }
//     return credentials.data.zoneb_schema; // Assuming 'zoneb_schema' is correctly part of the credentials structure
// }


// module.exports = { connectDatabase, useCredentials };
