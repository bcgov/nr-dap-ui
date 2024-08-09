module.exports = {
  "realm": "standard",
  "auth-server-url": process.env.KEYCLOAK_URL,
  "ssl-required": "external",
  "resource": "dap-data-extraction-tool-5457",
  "credentials": {
    secret: process.env.KEYCLOAK_SECRET
  },
  "confidential-port": 0,
  "redirect-uri": process.env.REDIRECT_URI  // Using environment variable to set redirect URI
};
