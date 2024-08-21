require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const Cryptr = require('cryptr');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Pool } = require('pg'); 
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
const dataTableRoutes = require('./routes/dataTableRoutes');
const Keycloak = require('keycloak-connect');
const keycloakConfig = require('./keycloak');
const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SEC,
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
    cookie: {
        maxAge: null // Session cookie will expire when the browser is closed
    }
}));


app.use(keycloak.middleware({
    // logout: '/logout',
    admin: '/',
}));

//check user if it is admin.
async function checkAdminRole(req, res, next) {
    if (!req.kauth || !req.kauth.grant) {
        return res.status(401).send('Access Denied: No authentication token found.');
    }

    const email = req.kauth.grant.access_token.content.email;

    try {
        const pgClient = await connectDatabase(process.env.DATABASE_ODS_IN_VAULT);
        const result = await pgClient.query('SELECT roleid FROM dapui."user" WHERE email = $1', [email]);
        console.log(result); 
        // pgClient.release();  
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
// app.get('/', (req, res) => {
//     res.send('Hello, World!');
//   });
// Use routes

app.use('/automation', keycloak.protect(), automationRouter)
app.use('/uploadBI', keycloak.protect(), uploadBIRouter);
app.use('/roles', keycloak.protect(), checkAdminRole, roleRoutes); // Accessible only to admins
app.use('/users', keycloak.protect(), checkAdminRole, userRoutes); // Accessible only to admins
app.use('/databases', keycloak.protect(), checkAdminRole, databaseRouters); // Accessible only to admins
app.use('/appList', keycloak.protect(), appRouters); // Accessible to all authenticated users
app.use('/table', keycloak.protect(), dataTableRoutes);

app.get('/logouts', async (req, res) => {
    try {
        // Close PostgreSQL connections if stored in the session
        if (req.session.pgClient) {
            try {
                await req.session.pgClient.end();
                console.log('End postgre connection'); 
            } catch (error) {
                console.error('Failed to close PostgreSQL connection:', error);
            }
        }

        // Close Oracle connections if stored in the session
        if (req.session.oracleClient && oracledb.getPool()) {
            try {
                await oracledb.getPool().close(0);
                console.log('End oracle connection'); 

            } catch (error) {
                console.error('Failed to close Oracle connection:', error);
            }
        }

        // Destroy the session
        req.session.destroy(err => {
            console.log('destroy the session'); 
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Internal server error');
            }

            // Render the logout page
            res.render('logouts');
        });

    } catch (error) {
        console.error('Error during logout process:', error);
        res.status(500).send('Internal server error');
    }
});






// app.listen(port, () => {
//     console.log(`Server running on http://localhost:${port}`);
// });
app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
});
