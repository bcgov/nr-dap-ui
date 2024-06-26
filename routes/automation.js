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
let ODSdatabase = 'testlocal';
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

// Function to insert selected table information into the ODS datatable
async function insertIntoDatatable(tableName, applicationName, userEmail) {
    const userQuery = 'SELECT userid FROM dapui."user" WHERE email = $1';
    const userRes = await pgClient.query(userQuery, [userEmail]);
    if (userRes.rows.length === 0) {
        throw new Error('User not found.');
    }
    const ownerUserId = userRes.rows[0].userid;

    const insertQuery = `
        INSERT INTO dapui.datatable (tablename, applicationname, owneruserid)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
    const insertRes = await pgClient.query(insertQuery, [tableName, applicationName, ownerUserId]);
    console.log('Inserted into datatable:', insertRes.rows[0]);
}

  // Main route
  router.get('/', async (req, res) => {
    try {
        const vaultName = req.query.vaultName; // Retrieve the vaultName from the query parameters
        applicationName = req.query.applicationName; // Retrieve the appplicationName from the query parameters
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
        pgClient = await connectDatabase(ODSdatabase); // Connect to PostgreSQL ODS Database

        // Pass the client/connection to the logging function
        await logUserVisit(userDetails, pgClient);

        // Verify user email
        const isAuthorized = await verifyUserEmail(userDetails.email, pgClient);
        if (!isAuthorized) {
        console.log('granted access'); 
          // User found, access granted
          try {
            // Fetch user details and related data
            // const userData = await getUserDetails(email, pgClient);
            // console.log(userData); 
            //get ODS user application name and vault secrets
            // if (userData && userData.vaultnames && userData.vaultnames.length > 0) {
            //     // Use the first vault name to connect to the Oracle database
            //     const firstVaultName = userData.vaultnames[0]; // Assuming this is the identifier or part of the connection string
            //     console.log(firstVaultName); 
            //     // Database configuration variables
            //     applicationName = userData.applicationnames[0];
            //     oracleConnection = await connectDatabase(firstVaultName); // Adjust connectDatabase function to accept dynamic identifiers if necessary

            // } 
            oracleConnection = await connectDatabase(vaultName);

            //get application database schema name
            sourceSchemaName = useCredentials(); 
            console.log(sourceSchemaName); 
            targetSchemaName = `test_${sourceSchemaName.toLowerCase()}_replication`;
            //get ODS user and application information.
            // const userQuery = await pgClient.query('SELECT userid FROM dapui."user" WHERE email = $1', [email]);
            // if (userQuery.rows.length > 0) {
            //     const userId = userQuery.rows[0].userid;
            //     // Fetch related databases
            //     const databasesQuery = await pgClient.query('SELECT databasename, applicationname, vaultname, schemaname FROM dapui."database" WHERE owneruserid = $1', [userId]);
            //     const databases = databasesQuery.rows;
            //     // Fetch tables for selection
            //     const tables = await getAllTables(oracleConnection, sourceSchemaName); // Adjust accordingly

            //     res.render('automation', { tables, databases });
            // } else {
            //     res.status(404).send('User not found.');
            // }
            //get tables from oracle database
            const tables = await getAllTables(oracleConnection, sourceSchemaName); 
            res.render('automation', { tables});
            // res.render('automation', { tables, databases });
            // let html = `
            //     <html>
            //     <head>
            //         <title>Select Tables</title>
            //         <style>
            //             body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f4f9; }
            //             h1 { color: #333; }
            //             ul { padding: 0; }
            //             li { list-style: none; margin-bottom: 10px; }
            //             input[type="checkbox"] { margin-right: 10px; }
            //             input[type="submit"] { margin-top: 20px; padding: 10px 20px; background-color: #0056b3; color: white; border: none; border-radius: 5px; cursor: pointer; }
            //             input[type="submit"]:hover { background-color: #003580; }
            //             form { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            //         </style>
            //     </head>
            //     <body>
            //         <h1 style="text-align: center;">Welcome to the DAP Data Extraction Tool!</h1>
            //         <h1>Select the tables you want to extract data from.</h1>
            //         <form action="/generate-ddl" method="post">
            //             <ul>`;
            // tables.forEach(table => {
            //     html += `<li><input type="checkbox" name="tables" value="${table}">${table}</li>`;
            // });
            // html += `    </ul>
            //             <input type="submit" value="Submit">
            //         </form>
            //     </body>
            //     </html>`;
            // res.send(html);
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
            // Ensure selectedTables is always an array
        // if (typeof selectedTables === 'string') {
        //     selectedTables = [selectedTables];
        // }
        if (!Array.isArray(selectedTables)) {
            selectedTables = [selectedTables]; // Convert to array if only one table is selected
        }

        const queriesToRun = [];

        // Check and create schema if not exists
        queriesToRun.push(`CREATE SCHEMA IF NOT EXISTS ${targetSchemaName.toLowerCase()}`);

        for (const tableName of Array.isArray(selectedTables) ? selectedTables : [selectedTables]) {
            const columns = await getColumnsForTable(tableName);
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
                                    columnType = 'NUMERIC'; // Use NUMERIC for very large precision numbers without any decimal places
                                }
                            }
                        } else {
                            columnType = 'NUMERIC'; // Default fallback for NUMBER without precision or scale
                        }
                        break;
                    case 'DATE':
                        columnType = 'TIMESTAMP';
                        break;
                    case 'TIMESTAMP':
                    case 'TIMESTAMP(6)':
                        columnType = 'TIMESTAMP'; // Consider using 'TIMESTAMP WITH TIME ZONE' for TZ types
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
                        columnType = 'geometry'; // Install PostGIS extension in ods.
                        break;
                    default:
                        columnType = 'TEXT'; // Fallback for unrecognized types
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
            if (checkResult.rowCount === 0) {
                const insertQuery = `
                    INSERT INTO ods_data_management.cdc_master_table_list (
                        application_name, source_schema_name, source_table_name, target_schema_name, target_table_name,
                        truncate_flag, cdc_column, active_ind, replication_order, customsql_ind, replication_source
                    ) VALUES (
                        '${applicationName}', '${sourceSchemaName.toLowerCase()}', '${tableName.toLowerCase()}', '${targetSchemaName.toLowerCase()}', '${tableName.toLowerCase()}',
                        'Y', 'UPDATE_DATE', 'Y', ${replicationOrder}, 'N', 'oracle_lob'
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
    
        } catch (error) {
            console.error('Failed to process request:', error);
            res.status(500).send('An error occurred during processing.');
        }
        // res.send(`<pre>Queries executed successfully. Check the console for details.</pre>`);
        const url = "/appList"; // Replace with your actual URL
        const message = `<pre><pre>Data extraction setup successfully. Contact data foundation team to get Power BI Gateway to start using the data.<a href="${url}">Go Back to the application List.</a></pre>`;
        res.send(message);
    } catch (error) {
        console.error('Error during DDL generation or execution:', error);
        res.status(500).send(`An error occurred: ${error.message}`);
    }
});


module.exports = router;
