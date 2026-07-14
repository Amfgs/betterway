const nodemailer = require("nodemailer");
const { isProduction } = require("../config/security");

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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

async function sendPasswordResetEmail({ email, name, token }) {
  const appUrl = process.env.APP_WEB_URL || process.env.CLIENT_URL || "http://localhost:5173";
  const resetUrl = `${appUrl.replace(/\/$/, "")}/login?mode=reset&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const subject = "Redefinição de senha do Valorize+";
  const text = [
    `Olá${name ? `, ${name}` : ""}.`,
    "",
    "Recebemos uma solicitação para redefinir sua senha no Valorize+.",
    `Use este código: ${token}`,
    `Ou abra este link: ${resetUrl}`,
    "",
    "O código expira em 30 minutos. Se você não pediu isso, ignore este e-mail."
  ].join("\n");

  if (!smtpConfigured()) {
    if (!isProduction()) console.log(`[Valorize+] Token de redefinição para ${email}: ${token}`);
    return { delivered: false, resetUrl };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Redefinição de senha do Valorize+</h2>
        <p>Olá${name ? `, ${name}` : ""}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p><strong>Código:</strong> ${token}</p>
        <p><a href="${resetUrl}">Abrir tela de redefinição</a></p>
        <p>O código expira em 30 minutos. Se você não pediu isso, ignore este e-mail.</p>
      </div>
    `
  });

  return { delivered: true, resetUrl };
}

module.exports = {
  sendPasswordResetEmail,
  smtpConfigured
};
