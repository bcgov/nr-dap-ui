// triggerAirflow.js
const axios = require('axios');

// Function to trigger the Airflow DAG
async function triggerAirflowDAG() {
    // const airflowApiUrl = 'https://nr-airflow-dev.apps.emerald.devops.gov.bc.ca/api/v1/dags';
    const airflowApiUrl = `https://nr-airflow-${process.env.CONFIG_ENV}.apps.emerald.devops.gov.bc.ca/api/v1/dags`;
    const dagId = 'auto_dag_creation';
    const endpoint = `${airflowApiUrl}/${dagId}/dagRuns`;
    
    const postData = {
        conf: {}, // Optional: Configuration data if needed
        dag_run_id: `auto_trigger_${new Date().toISOString()}` // Optional: Custom Run ID
    };

    // Encode credentials for basic authentication
    const base64Credentials = Buffer.from(`${process.env.AIRFLOW_USERNAME}:${process.env.AIRFLOW_PASSWORD}`).toString('base64');
    const authHeader = `Basic ${base64Credentials}`;

    try {
        const response = await axios.post(endpoint, postData, {
            headers: {
                'Authorization': authHeader, // Basic Authentication Header
                'Content-Type': 'application/json'
            }
        });
        console.log('DAG triggered successfully:', response.data);
        return response.data; // Returning response data for further processing if needed
    } catch (error) {
        console.error('Failed to trigger DAG:', error);
        throw error;
    }
}

module.exports = { triggerAirflowDAG };
