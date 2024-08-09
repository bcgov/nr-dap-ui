// config.js
module.exports = {
    brokerUrl: "https://nr-broker.apps.silver.devops.gov.bc.ca",
    vaultUrl: "https://vault-iit.apps.silver.devops.gov.bc.ca",
    brokerJwt: process.env.CONFIG_BROKER_JWT,
    vaultEnv: process.env.CONFIG_VAULT_ENV
  };
  