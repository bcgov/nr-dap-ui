const { getCredentialsFromVault } = require('./getCredentialsFromVault');
const { connectToPosgDatabase } = require('./connectToPosgDatabase');
const { connectToOracleDatabase } = require('./connectToOracleDatabase');
const config = require('./config');

let credentialsCache = {};  // Cache credentials for each secretName
let connectionCache = {};  // Cache database connections by dbType

// async function connectDatabase(secretName) {
//     try {
//         let credentials = credentialsCache[secretName];
//         if (!credentials) {
//             // Fetch credentials if not cached
//             credentials = await getCredentialsFromVault(
//                 config.brokerUrl,
//                 config.brokerJwt,
//                 config.vaultUrl,
//                 config.vaultEnv,
//                 secretName
//             );
//             if (credentials) {
//                 credentialsCache[secretName] = credentials;
//                 console.log("Credentials retrieved and cached.");
//             } else {
//                 console.log("No credentials found for secret:", secretName);
//                 return null;
//             }
//         } else {
//             console.log("Using cached credentials.");
//         }

//         const dbType = credentials.data.dbtype;
//         let connectionInfo = connectionCache[dbType];

//         if (connectionInfo && connectionInfo.isConnected) {
//             try {
//                 // Check if the existing connection is still valid
//                 await connectionInfo.connection.query('SELECT 1');  
//                 console.log("Using existing database connection.");
//                 return connectionInfo.connection;
//             } catch (err) {
//                 console.log("Existing connection is no longer valid, reconnecting...");
//                 connectionInfo.isConnected = false; 
//             }
//         }

//         // Establish a new connection if no valid connection exists
//         if (dbType === 'postgresql') {
//             const connection = await connectToPosgDatabase(credentials);
//             connectionCache[dbType] = { connection: connection, isConnected: true };
//             return connection;
//         } else if (dbType === 'oracle') {
//             const connection = await connectToOracleDatabase(credentials);
//             connectionCache[dbType] = { connection: connection, isConnected: true };
//             return connection;
//         } else {
//             console.log("Unsupported database type:", dbType);
//             return null;
//         }
//     } catch (error) {
//         console.error("An error occurred while establishing a connection:", error);
//         return null;
//     }
// }
async function connectDatabase(secretName) {
    try {
        let credentials = credentialsCache[secretName];
        if (!credentials) {
            credentials = await getCredentialsFromVault(
                config.brokerUrl,
                config.brokerJwt,
                config.vaultUrl,
                config.vaultEnv,
                secretName
            );
            credentialsCache[secretName] = credentials;
            console.log("Credentials retrieved and cached.");
        }

        const dbType = credentials.data.dbtype;
        // For Oracle, always create a new connection, bypassing the cache entirely
        if (dbType === 'oracle') {
            console.log("Establishing a new Oracle database connection...");
            const oracleConnection = await connectToOracleDatabase(credentials);
            return oracleConnection;
        }

        let connectionInfo = connectionCache[dbType];

        if (connectionInfo && connectionInfo.isConnected) {
            // Check if the connection has been idle for more than 5 minutes
            if (Date.now() - connectionInfo.lastUsed > 300000) {
                console.log("Existing connection is idle for more than 5 minutes, reconnecting...");
                connectionInfo.isConnected = false;
            } else {
                try {
                    // Check if the existing connection is still valid
                    await connectionInfo.connection.query('SELECT 1');
                    console.log("Using existing database connection.");
                    connectionInfo.lastUsed = Date.now();  // Update the last used time
                    return connectionInfo.connection;
                } catch (err) {
                    console.log("Existing connection is no longer valid, reconnecting...");
                    connectionInfo.isConnected = false;
                }
            }
        }

        // Establish a new connection if no valid connection exists
        if (!connectionInfo || !connectionInfo.isConnected) {
            let connection;
            if (dbType === 'postgresql') {
                connection = await connectToPosgDatabase(credentials);
                connectionCache[dbType] = { connection: connection, isConnected: true, lastUsed: Date.now() };
                return connection;
            }
            // No else block needed for Oracle since it's handled above
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

