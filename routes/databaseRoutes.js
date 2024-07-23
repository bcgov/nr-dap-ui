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


// Function to fetch all users
async function getAllUsers(pgClient) {
    try {
        return (await pgClient.query('SELECT userid, username FROM dapui.user')).rows;
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// Route to list all databases
router.get('/', async (req, res) => {
    pgClient = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
    try {
        const result = await pgClient.query('SELECT d.databaseid, d.databasename, d.applicationname, d.vaultname, d.schemaname, u.username as ownerusername FROM dapui.database d JOIN dapui.user u ON d.owneruserid = u.userid;');
        res.render('databases/list', { databases: result.rows });
    } catch (error) {
        console.error('Error getting databases', error);
        res.send('Failed to retrieve databases.');
    }
});

// Route to display the form for adding a new database
router.get('/add', async (req, res) => {
    const users = await getAllUsers(pgClient);
    res.render('databases/add', { users });
});

// Route to handle the submission of the new database form
router.post('/add', async (req, res) => {
    const { databasename, applicationname, vaultname, schemaname, owneruserid } = req.body;
    try {
        await pgClient.query('INSERT INTO dapui.database (databasename, applicationname, vaultname, schemaname, owneruserid) VALUES ($1, $2, $3, $4, $5)', [databasename, applicationname, vaultname, schemaname, owneruserid]);
        res.redirect('/databases');
    } catch (error) {
        console.error('Error adding database', error);
        res.send('Failed to add database.');
    }
});

// Route to display the form for editing an existing database
router.get('/edit/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const users = await getAllUsers(pgClient);
        const result = await pgClient.query('SELECT * FROM dapui.database WHERE databaseid = $1', [id]);
        if (result.rows.length > 0) {
            res.render('databases/edit', { database: result.rows[0], users });
        } else {
            res.send('Database not found.');
        }
    } catch (error) {
        console.error('Error finding database', error);
        res.send('Failed to find database.');
    }
});

// Route to handle the submission of the edit database form
router.post('/edit/:id', async (req, res) => {
    const { databasename, applicationname, vaultname, schemaname, owneruserid } = req.body;
    const { id } = req.params;
    try {
        await pgClient.query('UPDATE dapui.database SET databasename = $1, applicationname = $2, vaultname = $3, schemaname = $4, owneruserid = $5 WHERE databaseid = $6', [databasename, applicationname, vaultname, schemaname, owneruserid, id]);
        res.redirect('/databases');
    } catch (error) {
        console.error('Error updating database', error);
        res.send('Failed to update database.');
    }
});

// Route to delete a database
router.post('/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pgClient.query('DELETE FROM dapui.database WHERE databaseid = $1', [id]);
        res.redirect('/databases');
    } catch (error) {
        console.error('Error deleting database', error);
        res.send('Failed to delete database.');
    }
});

module.exports = router;
