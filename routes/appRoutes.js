const express = require('express');
const router = express.Router();
const { connectDatabase } = require('../modules/connectDatabase');

const getApplications = async (email) => {
    const client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);

    // First, determine if the user is an admin
    let roleCheckQuery = `
        SELECT roleid FROM dapui."user" WHERE email = $1;
    `;
    let isAdmin = false;
    try {
        const roleCheckResult = await client.query(roleCheckQuery, [email]);
        if (roleCheckResult.rows.length > 0 && roleCheckResult.rows[0].roleid === 1) {
            isAdmin = true;
        }
    } catch (error) {
        console.error('Error checking user role:', error);
        await client.end();
        throw error;
    }

    // Then, fetch applications based on the user's role
    let query, params;
    if (isAdmin) {
        // Admin users see all entries
        query = 'SELECT applicationname, vaultname FROM dapui."database"';
        params = [];
    } else {
        // Non-admin users see only entries where they are the owner
        query = `
            SELECT applicationname, vaultname 
            FROM dapui."database"
            WHERE ownername = (SELECT username FROM dapui."user" WHERE email = $1)
        `;
        params = [email];
    }

    try {
        const { rows } = await client.query(query, params);
        await client.end(); // Properly close the connection
        return rows;
    } catch (error) {
        console.error('Error getting applications:', error);
        await client.end();
        throw error;
    }
};

router.get('/', async (req, res) => {
    try {
        const userDetails = req.kauth.grant.access_token.content;
        const email = userDetails.email;
        const isAdmin = userDetails.realm_access && userDetails.realm_access.roles.includes('admin');
        const apps = await getApplications(email, isAdmin);
        res.render('appList', { apps, isAdmin });
    } catch (error) {
        console.error('Error accessing applications:', error);
        res.status(500).send('Failed to load applications.');
    }
});

module.exports = router;
