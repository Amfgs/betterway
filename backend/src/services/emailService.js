const nodemailer = require("nodemailer");
const axios = require("axios");
const { isProduction } = require("../config/security");

const BRAND_NAME = "Better Way";
const DEFAULT_EMAIL_FROM = "Better Way <no-reply@mail.betterway.com.br>";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
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

function safeHttpsHref(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
}

async function deliverEmail({ email, subject, text, html }) {
  const from = process.env.EMAIL_FROM || (process.env.RESEND_API_KEY ? DEFAULT_EMAIL_FROM : process.env.SMTP_USER);

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
      const normalizedProviderMessage = providerMessage.toLowerCase();
      const providerRequiresDomain = error.response?.status === 403 && (
        normalizedProviderMessage.includes("verify a domain") ||
        normalizedProviderMessage.includes("testing emails") ||
        normalizedProviderMessage.includes("resend.dev")
      );
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

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

async function sendLimitAlertEmail({ email, name, usagePercent, spent, limit }) {
  if (!emailConfigured()) return { delivered: false };
  const safeName = escapeHtml(name);
  const roundedUsage = Math.round(Number(usagePercent || 0));
  const subject = roundedUsage >= 100
    ? "Seu limite mensal foi atingido"
    : `Seu limite mensal chegou a ${roundedUsage}%`;
  const text = [
    `Olá${name ? `, ${name}` : ""}.`,
    "",
    `Você já usou ${roundedUsage}% do seu limite mensal na BW.`,
    `Gasto considerado: ${currency(spent)} de ${currency(limit)}.`,
    "",
    "Investimentos não entram nesse cálculo. Abra a BW para revisar os lançamentos antes da próxima decisão."
  ].join("\n");

  await deliverEmail({
    email,
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #10221c; max-width: 560px; margin: 0 auto; padding: 32px;">
        <p style="color: #0d6b4f; font-size: 18px; font-weight: 800; margin: 0 0 28px;">BW · Better Way</p>
        <h2 style="font-size: 26px; margin: 0 0 18px;">${roundedUsage >= 100 ? "Limite mensal atingido" : "Seu limite está próximo"}</h2>
        <p>Olá${safeName ? `, ${safeName}` : ""}.</p>
        <p>Você já usou <strong>${roundedUsage}%</strong> do limite mensal configurado na BW.</p>
        <div style="background: #edf7f2; border: 1px solid #cce8da; border-radius: 8px; margin: 22px 0; padding: 18px;">
          <strong style="display:block; font-size: 22px; color: #0d6b4f;">${currency(spent)} de ${currency(limit)}</strong>
          <span style="font-size: 13px; color: #52635b;">Investimentos permanecem fora desse cálculo.</span>
        </div>
        <p>Abra a BW para revisar os lançamentos antes da próxima decisão.</p>
      </div>
    `
  });
  return { delivered: true };
}

async function sendGoalReachedEmail({ email, name, goalName, targetAmount }) {
  if (!emailConfigured()) return { delivered: false };
  const safeName = escapeHtml(name);
  const safeGoalName = escapeHtml(goalName);
  const subject = `Meta atingida: ${String(goalName || "sua meta").slice(0, 80)}`;
  const text = [
    `Olá${name ? `, ${name}` : ""}.`,
    "",
    `Você atingiu a meta "${goalName}" na BW.`,
    `Valor alcançado: ${currency(targetAmount)}.`,
    "",
    "Abra a BW para acompanhar o histórico e escolher o próximo passo."
  ].join("\n");

  await deliverEmail({
    email,
    subject,
    text,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #10221c; max-width: 560px; margin: 0 auto; padding: 32px;">
        <p style="color: #0d6b4f; font-size: 18px; font-weight: 800; margin: 0 0 28px;">BW · Better Way</p>
        <h2 style="font-size: 26px; margin: 0 0 18px;">Meta atingida</h2>
        <p>Olá${safeName ? `, ${safeName}` : ""}.</p>
        <p>Você concluiu <strong>${safeGoalName}</strong>.</p>
        <p style="display: inline-block; background: #dff5ea; border-radius: 8px; color: #0d6b4f; font-size: 22px; font-weight: 800; padding: 12px 18px;">${currency(targetAmount)}</p>
        <p>Abra a BW para acompanhar o histórico e escolher o próximo passo.</p>
      </div>
    `
  });
  return { delivered: true };
}

async function sendProductGoalAlertEmail({ email, name, goalName, product, currentAmount, reasons }) {
  if (!emailConfigured()) return { delivered: false };
  const safeName = escapeHtml(name);
  const safeGoalName = escapeHtml(goalName);
  const safeProductName = escapeHtml(product?.name || goalName);
  const safeStore = escapeHtml(product?.store || "loja acompanhada");
  const offerUrl = safeHttpsHref(product?.offerUrl || product?.url);
  const couponCode = String(product?.couponCode || "").replace(/[^A-Z0-9_-]/gi, "").slice(0, 32);
  const safeCouponCode = escapeHtml(couponCode);
  const priceReached = reasons.includes("price");
  const affordable = reasons.includes("affordable");
  const subject = priceReached && affordable
    ? `Boa hora para decidir: ${String(product?.name || goalName).slice(0, 70)}`
    : priceReached
      ? `Preço-alvo atingido: ${String(product?.name || goalName).slice(0, 70)}`
      : `Sua caixinha já compra ${String(product?.name || goalName).slice(0, 70)}`;
  const reasonLines = [
    ...(priceReached ? [`O preço chegou a ${currency(product.currentPrice)}, dentro do seu alvo de ${currency(product.targetPrice)}.`] : []),
    ...(affordable ? [`Você guardou ${currency(currentAmount)}, valor suficiente para o preço atual de ${currency(product.currentPrice)}.`] : [])
  ];
  const text = [
    `Olá${name ? `, ${name}` : ""}.`,
    "",
    `A meta "${goalName}" tem uma atualização importante:`,
    ...reasonLines.map((line) => `- ${line}`),
    `Menor preço observado pela BW: ${currency(product.lowestPrice)} em ${product.store || "loja acompanhada"}.`,
    ...(couponCode ? [`Cupom publicado na oferta: ${couponCode}`] : []),
    ...(offerUrl ? [`Link da oferta: ${product.offerUrl || product.url}`] : []),
    "",
    "Revise a oferta antes de comprar. Preço, cupom e disponibilidade podem mudar na loja."
  ].join("\n");

  const reasonCards = [
    ...(priceReached ? [`<div style="border:1px solid #cce8da;border-radius:8px;padding:14px;"><strong style="display:block;color:#0d6b4f;">Preço-alvo alcançado</strong><span style="font-size:14px;">${currency(product.currentPrice)} agora, alvo de ${currency(product.targetPrice)}</span></div>`] : []),
    ...(affordable ? [`<div style="border:1px solid #cce8da;border-radius:8px;padding:14px;"><strong style="display:block;color:#0d6b4f;">Sua caixinha já é suficiente</strong><span style="font-size:14px;">${currency(currentAmount)} guardados para um preço de ${currency(product.currentPrice)}</span></div>`] : [])
  ].join("");

  await deliverEmail({
    email,
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10221c;max-width:560px;margin:0 auto;padding:32px;">
        <p style="color:#0d6b4f;font-size:18px;font-weight:800;margin:0 0 28px;">BW · Better Way</p>
        <h2 style="font-size:26px;margin:0 0 12px;">${priceReached && affordable ? "Dois bons sinais para sua decisão" : priceReached ? "O preço que você esperava chegou" : "Sua meta já alcança o produto"}</h2>
        <p>Olá${safeName ? `, ${safeName}` : ""}. A caixinha <strong>${safeGoalName}</strong> recebeu uma atualização.</p>
        <div style="background:#edf7f2;border-radius:8px;margin:20px 0;padding:18px;">
          <strong style="display:block;font-size:18px;">${safeProductName}</strong>
          <span style="color:#52635b;font-size:13px;">${safeStore} · menor observado: ${currency(product.lowestPrice)}</span>
        </div>
        <div style="display:grid;gap:8px;">${reasonCards}</div>
        ${safeCouponCode ? `<div style="background:#f5f7f5;border:1px dashed #8aa99b;border-radius:8px;margin-top:18px;padding:14px;"><span style="display:block;color:#52635b;font-size:12px;">Cupom publicado na oferta</span><strong style="display:block;font-family:monospace;font-size:20px;letter-spacing:1px;margin-top:4px;">${safeCouponCode}</strong></div>` : ""}
        ${offerUrl ? `<a href="${offerUrl}" style="background:#0d6b4f;border-radius:8px;color:#ffffff;display:inline-block;font-weight:800;margin-top:20px;padding:12px 18px;text-decoration:none;">Ver melhor oferta</a>` : ""}
        <p style="margin-top:22px;font-size:13px;color:#52635b;">Confira a oferta antes da compra. A loja pode alterar preço, cupom e disponibilidade a qualquer momento.</p>
      </div>
    `
  });
  return { delivered: true };
}

module.exports = {
  emailConfigured,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendGoalReachedEmail,
  sendLimitAlertEmail,
  sendProductGoalAlertEmail
};
