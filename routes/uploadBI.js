const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const router = express.Router();

// Setup for storing uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Save the file with the original filename
    }
});

const upload = multer({ storage: storage });

// Environment-specific workspace IDs
const workspaceIDs = {
    dev: 'c7ef19d0-b230-4b9e-89e2-984fccc75198',
    test: '5b2835d9-510c-495c-b915-b24c52aacd05',
    prod: '3c32cb15-e9fd-4a2b-9ded-a58ab3f5b637'
};

// Token retrieval for Power BI
async function getPowerBIToken() {
    const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'client_credentials'
    });

    const response = await axios.post(url, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
}

// Helper function to fetch dataset users
async function getDatasetReadUsers(workspaceId, datasetId, token) {
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/users`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    try {
        const response = await axios.get(url, { headers });
        return response.data.value.filter(user => user.permissions === 'Read');
    } catch (error) {
        console.error('Failed to retrieve dataset users:', error);
        throw new Error('Failed to retrieve dataset users');
    }
}


// Retrieve report details using file name
async function getReportDetails(workspaceId, token, fileName) {
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports`;
    const headers = { Authorization: `Bearer ${token}` };
    const response = await axios.get(url, { headers });
    const reports = response.data.value;
    const report = reports.find(r => r.name === fileName.replace('.pbix', ''));
    if (report) {
        return report;
    } else {
        throw new Error('Report not found');
    }
}

// Publish to Power BI
async function publishToPowerBI(filePath, workspaceId, token) {
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/imports?datasetDisplayName=${encodeURIComponent(path.basename(filePath, '.pbix'))}&nameConflict=CreateOrOverwrite`;
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    const config = { headers: { ...formData.getHeaders(), Authorization: `Bearer ${token}` } };
    const response = await axios.post(url, formData, config);
    return response.data;
}

// Routes
router.get('/', (req, res) => res.render('uploadBi'));

router.post('/upload', upload.single('pbixfile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const { environment } = req.body;
    const workspaceId = workspaceIDs[environment];
    try {
        const token = await getPowerBIToken();
        const publishResult = await publishToPowerBI(req.file.path, workspaceId, token);
        console.log(publishResult.id);
        const reportDetails = await getReportDetails(workspaceId, token, req.file.originalname);
        fs.unlinkSync(req.file.path); // Clean up the uploaded file
        res.send(`
        <html>
        <head>
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
                .container {
                    text-align: center;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                a {
                    display: inline-block;
                    margin: 10px;
                    padding: 8px 16px;
                    background: #0078d4;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    transition: background-color 0.3s;
                }
                a:hover {
                    background-color: #0056a3;
                }
                a.back {
                    background: #777;
                }
                a.back:hover {
                    background: #555;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>File uploaded and published successfully.${reportDetails.users}</h2>
                <p><a href="https://app.powerbi.com/groups/${workspaceId}/reports/${reportDetails.id}" target="_blank">View Report</a></p>
                <p><a href="/" class="back">Go to homepage</a></p>
            </div>
        </body>
        </html>
    `);
        // res.send(`File uploaded and published successfully. Report URL: https://app.powerbi.com/groups/${workspaceId}/reports/${reportDetails.id}`);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send(`Error: ${error.message}`);
    }
});

module.exports = router;
