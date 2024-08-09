const express = require('express');
const router = express.Router();
const { Pool } = require('pg'); // PostgreSQL client
const { getCredentialsFromVault } = require('../modules/getCredentialsFromVault');
const { getOracleCredentials } = require('../modules/getOracleCredentials');
const { connectToPosgDatabase } = require('../modules/connectToPosgDatabase');
const { connectDatabase, useCredentials } = require('../modules/connectDatabase');
// const config = require('./config.json');
const { connectToOracleDatabase } = require('../modules/connectToOracleDatabase');
const { verifyUserEmail } = require('../modules/verifyUserEmail');
const { getUserDetails } = require('../modules/getUserDetails');
const { logUserVisit } = require('../modules/logUserVisit');


let pgClient;  // Client for PostgreSQL ODS Database
let roles;  // Client for PostgreSQL ODS Database
async function getAllRoles(pgClient) {
    try {
        const result = await pgClient.query('SELECT roleid, rolename FROM dapui.role;');
        return result.rows;
    } catch (error) {
        console.error('Error getting roles:', error);
        return [];
    }
}

// Route to list all users
router.get('/', async (req, res) => {
    pgClient = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT); // Connect to PostgreSQL ODS Database
    roles = await getAllRoles(pgClient); // Ensure pgClient is your connected and authorized Postgres client
    try {
        const result = await pgClient.query('SELECT u.userid, u.username, u.firstname, u.lastname, u.email, r.rolename FROM dapui.user u JOIN dapui.role r ON u.roleid = r.roleid;');
        res.render('users/list', { users: result.rows });
    } catch (error) {
        console.error('Error getting users', error);
        res.send('Failed to retrieve users.');
    } finally {
        // pgClient.release();
    }
});

// Route to display the form for adding a new user
router.get('/add', (req, res) => {

      res.render('users/add', { roles }); 

});

// Route to display the form to add a user
router.get('/users/add', async (req, res) => {
    try {
        // Use the existing database connection to fetch roles
        const roles = await getAllRoles(pgClient); // Ensure pgClient is your connected and authorized Postgres client
        res.render('users/add', { roles }); // Pass roles to the EJS template
    } catch (error) {
        console.error('Failed to fetch roles for user form:', error);
        res.status(500).send('Internal server error');
    }
});

// Route to handle the submission of the new user form
router.post('/add', async (req, res) => {
    const { username, firstname, lastname, email, roleid } = req.body;
    try {
        await pgClient.query('INSERT INTO dapui.user (username, firstname, lastname, email, roleid) VALUES ($1, $2, $3, $4, $5)', [username, firstname, lastname, email, roleid]);
        res.redirect('/users');
    } catch (error) {
        console.error('Error adding user', error);
        res.send('Failed to add user.');
    } finally {
        // pgClient.release();
    }
});

// Route to display the form for editing an existing user
router.get('/edit/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const roles = await getAllRoles(pgClient); // Ensure pgClient is your connected and authorized Postgres client
        const result = await pgClient.query('SELECT * FROM dapui.user WHERE userid = $1', [id]);
        
        if (result.rows.length > 0) {
            res.render('users/edit', { 
                user: result.rows[0], 
                roles: roles  // Pass roles together with user data
            });
        } else {
            res.send('User not found.');
        }
    } catch (error) {
        console.error('Error finding user', error);
        res.status(500).send('Failed to find user.');
    }
});


// Route to handle the submission of the edit user form
router.post('/edit/:id', async (req, res) => {
    const { username, firstname, lastname, email, roleid } = req.body;
    const { id } = req.params;
    try {
        await pgClient.query('UPDATE dapui.user SET username = $1, firstname = $2, lastname = $3, email = $4, roleid = $5 WHERE userid = $6', [username, firstname, lastname, email, roleid, id]);
        res.redirect('/users');
    } catch (error) {
        console.error('Error updating user', error);
        res.send('Failed to update user.');
    } finally {
        // pgClient.release();
    }
});

// Route to delete a user
router.post('/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pgClient.query('DELETE FROM dapui.user WHERE userid = $1', [id]);
        res.redirect('/users');
    } catch (error) {
        console.error('Error deleting user', error);
        res.send('Failed to delete user.');
    } finally {
        // pgClient.release();
    }
});

module.exports = router;
