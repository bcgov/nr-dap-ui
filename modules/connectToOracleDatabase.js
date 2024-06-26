const oracledb = require('oracledb');

// Function to connect to Oracle database
async function connectToOracleDatabase(credentials) {
    let oracleConnection = null;  // Define outside the try block to ensure it is in scope for the finally block
    try {
        // Connect to the Oracle database
        oracleConnection = await oracledb.getConnection({
            user: credentials.data.zoneb_oracle_user,
            password: credentials.data.zoneb_oracle_password,
            connectString: `${credentials.data.zoneb_host_name}:${credentials.data.zoneb_port}/${credentials.data.zoneb_Database}`
        });

        console.log("Oracle Database connection established");
        return oracleConnection; // Return the connection object so it can be used and managed outside this function
    } catch (err) {
        console.error('Oracle Database connection error', err);
        // Optionally, re-throw the error to let the caller handle it
        throw err; 
    }
}

module.exports = { connectToOracleDatabase };
