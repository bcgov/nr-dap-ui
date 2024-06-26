const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to retrieve credentials from the vault
async function getOracleCredentials(brokerUrl, brokerJwt, vaultUrl, vaultEnv, secretName) {
    try {
        const intentionPath = path.join('', 'intention.json');
        const intentionData = fs.readFileSync(intentionPath);
        const intention = JSON.parse(intentionData.toString());

        const intentionResponse = await axios.post(`${brokerUrl}/v1/intention/open`, intention, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${brokerJwt}`
            }
        });

        const actionToken = intentionResponse.data.actions['dap-data-sync'].token;
        const wrappedTokenResponse = await axios.post(`${brokerUrl}/v1/provision/token/self`, {}, {
            headers: {
                "Accept": "application/json",
                "X-Broker-Token": actionToken
            }
        });
        const wrappedVaultToken = wrappedTokenResponse.data.wrap_info.token;

        const vaultTokenResponse = await axios.post(`${vaultUrl}/v1/sys/wrapping/unwrap`, {}, {
            headers: {
                "X-Vault-Token": wrappedVaultToken
            }
        });

        const vaultToken = vaultTokenResponse.data.auth.client_token;
        const secretResponse = await axios.get(`${vaultUrl}/v1/apps/data/${vaultEnv}/nr-data-solutions/nr-data-analytics-platform/${secretName}`, {
            headers: {
                "Accept": "application/json",
                "X-Vault-Token": vaultToken
            }
        });
        //debug
        console.log(secretResponse)
        return secretResponse.data.data;

    } catch (error) {
        console.error(`An error occurred: ${error}`);
        return null;
    }
}


module.exports = { getOracleCredentials };