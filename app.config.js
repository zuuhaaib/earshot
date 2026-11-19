// Everything lives in app.json. This only adds Android's Firebase file once it
// exists, which Android needs to receive push notifications. Without the file,
// builds still work; Android just can't be notified.
const fs = require('fs');

module.exports = ({ config }) =>
  fs.existsSync('./google-services.json') ? { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } } : config;
