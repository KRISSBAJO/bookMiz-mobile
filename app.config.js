const fs = require("node:fs");
const path = require("node:path");
const { expo } = require("./app.json");

module.exports = () => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    path.join(__dirname, "google-services.json");
  return {
    ...expo,
    android: {
      ...expo.android,
      ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
  };
};
