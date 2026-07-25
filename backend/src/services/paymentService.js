const { MercadoPagoConfig, Payment, WebhookSignatureValidator } = require("mercadopago");
const { PLUS_PRICE } = require("../utils/subscription");

function accessToken() {
  return String(process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
}

function publicKey() {
  return String(process.env.MERCADO_PAGO_PUBLIC_KEY || "").trim();
}

function webhookSecret() {
  return String(process.env.MERCADO_PAGO_WEBHOOK_SECRET || "").trim();
}

function paymentConfigured() {
  return Boolean(accessToken() && publicKey());
}

function paymentClient() {
  if (!accessToken()) {
    const error = new Error("Os pagamentos ainda não foram configurados.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  return new Payment(new MercadoPagoConfig({ accessToken: accessToken(), options: { timeout: 12000 } }));
}

function notificationUrl() {
  return String(
    process.env.PAYMENTS_WEBHOOK_URL || "https://api.betterway.com.br/api/billing/webhook"
  ).trim();
}

function providerError(error) {
  const status = Number(error?.status || error?.response?.status || 502);
  const detail = error?.cause?.[0]?.description || error?.message || "Falha ao processar o pagamento.";
  const normalizedDetail = String(detail).slice(0, 220);
  const friendlyDetail = /financial identity use case/i.test(normalizedDetail)
    ? "As credenciais do Mercado Pago parecem pertencer a uma aplicação de Identidade Financeira. Crie ou selecione uma aplicação de Pagamentos online/Checkout e atualize Public Key e Access Token na Vercel."
    : normalizedDetail;
  const mapped = new Error(status >= 500 ? "O provedor de pagamento está indisponível. Tente novamente." : friendlyDetail);
  mapped.status = status >= 400 && status < 500 ? 422 : 502;
  mapped.expose = true;
  return mapped;
}

function commonBody({ user, cpf, method }) {
  return {
    transaction_amount: PLUS_PRICE,
    description: "BW Plus - acesso por 30 dias",
    external_reference: `bw-plus:${user.id}`,
    notification_url: notificationUrl(),
    statement_descriptor: "BETTER WAY",
    metadata: {
      user_id: String(user.id),
      plan: "plus_30_days",
      method
    },
    payer: {
      email: user.email,
      first_name: String(user.name || "Cliente").split(/\s+/)[0].slice(0, 80),
      identification: { type: "CPF", number: cpf }
    },
    additional_info: {
      items: [{
        id: "bw-plus-30",
        title: "BW Plus por 30 dias",
        description: "Alertas, produtos, relatórios e simulador completo",
        category_id: "services",
        quantity: 1,
        unit_price: PLUS_PRICE
      }]
    }
  };
}

async function createPix({ user, cpf, idempotencyKey }) {
  const body = {
    ...commonBody({ user, cpf, method: "pix" }),
    payment_method_id: "pix",
    date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
  try {
    return await paymentClient().create({ body, requestOptions: { idempotencyKey } });
  } catch (error) {
    throw providerError(error);
  }
}

async function createCard({ user, cpf, idempotencyKey, formData }) {
  const token = String(formData?.token || "");
  const paymentMethodId = String(formData?.payment_method_id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  const issuerId = Number(formData?.issuer_id);
  if (!token || token.length > 4096 || !paymentMethodId) {
    const error = new Error("Os dados tokenizados do cartão estão incompletos.");
    error.status = 400;
    error.expose = true;
    throw error;
  }

  const body = {
    ...commonBody({ user, cpf, method: "card" }),
    token,
    payment_method_id: paymentMethodId,
    installments: 1,
    binary_mode: false,
    ...(Number.isFinite(issuerId) && issuerId > 0 ? { issuer_id: issuerId } : {})
  };
  try {
    return await paymentClient().create({ body, requestOptions: { idempotencyKey } });
  } catch (error) {
    throw providerError(error);
  }
}

async function getProviderPayment(paymentId) {
  try {
    return await paymentClient().get({ id: String(paymentId) });
  } catch (error) {
    throw providerError(error);
  }
}

function validateWebhook({ xSignature, xRequestId, dataId }) {
  const secret = webhookSecret();
  if (!secret) {
    const error = new Error("A assinatura dos webhooks de pagamento não foi configurada.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
      toleranceSeconds: 600
    });
  } catch {
    const error = new Error("Assinatura de webhook inválida.");
    error.status = 401;
    error.expose = true;
    throw error;
  }
}

module.exports = {
  createCard,
  createPix,
  getProviderPayment,
  paymentConfigured,
  publicKey,
  validateWebhook
};
