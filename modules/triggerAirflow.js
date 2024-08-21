// // triggerAirflow.js
// const axios = require('axios');

// // Function to trigger the Airflow DAG
// async function triggerAirflowDAG() {
//     // const airflowApiUrl = 'https://nr-airflow-dev.apps.emerald.devops.gov.bc.ca/api/v1/dags';
//     const airflowApiUrl = `https://nr-airflow-${process.env.CONFIG_ENV}.apps.emerald.devops.gov.bc.ca/api/v1/dags`;
//     const dagId = 'auto_dag_creation';
//     const endpoint = `${airflowApiUrl}/${dagId}/dagRuns`;
    
//     const postData = {
//         conf: {}, // Optional: Configuration data if needed
//         dag_run_id: `auto_trigger_${new Date().toISOString()}` // Optional: Custom Run ID
//     };

//     // Encode credentials for basic authentication
//     const base64Credentials = Buffer.from(`${process.env.AIRFLOW_USERNAME}:${process.env.AIRFLOW_PASSWORD}`).toString('base64');
//     const authHeader = `Basic ${base64Credentials}`;

//     try {
//         const response = await axios.post(endpoint, postData, {
//             headers: {
//                 'Authorization': authHeader, // Basic Authentication Header
//                 'Content-Type': 'application/json'
//             }
//         });
//         console.log('DAG triggered successfully:', response.data);
//         return response.data; // Returning response data for further processing if needed
//     } catch (error) {
//         console.error('Failed to trigger DAG:', error);
//         throw error;
//     }
// }

// module.exports = { triggerAirflowDAG };
const axios = require('axios');

// Function to check if a DAG is currently running
async function isDAGRunning(airflowApiUrl, dagId) {
    const dagStatusEndpoint = `${airflowApiUrl}/${dagId}/dagRuns`;
    const authHeader = `Basic ${Buffer.from(`${process.env.AIRFLOW_USERNAME}:${process.env.AIRFLOW_PASSWORD}`).toString('base64')}`;

    try {
        console.log(`Checking if DAG ${dagId} is running...`);
        const response = await axios.get(dagStatusEndpoint, {
            headers: {
                'Authorization': authHeader
            },
            timeout: 10000  // Timeout after 10 seconds
        });
        const isRunning = response.data.dag_runs.some(dagRun => dagRun.state === 'running');
        console.log(`DAG ${dagId} running status: ${isRunning}`);
        return isRunning;
    } catch (error) {
        console.error('Error checking if DAG is running:', error.message);
        throw error;
    }
}

// Function to trigger an Airflow DAG
async function triggerAirflowDAG() {
    const airflowApiUrl = `https://nr-airflow-${process.env.CONFIG_ENV}.apps.emerald.devops.gov.bc.ca/api/v1/dags`;
    // const airflowApiUrl = `https://nr-airflow-test.apps.emerald.devops.gov.bc.ca/api/v1/dags`;
    const dagId = 'auto_dag_creation';

    // Check if DAG is currently running
    if (await isDAGRunning(airflowApiUrl, dagId)) {
        console.log(`DAG ${dagId} is currently running. Aborting trigger to prevent overlap.`);
        return;
    }

    const endpoint = `${airflowApiUrl}/${dagId}/dagRuns`;
    const postData = {
        conf: {}, // Optional: Configuration data if needed
        dag_run_id: `auto_trigger_${new Date().toISOString()}` // Optional: Custom Run ID
    };

    // Encode credentials for basic authentication
    const base64Credentials = Buffer.from(`${process.env.AIRFLOW_USERNAME}:${process.env.AIRFLOW_PASSWORD}`).toString('base64');
    const authHeader = `Basic ${base64Credentials}`;

    try {
        console.log(`Attempting to trigger DAG ${dagId}...`);
        const response = await axios.post(endpoint, postData, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 30000  // Timeout after 30 seconds
        });
        console.log('DAG triggered successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error(`Failed to trigger DAG ${dagId}:`, error.message);
        if (error.response) {
            console.error('Detailed Airflow response:', error.response.data);
        }
        throw error;
    }
}

module.exports = { triggerAirflowDAG };
