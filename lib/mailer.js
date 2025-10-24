const nodemailer = require('nodemailer');

let transporteSMTP;
let baseUrl;

function convertirBoolean(valor) {
  if (typeof valor === 'string') {
    return valor.toLowerCase() === 'true';
  }
  return Boolean(valor);
}

function obtenerConfigSMTP() {
  const host = process.env.MAIL_HOST || 'smtp.cloudmailin.net';
  const puerto = Number(process.env.MAIL_PORT || 587);
  const usuario = process.env.MAIL_USER;
  const contrasena = process.env.MAIL_PASSWORD;
  if (!usuario || !contrasena) {
    throw new Error('Faltan las credenciales MAIL_USER y MAIL_PASSWORD en las variables de entorno.');
  }
  return {
    host,
    port: puerto,
    secure: convertirBoolean(process.env.MAIL_SECURE) || puerto === 465,
    requireTLS: convertirBoolean(process.env.MAIL_REQUIRE_TLS) || true,
    auth: {
      user: usuario,
      pass: contrasena,
    },
  };
}

function obtenerTransporte() {
  if (!transporteSMTP) {
    const configuracion = obtenerConfigSMTP();
    transporteSMTP = nodemailer.createTransport(configuracion);
  }
  return transporteSMTP;
}

function obtenerRemitentePredeterminado() {
  return process.env.MAIL_FROM || process.env.MAIL_USER || 'no-reply@cloudmailin.net';
}

/**
 * Envia un correo electrónico usando CloudMailin como relay SMTP.
 * @param {{to:string, subject:string, html?:string, text?:string, from?:string}} opciones
 * @returns {Promise<import('nodemailer/lib/smtp-transport').SentMessageInfo>}
 */
async function enviarCorreo({ to, subject, html, text, from }) {
  if (!to) {
    throw new Error('Debés indicar el destinatario (to) del correo.');
  }
  if (!subject) {
    throw new Error('Debés indicar el asunto (subject) del correo.');
  }
  const transporte = obtenerTransporte();
  const remitente = from || obtenerRemitentePredeterminado();
  return transporte.sendMail({
    from: remitente,
    to,
    subject,
    html,
    text,
  });
}

function getBaseUrl() {
  if (!baseUrl) {
    baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  }
  return baseUrl;
}

module.exports = { enviarCorreo, getBaseUrl };
