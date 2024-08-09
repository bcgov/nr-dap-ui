const { connectDatabase } = require('./connectDatabase');

async function verifyUserEmail(email, client) {
    try {
        console.log(email);
        const query = `SELECT * FROM dapui."user" WHERE email = $1`;
        const { rows } = await client.query(query, [email]);
        return rows.length > 0;
    } catch (error) {
        console.error('Error verifying user email:', error);
        throw error;  // Properly throw the error to handle it in the calling function
    }
}

module.exports = {
    verifyUserEmail
};
