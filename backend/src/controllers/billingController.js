const crypto = require("node:crypto");
const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const paymentService = require("../services/paymentService");
const { cpfIdentity, cpfMatches, normalizeCpf } = require("../utils/cpf");
const {
  PLUS_FEATURES,
  PLUS_PERIOD_DAYS,
  PLUS_PRICE,
  nextPlusPeriod,
  subscriptionState
} = require("../utils/subscription");

function publicPayment(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    providerPaymentId: payment.providerPaymentId || "",
    method: payment.method,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    statusDetail: payment.statusDetail || "",
    accessGrantedAt: payment.accessGrantedAt || null,
    expiresAt: payment.expiresAt || null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

function paymentSummary(providerPayment) {
  const transactionData = providerPayment?.point_of_interaction?.transaction_data || {};
  return {
    providerPaymentId: String(providerPayment?.id || ""),
    status: String(providerPayment?.status || "pending"),
    statusDetail: String(providerPayment?.status_detail || "").slice(0, 160),
    expiresAt: providerPayment?.date_of_expiration || null,
    pix: transactionData.qr_code || transactionData.qr_code_base64
      ? {
          code: transactionData.qr_code || "",
          qrCodeBase64: transactionData.qr_code_base64 || "",
          ticketUrl: transactionData.ticket_url || ""
        }
      : null
  };
}

function requestIdempotencyKey(req) {
  const provided = String(req.get("x-idempotency-key") || "").trim();
  const requestKey = /^[a-zA-Z0-9:_-]{8,100}$/.test(provided) ? provided : crypto.randomUUID();
  return crypto
    .createHash("sha256")
    .update(`${req.user.id}:${requestKey}`)
    .digest("hex");
}

function providerBelongsToUser(providerPayment, userId) {
  const expectedUserId = String(userId || "");
  return Boolean(
    expectedUserId &&
    String(providerPayment?.metadata?.user_id || "") === expectedUserId &&
    String(providerPayment?.external_reference || "") === `bw-plus:${expectedUserId}`
  );
}

async function ensureCpf(userId, value) {
  const identity = cpfIdentity(value);
  if (!identity) {
    const error = new Error("Informe um CPF válido para o titular do pagamento.");
    error.status = 400;
    error.expose = true;
    throw error;
  }
  const privateUser = await repository.findUserById(userId, true);
  if (!privateUser) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    error.expose = true;
    throw error;
  }
  if (privateUser.cpfHash && !cpfMatches(value, privateUser.cpfHash)) {
    const error = new Error(`O CPF do pagamento deve terminar em ${privateUser.cpfLast4 || "****"}, como o CPF da conta.`);
    error.status = 403;
    error.code = "CPF_MISMATCH";
    error.expose = true;
    throw error;
  }
  if (!privateUser.cpfHash) {
    await repository.updateUser(userId, { cpfHash: identity.hash, cpfLast4: identity.last4 });
  }
  return { user: privateUser, cpf: normalizeCpf(value) };
}

async function grantApprovedPayment(localPayment, providerPayment) {
  if (!localPayment || localPayment.accessGrantedAt || providerPayment?.status !== "approved") return localPayment;
  const amountMatches = Math.abs(Number(providerPayment.transaction_amount || 0) - PLUS_PRICE) < 0.001;
  const metadataMatches = providerPayment?.metadata?.plan === "plus_30_days";
  const currencyMatches = String(providerPayment?.currency_id || "") === "BRL";
  const ownerMatches = providerBelongsToUser(providerPayment, localPayment.userId);
  if (!amountMatches || !metadataMatches || !currencyMatches || !ownerMatches) return localPayment;

  const user = await repository.findUserById(localPayment.userId, true);
  if (!user) return localPayment;
  const now = new Date();
  const claimedPayment = await repository.claimPaymentAccess(localPayment.id, now);
  if (!claimedPayment) return repository.findPaymentByProviderId(providerPayment.id);
  const subscription = {
    ...nextPlusPeriod(user, { source: "mercadopago", now }),
    latestPaymentId: String(providerPayment.id),
    latestPaymentStatus: "approved"
  };
  try {
    await repository.updateUser(user.id, { subscription });
    return claimedPayment;
  } catch (error) {
    await repository.releasePaymentAccess(localPayment.id, now);
    throw error;
  }
}

async function reconcileProviderPayment(providerPayment, localPayment = null) {
  const providerPaymentId = String(providerPayment?.id || "");
  let payment = localPayment || await repository.findPaymentByProviderId(providerPaymentId);
  if (!payment) {
    const userId = String(providerPayment?.metadata?.user_id || "");
    const user = userId ? await repository.findUserById(userId) : null;
    if (!user || !providerBelongsToUser(providerPayment, userId)) return null;
    payment = await repository.createPayment({
      userId,
      providerPaymentId,
      idempotencyKey: `webhook:${providerPaymentId}`,
      method: providerPayment.payment_method_id === "pix" ? "pix" : "card",
      amount: PLUS_PRICE,
      status: "created"
    });
  }
  const summary = paymentSummary(providerPayment);
  payment = await repository.updatePayment(payment.id, summary);
  payment = await grantApprovedPayment(payment, providerPayment);
  return payment;
}

const overview = asyncHandler(async (req, res) => {
  const payments = await repository.listPayments(req.user.id, 12);
  return res.json({
    plan: {
      id: "plus",
      name: "BW Plus",
      price: PLUS_PRICE,
      currency: "BRL",
      periodDays: PLUS_PERIOD_DAYS,
      autoRenew: false,
      features: Object.entries(PLUS_FEATURES).map(([id, label]) => ({ id, label }))
    },
    subscription: subscriptionState(req.user),
    payments: payments.map(publicPayment),
    checkout: {
      provider: "mercadopago",
      configured: paymentService.paymentConfigured(),
      publicKey: paymentService.paymentConfigured() ? paymentService.publicKey() : ""
    }
  });
});

const startTrial = asyncHandler(async (req, res) => {
  const user = await repository.findUserById(req.user.id, true);
  const current = subscriptionState(user);
  if (current.hasPlus) {
    return res.status(409).json({ code: "PLUS_ALREADY_ACTIVE", message: "Seu BW Plus já está ativo." });
  }
  if (!current.trialPromotionActive) {
    return res.status(409).json({
      code: "TRIAL_PROMOTION_ENDED",
      message: `A promoção de 30 dias grátis terminou em ${current.trialPromotionLabel}.`
    });
  }
  if (!current.trialAvailable) {
    return res.status(409).json({ code: "TRIAL_ALREADY_USED", message: "O período gratuito desta conta já foi utilizado." });
  }
  const subscription = nextPlusPeriod(user, { source: "trial" });
  const updated = await repository.updateUser(user.id, { subscription });
  return res.status(201).json({ subscription: subscriptionState(updated) });
});

async function existingProviderPayment(idempotencyKey) {
  const existing = await repository.findPaymentByIdempotencyKey(idempotencyKey);
  if (!existing?.providerPaymentId) return null;
  const provider = await paymentService.getProviderPayment(existing.providerPaymentId);
  const payment = await reconcileProviderPayment(provider, existing);
  return { payment, provider };
}

const createPixPayment = asyncHandler(async (req, res) => {
  const idempotencyKey = requestIdempotencyKey(req);
  const repeated = await existingProviderPayment(idempotencyKey);
  if (repeated) {
    return res.json({ payment: publicPayment(repeated.payment), ...paymentSummary(repeated.provider) });
  }
  const { user, cpf } = await ensureCpf(req.user.id, req.body.cpf);
  let local = await repository.createPayment({
    userId: user.id,
    idempotencyKey,
    method: "pix",
    amount: PLUS_PRICE,
    status: "created"
  });
  try {
    const provider = await paymentService.createPix({ user, cpf, idempotencyKey });
    local = await reconcileProviderPayment(provider, local);
    return res.status(201).json({ payment: publicPayment(local), ...paymentSummary(provider) });
  } catch (error) {
    await repository.updatePayment(local.id, { status: "failed", statusDetail: "provider_error" });
    throw error;
  }
});

const createCardPayment = asyncHandler(async (req, res) => {
  const idempotencyKey = requestIdempotencyKey(req);
  const repeated = await existingProviderPayment(idempotencyKey);
  if (repeated) {
    return res.json({ payment: publicPayment(repeated.payment), ...paymentSummary(repeated.provider) });
  }
  const cpf = req.body?.payer?.identification?.number;
  const { user, cpf: normalizedCpf } = await ensureCpf(req.user.id, cpf);
  let local = await repository.createPayment({
    userId: user.id,
    idempotencyKey,
    method: "card",
    amount: PLUS_PRICE,
    status: "created"
  });
  try {
    const provider = await paymentService.createCard({
      user,
      cpf: normalizedCpf,
      idempotencyKey,
      formData: req.body
    });
    local = await reconcileProviderPayment(provider, local);
    return res.status(201).json({ payment: publicPayment(local), ...paymentSummary(provider) });
  } catch (error) {
    await repository.updatePayment(local.id, { status: "failed", statusDetail: "provider_error" });
    throw error;
  }
});

const paymentStatus = asyncHandler(async (req, res) => {
  const local = await repository.findPaymentForUser(req.user.id, req.params.id);
  if (!local) return res.status(404).json({ message: "Pagamento não encontrado." });
  if (!local.providerPaymentId) return res.json({ payment: publicPayment(local) });
  const provider = await paymentService.getProviderPayment(local.providerPaymentId);
  const payment = await reconcileProviderPayment(provider, local);
  return res.json({ payment: publicPayment(payment), ...paymentSummary(provider) });
});

const webhook = asyncHandler(async (req, res) => {
  const dataId = String(req.query["data.id"] || req.body?.data?.id || "");
  paymentService.validateWebhook({
    xSignature: req.get("x-signature"),
    xRequestId: req.get("x-request-id"),
    dataId
  });
  if (dataId && (req.body?.type === "payment" || req.query.type === "payment")) {
    const provider = await paymentService.getProviderPayment(dataId);
    await reconcileProviderPayment(provider);
  }
  return res.status(200).json({ received: true });
});

module.exports = {
  createCardPayment,
  createPixPayment,
  overview,
  paymentStatus,
  startTrial,
  webhook
};
