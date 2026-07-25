const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const axios = require("axios");

const paymentService = require("../src/services/paymentService");
const {
  nextPlusPeriod,
  subscriptionState
} = require("../src/utils/subscription");

test("expira o Plus sem renovação automática", () => {
  const start = new Date("2026-07-01T12:00:00.000Z");
  const subscription = nextPlusPeriod({}, { source: "trial", now: start, days: 30 });
  assert.equal(subscription.autoRenew, false);
  assert.equal(subscriptionState({ subscription }, new Date("2026-07-31T11:59:59.000Z")).hasPlus, true);
  assert.equal(subscriptionState({ subscription }, new Date("2026-07-31T12:00:01.000Z")).hasPlus, false);
  assert.equal(subscriptionState({ subscription }, new Date("2026-07-31T12:00:01.000Z")).status, "expired");
});

test("valida a assinatura oficial do webhook do Mercado Pago", () => {
  const previousSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const secret = "mercado-pago-webhook-test-secret";
  const dataId = "987654321";
  const requestId = "request-bw-123";
  const timestamp = String(Date.now());
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;

  try {
    assert.doesNotThrow(() => paymentService.validateWebhook({
      xSignature: `ts=${timestamp},v1=${signature}`,
      xRequestId: requestId,
      dataId
    }));
    assert.throws(
      () => paymentService.validateWebhook({
        xSignature: `ts=${timestamp},v1=${"0".repeat(64)}`,
        xRequestId: requestId,
        dataId
      }),
      (error) => error.status === 401 && error.message === "Assinatura de webhook inválida."
    );
  } finally {
    if (previousSecret === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    else process.env.MERCADO_PAGO_WEBHOOK_SECRET = previousSecret;
  }
});

test("gera alertas e relatórios sem expor dados e com link HTTPS da oferta", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  const originalPost = axios.post;
  const deliveries = [];
  process.env.RESEND_API_KEY = "re_test_betterway";
  process.env.EMAIL_FROM = "BW <no-reply@mail.betterway.com.br>";
  axios.post = async (url, body, config) => {
    deliveries.push({ url, body, config });
    return { status: 200, data: { id: `email-${deliveries.length}` } };
  };

  delete require.cache[require.resolve("../src/services/emailService")];
  const {
    sendFinancialReportEmail,
    sendProductGoalAlertEmail
  } = require("../src/services/emailService");

  try {
    const productResult = await sendProductGoalAlertEmail({
      email: "cliente@example.com",
      name: "Ana <script>",
      goalName: "Notebook & trabalho",
      currentAmount: 4200,
      reasons: ["price", "affordable"],
      product: {
        name: "Notebook <Aurora>",
        store: "Loja & Cia",
        currentPrice: 3999,
        targetPrice: 4100,
        lowestPrice: 3999,
        offerUrl: "https://loja.example.com/oferta?produto=aurora"
      }
    });
    assert.equal(productResult.delivered, true);
    assert.equal(deliveries[0].url, "https://api.resend.com/emails");
    assert.match(deliveries[0].body.html, /href="https:\/\/loja\.example\.com\/oferta\?produto=aurora"/);
    assert.match(deliveries[0].body.html, /Notebook &lt;Aurora&gt;/);
    assert.doesNotMatch(deliveries[0].body.html, /<script>/);

    const reportResult = await sendFinancialReportEmail({
      email: "cliente@example.com",
      name: "Ana",
      periodLabel: "01/07/2026 a 07/07/2026",
      frequency: "weekly",
      totals: { income: 2000, expenses: 900, investments: 300, balance: 800 },
      goals: [{ name: "Reserva", progress: 75 }]
    });
    assert.equal(reportResult.delivered, true);
    assert.match(deliveries[1].body.subject, /relatório semanal/i);
    assert.match(deliveries[1].body.html, /Reserva/);
    assert.equal(deliveries[1].config.headers.Authorization, "Bearer re_test_betterway");
  } finally {
    axios.post = originalPost;
    delete require.cache[require.resolve("../src/services/emailService")];
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
  }
});
