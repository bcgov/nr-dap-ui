const axios = require('axios');
const fs = require('fs');
const path = require('path');
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
const { triggerAirflowDAG } = require('../modules/triggerAirflow'); 
const config = require('../modules/config');
const express = require('express');
const oracledb = require('oracledb');
const bodyParser = require('body-parser');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const app = express();
const port = 3000;
const router = express.Router();

// Declare global variable
let targetSchemaName = null;
let sourceSchemaName = null;
let applicationName = null;
let selectedTables = null;
let userEmail = null;
let ODSdatabase = process.env.DATABASE_ODS_IN_VAULT;
let pgClient;  // Client for PostgreSQL ODS Database
let oracleConnection;  // Connection to Oracle Database


// Retrieve columns and comments for selected tables
async function getColumnsForTable(tableName) {
    try {
        const query = `
            SELECT column_name, data_type, data_length, nullable, comments
            FROM all_tab_columns
            JOIN all_col_comments USING (table_name, column_name, owner)
            WHERE table_name = :tableName AND owner = :sourceSchemaName
            ORDER BY column_id
        `;
        const result = await oracleConnection.execute(query, { tableName, sourceSchemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows;
    } catch (error) {
        console.error(`Error fetching columns for table ${tableName}:`, error);
        throw error;
    }
}

// Function to read all tables from oracle database.
async function getAllTables(oracleConnection, sourceSchemaName) {
    try {
        const query = `SELECT table_name FROM all_tables WHERE owner = :sourceSchemaName`;
        const result = await oracleConnection.execute(query, { sourceSchemaName }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows.map(row => row.TABLE_NAME);
    } catch (error) {
        console.error('Error fetching tables:', error);
        throw error;
    }
}

// Function to execute SQL on PostgreSQL and handle errors
async function executePostgresQuery(query) {
    try {
        console.log('Executing PostgreSQL query:', query);  // Log query to console
  
        try {
            const result = await pgClient.query(query);
            return result;
        } finally {
            // pgClient.release();
        }
    } catch (error) {
        console.error('Failed to execute PostgreSQL query:', error);
        throw new Error(`PostgreSQL query failed: ${error.message}`);
    }
}
// Function to retrieve a Vault token
async function getVaultToken() {
    const username = process.env.VAULT_USERNAME; 
    const password = process.env.VAULT_PASSWORD;
    const vaultLoginUrl = `${config.vaultUrl}/v1/auth/userpass/login/${username}`;

    try {
        const authResponse = await axios.post(vaultLoginUrl, { password });
        if (authResponse.data.auth && authResponse.data.auth.client_token) {
            return authResponse.data.auth.client_token;
        } else {
            throw new Error("Authentication token not found in response.");
        }
    } catch (error) {
        console.error(`Failed to authenticate with Vault at ${vaultLoginUrl}:`, error);
        throw new Error(`Failed to authenticate with Vault: ${error.message}`);
    }
}

// Function to write credentials to the Vault
async function writeCredentialsToVault(vaultUrl, vaultToken, vaultEnv, secretName, credentials) {
    try {
        const secretPath = `${vaultUrl}/v1/secret/data/${vaultEnv}/nr-data-solutions/nr-data-analytics-platform/${secretName}`;
        const response = await axios.put(secretPath, { data: credentials }, {
            headers: {
                "X-Vault-Token": vaultToken,
                "Content-Type": "application/json"
            }
        });
        console.log(`Credentials for ${secretName} successfully written to Vault.`);
        return response.data;
    } catch (error) {
        console.error('Failed to write credentials to Vault:', error);
        throw new Error(`Error writing credentials to Vault: ${error.message}`);
    }
}

// Function to insert selected table information into the ODS datatable
async function insertIntoDatatable(tableName, applicationName, userEmail) {
    // Fetch username for the given email
    const userQuery = 'SELECT username FROM dapui."user" WHERE email = $1';
    const userRes = await pgClient.query(userQuery, [userEmail]);
    if (userRes.rows.length === 0) {
        throw new Error('User not found.');
    }
    const ownerName = userRes.rows[0].username;
    tableName = tableName.trim().toLowerCase();
    applicationName = applicationName.trim().toLowerCase();
    console.log(tableName);
    console.log(applicationName);
    // Check if the entry already exists
    const checkQuery = `
    SELECT * FROM dapui.datatable
    WHERE tablename = $1 AND applicationname = $2 AND ownername = $3;
    `;
    const checkRes = await pgClient.query(checkQuery, [tableName, applicationName, ownerName]);
    
    if (checkRes.rows.length > 0) {
        console.log('Entry already exists in datatable. Skipping insertion.');
        return; // Skip insertion because entry already exists
    }

    // Insert query if no entry exists
    const insertQuery = `
    INSERT INTO dapui.datatable (tablename, applicationname, ownername)
    VALUES ($1, $2, $3)
    RETURNING *;
    `;
    const insertRes = await pgClient.query(insertQuery, [tableName.toLowerCase(), applicationName, ownerName]);
    console.log('Inserted into datatable:', insertRes.rows[0]);
}


//Generate a user and roles.
const crypto = require('crypto');
async function createUserAndGrantAccess(userEmail, selectedTables, targetSchemaName, pgClient) {
    try {
        // Retrieve username from the user table
        const userQuery = 'SELECT username FROM dapui."user" WHERE email = $1';
        const userRes = await pgClient.query(userQuery, [userEmail]);
        if (userRes.rows.length === 0) {
            throw new Error('User not found.');
        }
        const username = userRes.rows[0].username;

        // Generate a secure random password
        let password = crypto.randomBytes(16).toString('hex');

        // Check if user already exists
        const roleCheckQuery = 'SELECT rolname FROM pg_roles WHERE rolname = $1';
        const roleCheckRes = await pgClient.query(roleCheckQuery, [username]);
        if (roleCheckRes.rows.length === 0) {
            // Create user if not exists
            const createUserQuery = `SELECT administration.create_proxy_account('${username}', '${password}')`;
            await pgClient.query(createUserQuery);
            console.log(`User ${username} created with a new password.`);
        } else {
            password = 'Please use same password';
        }

        // Check if targetSchemaName is valid
        if (!targetSchemaName || targetSchemaName === '""') {
            throw new Error('Target schema name is missing or empty.');
        }

        // Assign the role to the proxy account using administration.grant_adhoc_role
        const roleName = 'dap_ui'; 
        if (!roleName || !username) {
            throw new Error('Role name or username is missing.');
        }
        const grantRoleQuery = `SELECT administration.grant_adhoc_role('${roleName}', '${username}')`;
        await pgClient.query(grantRoleQuery);
        console.log(`Role ${roleName} granted to proxy account ${username}.`);

        // Ensure targetSchemaName is quoted correctly
        const grantSchemaQuery = `GRANT USAGE ON SCHEMA ${targetSchemaName} TO "${roleName}"`;
        await pgClient.query(grantSchemaQuery);
        console.log(`Schema access granted to role ${roleName}.`);

        // Grant SELECT on each table in the schema
        for (const tableName of selectedTables) {
            if (!tableName) continue; // Skip empty table names
            const grantQuery = `GRANT SELECT ON ${targetSchemaName}."${tableName.toLowerCase()}" TO "${username}"`;
            await pgClient.query(grantQuery);
            console.log(`Access granted for ${username} on table ${tableName.toLowerCase()} in schema ${targetSchemaName}.`);
        }

        // Grant ods_admin_user full access to the schema
        const grantOdsAdminSchemaQuery = `GRANT ALL PRIVILEGES ON SCHEMA ${targetSchemaName} TO "ods_admin_user"`;
        await pgClient.query(grantOdsAdminSchemaQuery);
        console.log(`Full schema access granted to ods_admin_user for schema ${targetSchemaName}.`);

        // Grant ALL privileges on each table to ods_admin_user
        for (const tableName of selectedTables) {
            if (!tableName) continue; // Skip empty table names
            const grantOdsAdminTableQuery = `GRANT ALL PRIVILEGES ON ${targetSchemaName}."${tableName.toLowerCase()}" TO "ods_admin_user"`;
            await pgClient.query(grantOdsAdminTableQuery);
            console.log(`Full access granted to ods_admin_user on table ${tableName.toLowerCase()} in schema ${targetSchemaName}.`);
        }

        // Return user details including the password
        return { username, password, schemaAccess: targetSchemaName, tables: selectedTables, action: roleCheckRes.rows.length === 0 ? "created" : "updated" };

    } catch (error) {
        console.error('Failed to create user or update access:', error);
        throw error; // Rethrow to handle it in the calling context
    }
}






  // Main route
  router.get('/', async (req, res) => {
    try {
        const vaultName = req.query.vaultName;
        applicationName = req.query.applicationName.toLowerCase();
        console.log(applicationName);
        if (!vaultName || !applicationName) {
            return res.status(400).send('Vault name or applicatinName is required');
        }
        const userDetails = req.kauth.grant.access_token.content;

        //debug
        console.log(userDetails);

        // Extract user details
        userEmail = userDetails.email;
        // const idir_username = userDetails.idir_username
        // const firstName = userDetails.given_name;
        // const lastName = userDetails.family_name;

        // connect to ODS
        pgClient = await connectDatabase(ODSdatabase); 

        // Pass the client/connection to the logging function
        await logUserVisit(userDetails, pgClient);
        // Verify user email
        const isAuthorized = await verifyUserEmail(userDetails.email, pgClient);
        console.log(isAuthorized);
        if (isAuthorized) {
        console.log('granted access'); 
          // User found, access granted
          try {
 
            oracleConnection = await connectDatabase(vaultName);

            //get application database schema name
            sourceSchemaName = useCredentials(vaultName); 
            console.log(sourceSchemaName); 
            targetSchemaName = `${applicationName}_replication`;
            targetSchemaName = targetSchemaName.trim().toLowerCase();

            const tables = await getAllTables(oracleConnection, sourceSchemaName); 
            res.render('automation', { tables});

        } catch (error) {
            console.error('Error displaying form:', error);
            res.status(500).send('An error occurred');
        }
        //end granted user

        } else {
          // User not found, access denied
          res.status(403).send('Access denied: No such user found in the database.');
        }
      } catch (error) {
        console.error('Error validating user:', error);
        res.status(500).send('Internal server error.');
      }


  });

router.post('/generate-ddl', async (req, res) => {
    try {
        let selectedTables = req.body.tables;
        // Ensure selectedTables is always an array
        if (!selectedTables) {
            res.status(400).send('No tables selected');
            return;
        }

        if (!Array.isArray(selectedTables)) {
            selectedTables = [selectedTables]; 
        }

        const queriesToRun = [];
        // Fetch username for the given email to use as ownerName
        const userQuery = 'SELECT username FROM dapui."user" WHERE email = $1';
        const userRes = await pgClient.query(userQuery, [userEmail]);
        if (userRes.rows.length === 0) {
            throw new Error('User not found.');
        }
        const ownerName = userRes.rows[0].username; 
        // Check and create schema if not exists
        queriesToRun.push(`CREATE SCHEMA IF NOT EXISTS ${targetSchemaName.toLowerCase()}`);

        for (let tableName of Array.isArray(selectedTables) ? selectedTables : [selectedTables]) {
            const columns = await getColumnsForTable(tableName);
            tableName = tableName.toLowerCase();
            let ddl = `CREATE TABLE IF NOT EXISTS ${targetSchemaName.toLowerCase()}."${tableName.toLowerCase()}" (\n`;
            columns.forEach(column => {
                let columnType = column.DATA_TYPE.toLowerCase();
                switch (column.DATA_TYPE) {
                    case 'VARCHAR2':
                    case 'NVARCHAR2':
                    case 'CHAR':
                    case 'NCHAR':
                        columnType = `VARCHAR(${column.DATA_LENGTH})`;
                        break;
                    case 'NUMBER':
                        if (column.DATA_PRECISION != null && column.DATA_SCALE != null) {
                            if (column.DATA_SCALE > 0) {
                                columnType = `NUMERIC(${column.DATA_PRECISION}, ${column.DATA_SCALE})`;
                            } else { // Handle cases where DATA_SCALE is 0
                                if (column.DATA_PRECISION <= 4) {
                                    columnType = 'SMALLINT';
                                } else if (column.DATA_PRECISION <= 9) {
                                    columnType = 'INTEGER';
                                } else if (column.DATA_PRECISION <= 18) {
                                    columnType = 'BIGINT';
                                } else {
                                    columnType = 'NUMERIC'; 
                                }
                            }
                        } else {
                            columnType = 'NUMERIC'; 
                        }
                        break;
                    case 'DATE':
                        columnType = 'TIMESTAMP';
                        break;
                    case 'TIMESTAMP':
                    case 'TIMESTAMP(6)':
                        columnType = 'TIMESTAMP'; 
                        break;
                    case 'CLOB':
                        columnType = 'TEXT';
                        break;
                    case 'BLOB':
                        columnType = 'BYTEA';
                        break;
                    case 'RAW':
                        columnType = `BYTEA`;
                        break;
                    case 'FLOAT':
                        columnType = 'DOUBLE PRECISION';
                        break;
                    case 'MDSYS.SDO_GEOMETRY':
                        columnType = 'geometry'; 
                        break;
                    default:
                        columnType = 'TEXT'; 
                }
                ddl += `    "${column.COLUMN_NAME.toLowerCase()}" ${columnType} ${column.NULLABLE === 'Y' ? '' : 'NOT NULL'},\n`;
            });
            ddl = ddl.slice(0, -2) + '\n);';

            queriesToRun.push(ddl);

            // Generate and add comments on table and columns
            queriesToRun.push(`COMMENT ON TABLE ${targetSchemaName.toLowerCase()}."${tableName.toLowerCase()}" IS 'Table for ${tableName.toLowerCase()}';`);
            columns.forEach(column => {
                if (column.COMMENTS) {
                    queriesToRun.push(`COMMENT ON COLUMN ${targetSchemaName.toLowerCase()}."${tableName.toLowerCase()}"."${column.COLUMN_NAME.toLowerCase()}" IS '${column.COMMENTS.replace(/'/g, "''")}';`);
                }
            });
        }

        // Execute DDL queries
        for (const query of queriesToRun) {
            await executePostgresQuery(query);
        }
        let newUserDetails; 
        // After successful creation of tables, attempt to create user and grant access
        try {
            newUserDetails = await createUserAndGrantAccess(userEmail, selectedTables, targetSchemaName, pgClient);
            console.log('User created with details:', newUserDetails);


        } catch (userCreationError) {
            console.error('Failed to create user or grant access:', userCreationError);
            res.status(500).send('Failed to create user or grant permissions.');
            return; // Stop further execution in case of an error
        }

        // Calculate replication order and insert into CDC master table
        let replicationOrder = 1;
        for (let i = 0; i < selectedTables.length; i++) {
            if (i % 5 === 0 && i !== 0) {
                replicationOrder++;
            }
            const tableName = selectedTables[i];
            // Check if the entry exists
            const checkQuery = `SELECT * FROM ods_data_management.cdc_master_table_list WHERE source_schema_name = '${sourceSchemaName.toLowerCase()}' AND source_table_name = '${tableName.toLowerCase()}'`;
            const checkResult = await executePostgresQuery(checkQuery);
            targetSchemaName = `${applicationName}_replication`;

            if (checkResult.rowCount === 0) {
                const insertQuery = `
                    INSERT INTO ods_data_management.cdc_master_table_list (
                        application_name, source_schema_name, source_table_name, target_schema_name, target_table_name,
                        truncate_flag, cdc_column, active_ind, replication_order, customsql_ind, replication_source, custodian
                    ) VALUES (
                        '${applicationName}', '${sourceSchemaName.toLowerCase()}', '${tableName.toLowerCase()}', '${targetSchemaName.toLowerCase()}', '${tableName.toLowerCase()}',
                        'Y', 'UPDATE_DATE', 'Y', ${replicationOrder}, 'N', 'oracle_lob', '${ownerName}'
                    );
                `;
                await executePostgresQuery(insertQuery);
            }
        }
        // insert selected tables, owenerID and application name to datatable
        try {

            // Insert each selected table into the datatable
            for (const tableName of selectedTables) {
                await insertIntoDatatable(tableName, applicationName, userEmail);
            }
            console.log('Tables inserted into datatable for pulled data');
           
        } catch (error) {
            console.error('Failed to process request:', error);
            res.status(500).send('An error occurred during processing.');
        }
        // res.send(`<pre>Queries executed successfully. Check the console for details.</pre>`);
        const url = "/appList"; 
        const message = `
        <html>
        <head>
            <title>Setup Complete</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f4f4f4;
                }
                .content {
                    text-align: center;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                .credentials {
                    background-color: #eef;
                    border: 1px solid #ccd;
                    padding: 10px;
                    margin-top: 20px;
                }
                strong {
                    font-weight: bold;
                }
                a {
                    display: inline-block;
                    margin-top: 20px;
                    padding: 10px 20px;
                    background-color: #0056b3;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                }
                a:hover {
                    background-color: #003580;
                }
            </style>
        </head>
        <body>
            <div class="content">
                <h1>Data Extraction Setup Successfully</h1>
                <p>Contact the data foundation team to get the Power BI Gateway to start using the data.</p>
                <div class="credentials">
                    You can also use direct access to connect to our ODS database.<br>
                    Here are the credentials:<br>
                    <strong>HOST:</strong>theory.bcgov<br>
                    <strong>PORT:</strong>5433<br>
                    <strong>DATABASE:</strong>odsdev<br>
                    <strong>Username:</strong> ${newUserDetails.username}<br>
                    <strong>Password:</strong> ${newUserDetails.password}<br>
                    <strong>Please copy the above information. keep these in a safe place!</strong><br>
                    <strong>If you forgort the credentials, you can re-start the data pull process again!</strong>
                </div>
                <a href="${url}">Go Back to the Application List</a>
            </div>
        </body>
        </html>
        `;
        newUserDetails={};
        res.send(message);
         // Try to trigger the Airflow DAG
         try {
            await triggerAirflowDAG();  
            console.log('DAG triggered successfully.');
        } catch (dagError) {
            console.error('Failed to trigger Airflow DAG:', dagError);

        }
        
    } catch (error) {
        console.error('Error during DDL generation or execution:', error);
        res.status(500).send(`An error occurred: ${error.message}`);
    }
});


module.exports = router;
