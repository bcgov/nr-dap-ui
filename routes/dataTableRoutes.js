const express = require('express');
const router = express.Router();
const { connectDatabase } = require('../modules/connectDatabase');

// Function to determine if the user is an admin
async function isAdmin(email) {
    const client = await connectDatabase('testlocal');
    try {
        const result = await client.query('SELECT roleid FROM dapui."user" WHERE email = $1', [email]);
        return result.rows.length > 0 && result.rows[0].roleid === 1;
    } catch (error) {
        console.error('Error checking admin status:', error);
    } finally {
        await client.end();
    }
}

async function getApplicationDetails(email, isAdmin) {
    const client = await connectDatabase('testlocal');
    let query;
    if (isAdmin) {
        query = `
            SELECT applicationname, array_agg(tablename) AS tablenames
            FROM dapui."datatable"
            GROUP BY applicationname;
        `;
    } else {
        query = `
            SELECT d.applicationname, array_agg(d.tablename) AS tablenames
            FROM dapui."datatable" d
            JOIN dapui."user" u ON d.owneruserid = u.userid
            WHERE u.email = $1
            GROUP BY d.applicationname;
        `;
    }
    try {
        const { rows } = await client.query(query, isAdmin ? [] : [email]);
        return rows;
    } catch (error) {
        console.error('Error retrieving applications:', error);
    } finally {
        await client.end();  // Ensure the client is properly closed
    }
}

router.get('/', async (req, res) => {
    try {
        const userDetails = req.kauth.grant.access_token.content;
        const email = userDetails.email;
        const adminStatus = await isAdmin(email);
        const applications = await getApplicationDetails(email, adminStatus);
        res.render('table/table', { applications, isAdmin: adminStatus });
    } catch (error) {
console.error('Failed to load data:', error);
        res.status(500).send('Failed to load data.');
    }
});

// Route to delete all tables associated with a given application
router.post('/delete/:applicationName', async (req, res) => {
    const applicationName = req.params.applicationName;
    const client = await connectDatabase('testlocal');

    try {
        // Begin transaction
        await client.query('BEGIN');
        // Delete tables associated with the application
        const deleteTables = `
            DELETE FROM dapui."datatable"
            WHERE applicationname = $1;
        `;
        await client.query(deleteTables, [applicationName]);
        // Commit transaction
        await client.query('COMMIT');
        res.redirect('/table'); // Redirect back to the list after deleting
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback in case of error
        console.error('Error deleting application tables:', error);
        res.status(500).send('Failed to delete tables.');
    } finally {
        await client.end(); // Properly close the connection
    }
});

module.exports = router;
