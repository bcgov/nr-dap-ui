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


// GET all roles
router.get('/', async (req, res) => {
    try {
        pgClient = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT); // Connect to PostgreSQL ODS Database
        const result = await pgClient.query('SELECT * FROM dapui.role');
        res.render('roles/list', { roles: result.rows });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).send('Internal server error.');
    }
});

// GET form to add a new role
router.get('/add', (req, res) => {
    res.render('roles/add');
});

// POST a new role
router.post('/add', async (req, res) => {
    const { rolename, description } = req.body;
    try {
        const query = 'INSERT INTO dapui.role (rolename, description) VALUES ($1, $2)';
        await pgClient.query(query, [rolename, description]);
        res.redirect('/roles');
    } catch (error) {
        console.error('Error adding new role:', error);
        res.status(500).send('Failed to add new role.');
    }
});

// GET form to edit a role
router.get('/edit/:id', async (req, res) => {
    try {
        const result = await pgClient.query('SELECT * FROM dapui.role WHERE roleid = $1', [req.params.id]);
        if (result.rows.length > 0) {
            res.render('roles/edit', { role: result.rows[0] });
        } else {
            res.status(404).send('Role not found.');
        }
    } catch (error) {
        console.error('Error fetching role details:', error);
        res.status(500).send('Internal server error.');
    }
});

// POST updated role
router.post('/edit/:id', async (req, res) => {
    const { rolename, description } = req.body;
    try {
        const query = 'UPDATE dapui.role SET rolename = $1, description = $2 WHERE roleid = $3';
        await pgClient.query(query, [rolename, description, req.params.id]);
        res.redirect('/roles');
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).send('Failed to update role.');
    }
});

// POST to delete a role
router.post('/delete/:id', async (req, res) => {
    try {
        const query = 'DELETE FROM dapui.role WHERE roleid = $1';
        await pgClient.query(query, [req.params.id]);
        res.redirect('/roles');
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).send('Failed to delete role.');
    }
});

module.exports = router;
