module.exports = {
    realm: "standard",
    "auth-server-url": "https://loginproxy.gov.bc.ca/auth",
    "ssl-required": "external",
    resource: "dap-data-extraction-tool-5457",
    credentials: {
      secret: process.env.KEYCLOAK_SECRET
    },
    "confidential-port": 0,
    "public-client": false
  };
  