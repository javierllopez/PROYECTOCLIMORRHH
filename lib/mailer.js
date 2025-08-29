const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Carga configuración desde account_transport.json
function cargarConfig() {
  const ruta = path.join(__dirname, '..', 'account_transport.json');
  const raw = fs.readFileSync(ruta, 'utf8');
  const cfg = JSON.parse(raw);
  return cfg;
}

let baseUrl;

function getBaseUrl() {
  if (!baseUrl) {
    const cfg = cargarConfig();
    baseUrl = cfg.baseUrl || process.env.APP_BASE_URL || `http://192.168.0.94:${process.env.PORT || 3000}`;
  }
  return baseUrl;
}

async function getGmailAccessToken(cfg) {
  const { clientId, clientSecret, refreshToken, redirectUri } = cfg.auth || {};
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Faltan credenciales OAuth2 (clientId/clientSecret/refreshToken) para Gmail.');
  }
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri || 'https://developers.google.com/oauthplayground'
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  const tokenResponse = await oAuth2Client.getAccessToken();
  // getAccessToken puede devolver un string o un objeto con .token
  const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!accessToken) throw new Error('No se pudo obtener accessToken de OAuth2.');
  return accessToken;
}

async function enviarCorreo({ to, subject, html, text, from }) {
  const cfg = cargarConfig();
  const mailFrom = from || cfg.from || (cfg.auth && cfg.auth.user) || 'no-reply@example.com';

  // Caso Gmail + OAuth2
  if ((cfg.service && cfg.service.toLowerCase() === 'gmail') && cfg.auth && cfg.auth.type === 'OAuth2') {
    const accessToken = await getGmailAccessToken(cfg);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: cfg.auth.user,
        clientId: cfg.auth.clientId,
        clientSecret: cfg.auth.clientSecret,
        refreshToken: cfg.auth.refreshToken,
        accessToken: accessToken,
      },
    });
    return transporter.sendMail({ from: mailFrom, to, subject, html, text });
  }

  // Fallback: crear transport genérico con la config tal cual
  const transporter = nodemailer.createTransport(cfg);
  return transporter.sendMail({ from: mailFrom, to, subject, html, text });
}

module.exports = { enviarCorreo, getBaseUrl };
