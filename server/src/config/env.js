const path = require('node:path');

const booleanValue = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const clientOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = Object.freeze({
  port: Number(process.env.PORT) || 3001,
  clientOrigins,
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret-change-before-deploying',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  adminSetupKey: process.env.ADMIN_SETUP_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // WhatsApp was part of the original runtime and must work without an
  // additional opt-in flag. It can still be explicitly disabled in hosts
  // where Chromium is unavailable.
  enableWhatsApp: booleanValue(process.env.ENABLE_WHATSAPP, true),
  // Keep the original WhatsApp format used by the existing Members data.
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '521',
  datasetRoot: path.resolve(__dirname, '../../../resources/exercises-dataset'),
  sqlServer: {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
      encrypt: booleanValue(process.env.DB_ENCRYPT),
      trustServerCertificate: true,
    },
  },
});

module.exports = { env };
