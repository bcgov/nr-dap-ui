// databaseFunctions.js
async function logUserVisit(userDetails, client) {
    try {
        const query = `
            INSERT INTO dapui.user_visit_logs (email, idir_username, first_name, last_name)
            VALUES ($1, $2, $3, $4);
        `;
        const params = [userDetails.email, userDetails.idir_username, userDetails.given_name, userDetails.family_name];
        await client.query(query, params);
        console.log('User visit logged successfully');
    } catch (error) {
        console.error('Error logging user visit:', error);
        throw error;  // Propagate the error for external handling
    }
}

module.exports = { logUserVisit };
