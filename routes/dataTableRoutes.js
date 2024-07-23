// const express = require('express');
// const router = express.Router();
// const { connectDatabase } = require('../modules/connectDatabase');

// // Function to determine if the user is an admin
// async function isAdmin(email) {
//     const client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
//     try {
//         const result = await client.query('SELECT roleid FROM dapui."user" WHERE email = $1', [email]);
//         return result.rows.length > 0 && result.rows[0].roleid === 1;
//     } catch (error) {
//         console.error('Error checking admin status:', error);
//     } 
// }

// async function getApplicationDetails(email, isAdmin) {
//     const client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
//     let query;
//     if (isAdmin) {
//         query = `
//             SELECT applicationname, array_agg(tablename) AS tablenames
//             FROM dapui."datatable"
//             GROUP BY applicationname;
//         `;
//     } else {
//         query = `
//             SELECT d.applicationname, array_agg(d.tablename) AS tablenames
//             FROM dapui."datatable" d
//             JOIN dapui."user" u ON d.owneruserid = u.userid
//             WHERE u.email = $1
//             GROUP BY d.applicationname;
//         `;
//     }
//     try {
//         const { rows } = await client.query(query, isAdmin ? [] : [email]);
//         return rows;
//     } catch (error) {
//         console.error('Error retrieving applications:', error);
//     }
// }

// router.get('/', async (req, res) => {
//     try {
//         const userDetails = req.kauth.grant.access_token.content;
//         const email = userDetails.email;
//         const adminStatus = await isAdmin(email);
//         const applications = await getApplicationDetails(email, adminStatus);
//         res.render('table/table', { applications, isAdmin: adminStatus });
//     } catch (error) {
// console.error('Failed to load data:', error);
//         res.status(500).send('Failed to load data.');
//     }
// });

// // Route to delete all tables associated with a given application
// router.post('/delete/:applicationName', async (req, res) => {
//     const applicationName = req.params.applicationName;
//     const client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);

//     try {
//         // Begin transaction
//         await client.query('BEGIN');
//         // Delete tables associated with the application
//         const deleteTables = `
//             DELETE FROM dapui."datatable"
//             WHERE applicationname = $1;
//         `;
//         await client.query(deleteTables, [applicationName]);
//         // Commit transaction
//         await client.query('COMMIT');
//         res.redirect('/table'); // Redirect back to the list after deleting
//     } catch (error) {
//         await client.query('ROLLBACK'); // Rollback in case of error
//         console.error('Error deleting application tables:', error);
//         res.status(500).send('Failed to delete tables.');
//     } 
// });



// module.exports = router;
const express = require('express');
const router = express.Router();
const { connectDatabase } = require('../modules/connectDatabase');
let client;  // Client for PostgreSQL ODS Database
// Function to determine if the user is an admin
async function isAdmin(email) {
    client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
    try {
        const result = await client.query('SELECT roleid FROM dapui."user" WHERE email = $1', [email]);
        return result.rows.length > 0 && result.rows[0].roleid === 1;
    } catch (error) {
        console.error('Error checking admin status:', error);
    } 
}

async function getApplicationDetails(email, isAdmin) {
    client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
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

router.post('/delete/:applicationName', async (req, res) => {
    const applicationName = req.params.applicationName;
    try {
        client = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
        await client.query('BEGIN');
        // Retrieve tables and associated user IDs for revoking access
        const tablesQuery = `
            SELECT tablename, owneruserid
            FROM dapui."datatable"
            WHERE applicationname = $1;
        `;
        const tablesRes = await client.query(tablesQuery, [applicationName]);

        // Revoke access and gather usernames for detailed logging
        let revokeDetails = [];
        for (const row of tablesRes.rows) {
            const userQuery = 'SELECT username FROM dapui."user" WHERE userid = $1';
            try {
                const userRes = await client.query(userQuery, [row.owneruserid]);
                if (userRes.rows.length > 0) {
                    const username = userRes.rows[0].username;
                    // Construct schema and table name
                    const schemaName = `test_${applicationName.toLowerCase()}_replication`;
                    const fullTableName = `"${schemaName}"."${row.tablename.toLowerCase()}"`;
        
                    console.log(`Revoking access for user ${username} on ${fullTableName}`);
                    const revokeAccessQuery = `REVOKE ALL ON TABLE ${fullTableName} FROM "${username}"`;
                    const revokeRes = await client.query(revokeAccessQuery);
                    console.log("Revoke Query Response:", revokeRes);
                    revokeDetails.push(`Access revoked for ${username} on ${fullTableName}`);
                }
            } catch (error) {
                console.error("Error processing row:", row, "Error:", error);
            }
        }
        
        console.log("Revoke Details:", revokeDetails);

        // Delete tables associated with the application
        const deleteTablesQuery = 'DELETE FROM dapui."datatable" WHERE applicationname = $1';
        const deleteRes = await client.query(deleteTablesQuery, [applicationName]);
        if (deleteRes.rowCount === 0) {
            throw new Error("No records found to delete.");
        }

        await client.query('COMMIT');
        console.log('Deletion and revoke successful:', revokeDetails);
        res.redirect('/table');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting application tables and revoking access:', error);
        res.status(500).send(`Failed to delete tables and revoke access: ${error.message}`);
    } finally {
        await client.end();
    }
});

module.exports = router;
