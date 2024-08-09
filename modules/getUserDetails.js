const { connectDatabase } = require('./connectDatabase');

async function getUserDetails(email, client) {
    try {
        // This query joins the user, role, and database tables to fetch the required details
        const query = `
            SELECT 
                u.userid,
                u.firstname,
                u.lastname,
                u.email,
                r.rolename,
                array_agg(d.applicationname) AS applicationnames,
                array_agg(d.vaultname) AS vaultnames
            FROM dapui."user" u
            JOIN dapui.role r ON u.roleid = r.roleid
            LEFT JOIN dapui."database" d ON u.userid = d.owneruserid
            WHERE u.email = $1
            GROUP BY u.userid, r.rolename;
        `;
        const { rows } = await client.query(query, [email]);
        return rows.length > 0 ? rows[0] : null; // Returns null if no user is found, or the user data if found
    } catch (error) {
        console.error('Error retrieving user details:', error);
        throw error;  // Properly throw the error to handle it in the calling function
    }
}

module.exports = {
    getUserDetails
};
