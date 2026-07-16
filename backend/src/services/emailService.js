const nodemailer = require("nodemailer");
const axios = require("axios");
const { isProduction } = require("../config/security");

const BRAND_NAME = "Better Way";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function emailConfigured() {
  return hasSmtpConfig() || hasResendConfig();
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function deliverEmail({ email, subject, text, html }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  if (hasResendConfig()) {
    try {
      await axios.post(
        "https://api.resend.com/emails",
        { from, to: [email], subject, text, html },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );
    } catch (error) {
      const providerMessage = String(error.response?.data?.message || "");
      const providerRequiresDomain = error.response?.status === 403 && providerMessage.toLowerCase().includes("verify a domain");
      if (providerRequiresDomain) {
        const domainError = new Error(
          "A entrega de e-mail da Resend precisa de um domínio verificado para enviar para este destinatário."
        );
        domainError.status = 503;
        domainError.expose = true;
        throw domainError;
      }
      const deliveryError = new Error("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
      deliveryError.status = 502;
      deliveryError.expose = true;
      throw deliveryError;
    }
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({ from, to: email, subject, text, html });
}

async function sendPasswordResetEmail({ email, name, token }) {
  const subject = `Redefinição de senha da ${BRAND_NAME}`;
  const safeName = escapeHtml(name);
  const text = [
    `Olá${name ? `, ${name}` : ""}.`,
    "",
    `Recebemos uma solicitação para redefinir sua senha na ${BRAND_NAME}.`,
    `Use este código: ${token}`,
    "",
    "O código expira em 30 minutos. Se você não pediu isso, ignore este e-mail."
  ].join("\n");

  if (!emailConfigured()) {
    if (!isProduction() && process.env.NODE_ENV !== "test") console.log(`[${BRAND_NAME}] Código de redefinição para ${email}: ${token}`);
    return { delivered: false };
  }

  await deliverEmail({
    email,
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #10221c; max-width: 560px; margin: 0 auto; padding: 32px;">
        <p style="color: #0d6b4f; font-size: 18px; font-weight: 800; margin: 0 0 28px;">BW · Better Way</p>
        <h2 style="font-size: 26px; margin: 0 0 18px;">Redefinição de senha</h2>
        <p>Olá${safeName ? `, ${safeName}` : ""}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p style="display: inline-block; background: #e7f7ef; border: 1px solid #b9ead3; border-radius: 8px; color: #0d6b4f; font-size: 24px; font-weight: 800; letter-spacing: 4px; padding: 12px 18px;"><strong>${token}</strong></p>
        <p>O código expira em 30 minutos. Se você não pediu isso, ignore este e-mail.</p>
      </div>
    `
  });

  return { delivered: true };
}

async function sendEmailVerification({ email, name, token }) {
  const subject = `Confirme seu e-mail na ${BRAND_NAME}`;
  const safeName = escapeHtml(name);
  const text = [
    `Olá${name ? `, ${name}` : ""}.`,
    "",
    `Confirme seu e-mail para ativar sua conta na ${BRAND_NAME}.`,
    `Use este código: ${token}`,
    "",
    "O código expira em 24 horas. Se você não criou esta conta, ignore este e-mail."
  ].join("\n");

  if (!emailConfigured()) {
    if (!isProduction() && process.env.NODE_ENV !== "test") console.log(`[${BRAND_NAME}] Código de verificação para ${email}: ${token}`);
    return { delivered: false };
  }

  await deliverEmail({
    email,
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #10221c; max-width: 560px; margin: 0 auto; padding: 32px;">
        <p style="color: #0d6b4f; font-size: 18px; font-weight: 800; margin: 0 0 28px;">BW · Better Way</p>
        <h2 style="font-size: 26px; margin: 0 0 18px;">Confirme seu e-mail</h2>
        <p>Olá${safeName ? `, ${safeName}` : ""}.</p>
        <p>Use o código abaixo para ativar sua conta:</p>
        <p style="display: inline-block; background: #e7f7ef; border: 1px solid #b9ead3; border-radius: 8px; color: #0d6b4f; font-size: 24px; font-weight: 800; letter-spacing: 4px; padding: 12px 18px;">${token}</p>
        <p>O código expira em 24 horas. Se você não criou esta conta, ignore este e-mail.</p>
      </div>
    `
  });

  return { delivered: true };
}

module.exports = {
  emailConfigured,
  sendEmailVerification,
  sendPasswordResetEmail
};
