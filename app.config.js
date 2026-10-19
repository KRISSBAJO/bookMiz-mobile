const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    path.join(__dirname, "google-services.json");
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
  };
};
