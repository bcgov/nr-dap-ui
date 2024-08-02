const { getCredentialsFromVault } = require('./getCredentialsFromVault');
const { connectToPosgDatabase } = require('./connectToPosgDatabase');
const { connectToOracleDatabase } = require('./connectToOracleDatabase');
const config = require('./config');

// let credentials = null;
// async function connectDatabase(secretName) {
//     try {
//         credentials = await getCredentialsFromVault(config.brokerUrl, config.brokerJwt, config.vaultUrl, config.vaultEnv, secretName);
//         let connection;
//         if (credentials) {
//             console.log("Successfully retrieved credentials:");
//             // console.log(JSON.stringify(credentials, null, 2));
//             // switch connection
//             if (credentials.data.dbtype === 'postgresql') {
//                 return await connectToPosgDatabase(credentials);
//             } else if (credentials.data.dbtype === 'oracle') {
//                 return  await connectToOracleDatabase(credentials);
//             }
//         } else {
//             console.log("No credentials found for secret:", secretName);
//         }
//     } catch (error) {
//         console.error("An error occurred while retrieving credentials for:", secretName, error);
//     }
// }



// function useCredentials() {
//     if (credentials) {
//         return credentials.data.zoneb_schema;
//     } else {
//         console.log("Credentials are not set.");
//         return null; // Return null or some default value if credentials are not set
//     }
// }
// module.exports = { connectDatabase, useCredentials };

///////////////////////////////////////////////////////////////////////////////////new only connect once/////////////////////////



let credentialsCache = {};
let connectionCache = {};

async function connectDatabase(secretName) {
    try {
        let credentials = credentialsCache[secretName];
        if (!credentials) {
            credentials = await getCredentialsFromVault(config.brokerUrl, config.brokerJwt, config.vaultUrl, config.vaultEnv, secretName);
            credentialsCache[secretName] = credentials;
            console.log("Credentials retrieved and cached.");
        } else {
            console.log("Using cached credentials.");
        }
        // console.log(JSON.stringify(credentials, null, 2));
        if (credentials) {
            const dbType = credentials.data.dbtype;
            let connectionInfo = connectionCache[dbType];

            if (connectionInfo && connectionInfo.isConnected) {
                try {
                    // Simple query to check if connection is still valid
                    await connectionInfo.connection.query('SELECT 1');
                    console.log("Using existing database connection.");
                    return connectionInfo.connection;
                } catch (err) {
                    console.log("Existing connection is no longer valid, reconnecting...");
                    connectionInfo.isConnected = false; // Mark as disconnected
                }
            }

            if (dbType === 'postgresql') {
                const connection = await connectToPosgDatabase(credentials);
                connectionCache[dbType] = { connection: connection, isConnected: true };
                return connection;
            } else if (dbType === 'oracle') {
                const connection = await connectToOracleDatabase(credentials);
                connectionCache[dbType] = { connection: connection, isConnected: true };
                return connection;
            }
        } else {
            console.log("No credentials found for secret:", secretName);
        }
    } catch (error) {
        console.error("An error occurred while establishing a connection:", error);
    }
}

function useCredentials(secretName) {
    const credentials = credentialsCache[secretName];
    if (!credentials) {
        console.log(`Credentials are not set or missing for: ${secretName}`);
        return credentials.data.zoneb_schema; // Return null to handle this more gracefully in calling code
    }
    return credentials.data.zoneb_schema; // Assuming 'zoneb_schema' is correctly part of the credentials structure
}


module.exports = { connectDatabase, useCredentials };
