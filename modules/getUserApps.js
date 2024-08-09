// databaseFunctions.js
const { connectDatabase } = require('./connectDatabase');

async function getUserApps(email, client) {
    try {
        const query = `SELECT * FROM "user" WHERE email = $1`;
        const { rows } = await client.query(query, [email]);
        return rows.length > 0;
    } catch (error) {
        console.error('Error verifying user email:', error);
        throw error;  // Properly throw the error to handle it in the calling function
    }
}

module.exports = {
    getUserApps
};