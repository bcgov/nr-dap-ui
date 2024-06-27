const { getCredentialsFromVault } = require('./getCredentialsFromVault');
const { connectToPosgDatabase } = require('./connectToPosgDatabase');
const { connectToOracleDatabase } = require('./connectToOracleDatabase');
// const config = require('./config.json');
const config = require('./config');
let credentials = null;
async function connectDatabase(secretName) {
    try {
        credentials = await getCredentialsFromVault(config.brokerUrl, config.brokerJwt, config.vaultUrl, config.vaultEnv, secretName);
        let connection;
        if (credentials) {
            console.log("Successfully retrieved credentials:");
            console.log(JSON.stringify(credentials, null, 2));
            // switch connection
            if (credentials.data.dbtype === 'postgresql') {
                return await connectToPosgDatabase(credentials);
            } else if (credentials.data.dbtype === 'oracle') {
                return  await connectToOracleDatabase(credentials);
            }
        } else {
            console.log("No credentials found for secret:", secretName);
        }
    } catch (error) {
        console.error("An error occurred while retrieving credentials for:", secretName, error);
    }
}



function useCredentials() {
    if (credentials) {
        return credentials.data.zoneb_schema;
    } else {
        console.log("Credentials are not set.");
        return null; // Return null or some default value if credentials are not set
    }
}
module.exports = { connectDatabase, useCredentials };

