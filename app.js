const express = require('express');
const morgan = require('morgan');
require('dotenv').config();
const bodyParser = require('body-parser');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const keycloakConfig = require('./keycloak');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL client
const oracledb = require('oracledb');
const app = express();
const port = 3000;
const { getCredentialsFromVault } = require('./modules/getCredentialsFromVault');
const { getOracleCredentials } = require('./modules/getOracleCredentials');
const { connectToPosgDatabase } = require('./modules/connectToPosgDatabase');
const { connectDatabase, useCredentials } = require('./modules/connectDatabase');
const { connectToOracleDatabase } = require('./modules/connectToOracleDatabase');
const uploadBIRouter= require('./routes/uploadBI');
const { verifyUserEmail } = require('./modules/verifyUserEmail');
const { getUserDetails } = require('./modules/getUserDetails');
const { logUserVisit } = require('./modules/logUserVisit');
const roleRoutes = require('./routes/roleRoutes');
const userRoutes = require('./routes/userRoutes');
const automationRouter = require('./routes/automation');
const databaseRouters = require('./routes/databaseRoutes');
const appRouters = require('./routes/appRoutes');
const memoryStore = new session.MemoryStore();
const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);
const dataTableRoutes = require('./routes/dataTableRoutes');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(morgan('combined'));
app.use(session({
    secret: 'fjhdjkfhsdkjafhn34k32hj24jh32j4h23jh4kj32',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
}));

app.use(keycloak.middleware({
    logout: '/logout',
    admin: '/',
}));

//check user if it is admin.
async function checkAdminRole(req, res, next) {
    if (!req.kauth || !req.kauth.grant) {
        return res.status(401).send('Access Denied: No authentication token found.');
    }

    const email = req.kauth.grant.access_token.content.email;

    try {
        const pgClient = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT); // Connect to PostgreSQL ODS Database using a specific identifier if needed
        const result = await pgClient.query('SELECT roleid FROM dapui."user" WHERE email = $1', [email]);
        console.log(result); 
        // pgClient.release();  // Make sure to release the client after use
        console.log(result.rows[0].roleid); 
        if (result.rows.length > 0 && result.rows[0].roleid === 1) {
            next(); // Proceed if admin
        } else {
            res.status(403).send('Access Denied: You do not have the necessary permissions.');
        }
    } catch (error) {
        console.error('Failed to verify user role:', error);
        res.status(500).send('Internal server error');
    }
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
//admin home page.
app.get(['/', '/index'], keycloak.protect(), (req, res) => {
    res.render('index', { user: req.kauth.grant.access_token.content });
});

// Use routes

app.use('/automation', keycloak.protect(), automationRouter)
// app.use('/roles', keycloak.protect(), roleRoutes);
// app.use('/users', keycloak.protect(), userRoutes);
// app.use('/databases',  keycloak.protect(), databaseRouters);
// app.use('/appList', keycloak.protect(), appRouters);
app.use('/uploadBI', keycloak.protect(), uploadBIRouter);
app.use('/roles', keycloak.protect(), checkAdminRole, roleRoutes); // Accessible only to admins
app.use('/users', keycloak.protect(), checkAdminRole, userRoutes); // Accessible only to admins
app.use('/databases', keycloak.protect(), checkAdminRole, databaseRouters); // Accessible only to admins
app.use('/appList', keycloak.protect(), appRouters); // Accessible to all authenticated users
app.use('/table', keycloak.protect(), dataTableRoutes);

// app.get('/users', keycloak.protect(), (req, res) => {
//     // Example: Fetch users from database and pass to the EJS template
//     res.render('users', { users: fetchedUsers });
// });


// // Role Management route
// app.get('/roles', keycloak.protect(), (req, res) => {
//     res.render('roles', { roles: fetchedRoles });
// });

// Database Management route
// app.get('/databases', keycloak.protect(), (req, res) => {
//     res.render('databases', { databases: fetchedDatabases });
// });



// app.listen(port, () => {
//     console.log(`Server running on http://localhost:${port}`);
// });
app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
});
