const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const storePath = path.join(os.tmpdir(), `betterway-security-${process.pid}.json`);
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-at-least-thirty-two-characters";
process.env.LOCAL_STORE_PATH = storePath;
delete process.env.VERCEL;
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;
delete process.env.CLIENT_URL;
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.RESEND_API_KEY;
delete process.env.PLUGGY_CLIENT_ID;
delete process.env.PLUGGY_CLIENT_SECRET;
delete process.env.BANK_CONNECTIONS_ENABLED;
process.env.PLUGGY_WEBHOOK_SECRET = "pluggy-test-webhook-secret";
process.env.ADMIN_API_KEY = "betterway-admin-test-key-with-32-chars";
process.env.PLUS_TRIAL_PROMOTION_END_AT = "2099-09-01T02:59:59.999Z";
delete process.env.GOOGLE_CLIENT_ID;

const app = require("../src/app");
const repository = require("../src/services/repository");
const paymentService = require("../src/services/paymentService");

async function startServer() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}/api` };
}

async function api(baseUrl, pathname, { token, body, method = "GET", rawBody, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null, headers: response.headers };
}

async function createVerifiedUser(baseUrl, suffix, overrides = {}) {
  const email = `security-${suffix}-${Date.now()}@example.com`;
  const username = `sec_${suffix}_${Date.now().toString().slice(-10)}`;
  const password = "StrongPass123";
  const registration = await api(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      name: `Usuário ${suffix}`,
      username,
      email,
      cpf: "529.982.247-25",
      password,
      confirmPassword: password,
      salary: 2000,
      monthlyLimit: 1000,
      workHoursPerDay: 8,
      ...overrides
    }
  });
  assert.equal(registration.status, 201);
  assert.match(registration.data.devVerificationToken, /^\d{8}$/);
  const verification = await api(baseUrl, "/auth/verify-email", {
    method: "POST",
    body: { email, token: registration.data.devVerificationToken }
  });
  assert.equal(verification.status, 200);
  return {
    email,
    username: verification.data.user.username,
    password,
    token: verification.data.token,
    user: verification.data.user
  };
}

test("protege contas, compartilhamentos e dados financeiros de ponta a ponta", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(async () => {
    delete process.env.BANK_CONNECTIONS_ENABLED;
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(storePath, { force: true });
  });

  const weakPassword = await api(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      name: "Senha fraca",
      username: `weak_${Date.now().toString().slice(-10)}`,
      email: `weak-${Date.now()}@example.com`,
      password: "1234567",
      confirmPassword: "1234567"
    }
  });
  assert.equal(weakPassword.status, 400);

  const oversizedPassword = "é".repeat(37);
  const oversizedPasswordResult = await api(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      name: "Senha extensa",
      username: `long_${Date.now().toString().slice(-10)}`,
      email: `long-${Date.now()}@example.com`,
      password: oversizedPassword,
      confirmPassword: oversizedPassword
    }
  });
  assert.equal(oversizedPasswordResult.status, 400);

  const availableUsername = `avail_${Date.now().toString().slice(-10)}`;
  const availableBeforeRegistration = await api(
    baseUrl,
    `/auth/username-availability?username=${encodeURIComponent(availableUsername)}`
  );
  assert.equal(availableBeforeRegistration.status, 200);
  assert.equal(availableBeforeRegistration.data.valid, true);
  assert.equal(availableBeforeRegistration.data.available, true);

  const invalidUsernameAvailability = await api(baseUrl, "/auth/username-availability?username=admin");
  assert.equal(invalidUsernameAvailability.status, 200);
  assert.equal(invalidUsernameAvailability.data.valid, false);
  assert.equal(invalidUsernameAvailability.data.available, false);

  const authProviders = await api(baseUrl, "/auth/providers");
  assert.equal(authProviders.status, 200);
  assert.deepEqual(authProviders.data, { google: false });
  const googleWithoutProvider = await api(baseUrl, "/auth/google", {
    method: "POST",
    body: { credential: "untrusted-token" }
  });
  assert.equal(googleWithoutProvider.status, 503);
  assert.equal(googleWithoutProvider.data.credential, undefined);

  const userA = await createVerifiedUser(baseUrl, "a", { username: availableUsername });
  assert.equal(userA.user.cpfConfigured, true);
  assert.equal(userA.user.cpfLast4, "4725");
  assert.equal(userA.user.cpfHash, undefined);
  const availableAfterRegistration = await api(
    baseUrl,
    `/auth/username-availability?username=${encodeURIComponent(availableUsername.toUpperCase())}`
  );
  assert.equal(availableAfterRegistration.status, 200);
  assert.equal(availableAfterRegistration.data.valid, true);
  assert.equal(availableAfterRegistration.data.available, false);

  const userB = await createVerifiedUser(baseUrl, "b");

  const lockedProductSearch = await api(baseUrl, "/goals/product/search", {
    method: "POST",
    token: userB.token,
    body: { query: "notebook" }
  });
  assert.equal(lockedProductSearch.status, 402);
  assert.equal(lockedProductSearch.data.code, "PLUS_REQUIRED");

  const lockedProductGoal = await api(baseUrl, "/goals", {
    method: "POST",
    token: userB.token,
    body: {
      name: "Notebook",
      currentAmount: 0,
      dueDate: "2030-12-20",
      product: { url: "https://example.com/notebook", targetPrice: 3000 }
    }
  });
  assert.equal(lockedProductGoal.status, 402);
  assert.equal(lockedProductGoal.data.code, "PLUS_REQUIRED");

  const lockedReport = await api(baseUrl, "/reports/preview?frequency=monthly", { token: userB.token });
  assert.equal(lockedReport.status, 402);
  assert.equal(lockedReport.data.code, "PLUS_REQUIRED");

  const unauthorizedGrant = await api(baseUrl, "/admin/plus-grants", {
    method: "POST",
    body: { email: userB.email, days: 45 }
  });
  assert.equal(unauthorizedGrant.status, 401);

  const grantedByAdmin = await api(baseUrl, "/admin/plus-grants", {
    method: "POST",
    headers: { "X-Admin-Key": process.env.ADMIN_API_KEY },
    body: { email: userB.email, days: 45 }
  });
  assert.equal(grantedByAdmin.status, 200);
  assert.equal(grantedByAdmin.data.subscription.hasPlus, true);
  assert.equal(grantedByAdmin.data.subscription.source, "admin");

  const revokedByAdmin = await api(baseUrl, `/admin/plus-grants/${encodeURIComponent(userB.email)}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": process.env.ADMIN_API_KEY }
  });
  assert.equal(revokedByAdmin.status, 200);
  assert.equal(revokedByAdmin.data.subscription.hasPlus, false);

  const originalValidateWebhook = paymentService.validateWebhook;
  const originalGetProviderPayment = paymentService.getProviderPayment;
  const providerPayments = new Map();
  paymentService.validateWebhook = () => undefined;
  paymentService.getProviderPayment = async (paymentId) => providerPayments.get(String(paymentId));
  try {
    const approvedPaymentId = `mp-approved-${Date.now()}`;
    providerPayments.set(approvedPaymentId, {
      id: approvedPaymentId,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 7.9,
      currency_id: "BRL",
      payment_method_id: "pix",
      external_reference: `bw-plus:${userB.user.id}`,
      metadata: { user_id: userB.user.id, plan: "plus_30_days" }
    });

    const approvedWebhook = await api(baseUrl, `/billing/webhook?type=payment&data.id=${approvedPaymentId}`, {
      method: "POST",
      body: { type: "payment", data: { id: approvedPaymentId } }
    });
    assert.equal(approvedWebhook.status, 200);

    const afterApprovedPayment = await api(baseUrl, "/auth/me", { token: userB.token });
    assert.equal(afterApprovedPayment.data.user.subscription.hasPlus, true);
    assert.equal(afterApprovedPayment.data.user.subscription.source, "mercadopago");
    const firstPaymentEnd = afterApprovedPayment.data.user.subscription.currentPeriodEnd;

    const duplicateWebhook = await api(baseUrl, `/billing/webhook?type=payment&data.id=${approvedPaymentId}`, {
      method: "POST",
      body: { type: "payment", data: { id: approvedPaymentId } }
    });
    assert.equal(duplicateWebhook.status, 200);
    const afterDuplicatePayment = await api(baseUrl, "/auth/me", { token: userB.token });
    assert.equal(afterDuplicatePayment.data.user.subscription.currentPeriodEnd, firstPaymentEnd);

    await api(baseUrl, `/admin/plus-grants/${encodeURIComponent(userB.email)}`, {
      method: "DELETE",
      headers: { "X-Admin-Key": process.env.ADMIN_API_KEY }
    });

    const invalidAmountPaymentId = `mp-invalid-amount-${Date.now()}`;
    providerPayments.set(invalidAmountPaymentId, {
      id: invalidAmountPaymentId,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 79,
      currency_id: "BRL",
      payment_method_id: "pix",
      external_reference: `bw-plus:${userB.user.id}`,
      metadata: { user_id: userB.user.id, plan: "plus_30_days" }
    });
    const invalidAmountWebhook = await api(baseUrl, `/billing/webhook?type=payment&data.id=${invalidAmountPaymentId}`, {
      method: "POST",
      body: { type: "payment", data: { id: invalidAmountPaymentId } }
    });
    assert.equal(invalidAmountWebhook.status, 200);
    const afterInvalidAmount = await api(baseUrl, "/auth/me", { token: userB.token });
    assert.equal(afterInvalidAmount.data.user.subscription.hasPlus, false);
  } finally {
    paymentService.validateWebhook = originalValidateWebhook;
    paymentService.getProviderPayment = originalGetProviderPayment;
  }

  const decodedToken = jwt.decode(userA.token, { complete: true });
  assert.equal(decodedToken.header.alg, "HS256");
  assert.equal(decodedToken.payload.email, undefined);
  assert.ok(decodedToken.payload.sst);
  assert.equal(decodedToken.payload.exp - decodedToken.payload.sst, 15 * 24 * 60 * 60);

  const initialProfileProgress = await api(baseUrl, "/auth/profile-progress", { token: userA.token });
  assert.equal(initialProfileProgress.status, 200);
  assert.equal(initialProfileProgress.data.total, 6);
  assert.equal(initialProfileProgress.data.completed, 0);
  assert.equal(initialProfileProgress.data.percent, 0);
  assert.equal(initialProfileProgress.data.tasks.some((task) => task.id === "bank"), false);
  assert.equal(initialProfileProgress.data.tasks.some((task) => task.id === "tour" && !task.completed), true);
  assert.equal(initialProfileProgress.data.tasks.find((task) => task.id === "avatar").to, "/perfil?tab=conta&edit=avatar");

  const lockedSimulation = await api(baseUrl, "/simulator/compound", {
    method: "POST",
    token: userA.token,
    body: { initialAmount: 1000, recurringContribution: 100, annualRate: 12, months: 24 }
  });
  assert.equal(lockedSimulation.status, 402);
  assert.equal(lockedSimulation.data.code, "PLUS_REQUIRED");

  const lockedNotifications = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { notificationPreferences: { limitThreshold: 80 } }
  });
  assert.equal(lockedNotifications.status, 402);

  const freeDailyReminder = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { notificationPreferences: { dailyEntryReminder: false } }
  });
  assert.equal(freeDailyReminder.status, 200);
  assert.equal(freeDailyReminder.data.user.notificationPreferences.dailyEntryReminder, false);

  const restoredDailyReminder = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { notificationPreferences: { dailyEntryReminder: true } }
  });
  assert.equal(restoredDailyReminder.status, 200);
  assert.equal(restoredDailyReminder.data.user.notificationPreferences.dailyEntryReminder, true);

  const trial = await api(baseUrl, "/billing/trial", { method: "POST", token: userA.token });
  assert.equal(trial.status, 201);
  assert.equal(trial.data.subscription.hasPlus, true);
  assert.equal(trial.data.subscription.autoRenew, false);
  const secondTrial = await api(baseUrl, "/billing/trial", { method: "POST", token: userA.token });
  assert.equal(secondTrial.status, 409);

  const billingOverview = await api(baseUrl, "/billing/overview", { token: userA.token });
  assert.equal(billingOverview.status, 200);
  assert.equal(billingOverview.data.plan.price, 7.9);
  assert.equal(billingOverview.data.checkout.configured, false);
  assert.equal(billingOverview.data.checkout.publicKey, "");

  const plusSimulation = await api(baseUrl, "/simulator/compound", {
    method: "POST",
    token: userA.token,
    body: { initialAmount: 1000, recurringContribution: 100, annualRate: 12, months: 24 }
  });
  assert.equal(plusSimulation.status, 200);
  assert.ok(plusSimulation.data.projection.finalAmount > 0);
  assert.equal(plusSimulation.data.projection.series.length, 25);

  const reportPreview = await api(baseUrl, "/reports/preview?frequency=weekly", { token: userA.token });
  assert.equal(reportPreview.status, 200);
  assert.equal(reportPreview.data.report.frequency, "weekly");

  const paymentForAtomicGrant = await repository.createPayment({
    userId: userA.user.id,
    idempotencyKey: `atomic-${Date.now()}`,
    method: "pix",
    amount: 7.9,
    status: "approved"
  });
  const claimedAt = new Date();
  const concurrentClaims = await Promise.all([
    repository.claimPaymentAccess(paymentForAtomicGrant.id, claimedAt),
    repository.claimPaymentAccess(paymentForAtomicGrant.id, claimedAt)
  ]);
  assert.equal(concurrentClaims.filter(Boolean).length, 1);
  await repository.releasePaymentAccess(paymentForAtomicGrant.id, claimedAt);

  const mismatchedCpfPayment = await api(baseUrl, "/billing/payments/pix", {
    method: "POST",
    token: userA.token,
    body: { cpf: "111.444.777-35" }
  });
  assert.equal(mismatchedCpfPayment.status, 403);
  assert.equal(mismatchedCpfPayment.data.code, "CPF_MISMATCH");

  const invalidNotificationThreshold = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { notificationPreferences: { limitThreshold: 40 } }
  });
  assert.equal(invalidNotificationThreshold.status, 400);

  const notificationPreferences = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: {
      notificationPreferences: {
        emailEnabled: true,
        limitAlerts: true,
        goalAlerts: false,
        limitThreshold: 85
      }
    }
  });
  assert.equal(notificationPreferences.status, 200);
  assert.deepEqual(notificationPreferences.data.user.notificationPreferences, {
    dailyEntryReminder: true,
    emailEnabled: true,
    limitAlerts: true,
    goalAlerts: false,
    productAlerts: true,
    weeklyReports: false,
    monthlyReports: false,
    limitThreshold: 85,
    goalThreshold: 80
  });

  const completedSimulation = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { onboarding: { simulatedInvestment: true } }
  });
  assert.equal(completedSimulation.status, 200);
  const updatedProfileProgress = await api(baseUrl, "/auth/profile-progress", { token: userA.token });
  assert.equal(updatedProfileProgress.data.completed, 1);
  assert.equal(updatedProfileProgress.data.percent, 17);
  assert.equal(updatedProfileProgress.data.tasks.some((task) => task.id === "simulation" && task.completed), true);

  const lockedEmail = `locked-${Date.now()}@example.com`;
  const lockedRegistration = await api(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      name: "Código bloqueado",
      username: `locked_${Date.now().toString().slice(-10)}`,
      email: lockedEmail,
      cpf: "529.982.247-25",
      password: "StrongPass123",
      confirmPassword: "StrongPass123"
    }
  });
  assert.equal(lockedRegistration.status, 201);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrongCode = await api(baseUrl, "/auth/verify-email", {
      method: "POST",
      body: { email: lockedEmail, token: "00000000" }
    });
    assert.equal(wrongCode.status, 400);
  }
  const blockedCorrectCode = await api(baseUrl, "/auth/verify-email", {
    method: "POST",
    body: { email: lockedEmail, token: lockedRegistration.data.devVerificationToken }
  });
  assert.equal(blockedCorrectCode.status, 400);

  const duplicateUsername = await api(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      name: "Nome duplicado",
      username: userA.username.toUpperCase(),
      email: `duplicate-${Date.now()}@example.com`,
      cpf: "529.982.247-25",
      password: "StrongPass123",
      confirmPassword: "StrongPass123"
    }
  });
  assert.equal(duplicateUsername.status, 409);
  assert.equal(duplicateUsername.data.code, "USERNAME_EXISTS");

  const duplicateProfileUsername = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { username: userB.username }
  });
  assert.equal(duplicateProfileUsername.status, 409);

  const generatedAvatar = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userB.token,
    body: { avatarUrl: "julia" }
  });
  assert.equal(generatedAvatar.status, 200);
  assert.equal(generatedAvatar.data.user.avatarUrl, "julia");

  const request = await api(baseUrl, "/friends", {
    method: "POST",
    token: userA.token,
    body: { username: userB.username }
  });
  assert.equal(request.status, 202);
  assert.deepEqual(Object.keys(request.data.user).sort(), ["_id", "avatarUrl", "id", "name", "username"]);
  assert.equal(request.data.user.avatarUrl, "julia");

  const pendingForB = await api(baseUrl, "/friends", { token: userB.token });
  assert.equal(pendingForB.data.friends.length, 0);
  assert.equal(pendingForB.data.incomingRequests[0].username, userA.username);
  assert.equal(pendingForB.data.incomingRequests[0].email, undefined);

  const forbiddenShare = await api(baseUrl, "/shared-plans", {
    method: "POST",
    token: userA.token,
    body: {
      friendId: userB.user.id,
      kind: "goal",
      terms: { name: "Ainda sem amizade", targetAmount: 5000, dueDate: "2027-01-10" }
    }
  });
  assert.equal(forbiddenShare.status, 403);

  const accepted = await api(baseUrl, `/friends/${userA.user.id}/accept`, {
    method: "POST",
    token: userB.token
  });
  assert.equal(accepted.status, 200);

  const progressWithFriend = await api(baseUrl, "/auth/profile-progress", { token: userA.token });
  assert.equal(progressWithFriend.data.completed, 2);
  assert.equal(progressWithFriend.data.tasks.some((task) => task.id === "friend" && task.completed), true);

  const directSharedGoal = await api(baseUrl, "/goals", {
    method: "POST",
    token: userA.token,
    body: {
      name: "Reserva compartilhada",
      targetAmount: 5000,
      currentAmount: 100,
      dueDate: "2027-01-10",
      participantIds: [userB.user.id]
    }
  });
  assert.equal(directSharedGoal.status, 409);
  assert.equal(directSharedGoal.data.code, "SHARED_PLAN_REQUIRES_APPROVAL");

  const goalProposal = await api(baseUrl, "/shared-plans", {
    method: "POST",
    token: userA.token,
    body: {
      friendId: userB.user.id,
      kind: "goal",
      terms: { name: "Reserva compartilhada", targetAmount: 5000, currentAmount: 100, dueDate: "2027-01-10" }
    }
  });
  assert.equal(goalProposal.status, 201);
  assert.equal(goalProposal.data.proposal.status, "pending");

  const senderCannotAccept = await api(baseUrl, `/shared-plans/${goalProposal.data.proposal.id}/accept`, {
    method: "POST",
    token: userA.token
  });
  assert.equal(senderCannotAccept.status, 404);

  const counterProposal = await api(baseUrl, `/shared-plans/${goalProposal.data.proposal.id}/counter`, {
    method: "POST",
    token: userB.token,
    body: { terms: { name: "Reserva compartilhada", targetAmount: 5500, currentAmount: 125, dueDate: "2027-02-10" } }
  });
  assert.equal(counterProposal.status, 200);
  assert.equal(counterProposal.data.proposal.revision, 2);
  assert.equal(String(counterProposal.data.proposal.currentRecipientId), String(userA.user.id));

  const goalResult = await api(baseUrl, `/shared-plans/${goalProposal.data.proposal.id}/accept`, {
    method: "POST",
    token: userA.token
  });
  assert.equal(goalResult.status, 200);
  assert.equal(goalResult.data.proposal.status, "accepted");
  const goal = goalResult.data.resource;

  const limitProposal = await api(baseUrl, "/shared-plans", {
    method: "POST",
    token: userA.token,
    body: { friendId: userB.user.id, kind: "limit", terms: { category: "Lazer", amount: 350 } }
  });
  assert.equal(limitProposal.status, 201);
  const rejectedLimit = await api(baseUrl, `/shared-plans/${limitProposal.data.proposal.id}/reject`, {
    method: "POST",
    token: userB.token
  });
  assert.equal(rejectedLimit.status, 200);
  assert.equal(rejectedLimit.data.proposal.status, "rejected");

  const participantEdit = await api(baseUrl, `/goals/${goal.id}`, {
    method: "PUT",
    token: userB.token,
    body: { name: "Tomada indevida" }
  });
  assert.equal(participantEdit.status, 404);
  const participantDelete = await api(baseUrl, `/goals/${goal.id}`, {
    method: "DELETE",
    token: userB.token
  });
  assert.equal(participantDelete.status, 404);
  const participantMovement = await api(baseUrl, `/goals/${goal.id}/movements`, {
    method: "POST",
    token: userB.token,
    body: { type: "deposit", amount: 50, notes: "Aporte conjunto" }
  });
  assert.equal(participantMovement.status, 201);
  assert.equal(participantMovement.data.goal.currentAmount, 175);

  const removeFriend = await api(baseUrl, `/friends/${userB.user.id}`, {
    method: "DELETE",
    token: userA.token
  });
  assert.equal(removeFriend.status, 204);
  const revokedGoals = await api(baseUrl, "/goals", { token: userB.token });
  assert.equal(revokedGoals.data.goals.some((item) => item.id === goal.id), false);

  const income = await api(baseUrl, "/transactions", {
    method: "POST",
    token: userA.token,
    body: { title: "Salário", amount: 2000, type: "income", category: "Renda", date: "2026-07-01" }
  });
  assert.equal(income.status, 201);
  assert.equal(income.data.transaction.date.slice(0, 10), "2026-07-01");
  const expense = await api(baseUrl, "/transactions", {
    method: "POST",
    token: userA.token,
    body: { title: "Mercado", amount: 200, type: "expense", category: "Alimentacao", date: "2026-07-02" }
  });
  assert.equal(expense.status, 201);
  const investment = await api(baseUrl, "/transactions", {
    method: "POST",
    token: userA.token,
    body: { title: "Aporte", amount: 800, type: "expense", category: "Investimentos", date: "2026-07-03" }
  });
  assert.equal(investment.status, 201);

  const windowTransactions = await api(baseUrl, "/transactions?month=2026-07", { token: userA.token });
  assert.equal(windowTransactions.status, 200);
  assert.equal(windowTransactions.data.transactions.length, 3);
  const summary = await api(baseUrl, "/transactions/summary?month=2026-07", { token: userA.token });
  assert.equal(summary.status, 200);
  assert.equal(summary.data.widgets.expensesForLimit, 200);
  const isolated = await api(baseUrl, "/transactions?month=2026-07", { token: userB.token });
  assert.equal(isolated.data.transactions.length, 0);

  const resolved = await api(baseUrl, "/assets/resolve-investment", {
    method: "POST",
    token: userA.token,
    body: {
      transactionId: investment.data.transaction.id,
      splits: [{ ticker: "CDB-TESTE", name: "CDB de teste", type: "cdb", amount: 800 }]
    }
  });
  assert.equal(resolved.status, 201);
  const duplicateResolve = await api(baseUrl, "/assets/resolve-investment", {
    method: "POST",
    token: userA.token,
    body: {
      transactionId: investment.data.transaction.id,
      splits: [{ ticker: "CDB-TESTE", type: "cdb", amount: 800 }]
    }
  });
  assert.equal(duplicateResolve.status, 409);

  const oversizedSimulation = await api(baseUrl, "/simulator/compound", {
    method: "POST",
    token: userA.token,
    body: { initialAmount: 1000, recurringContribution: 100, annualRate: 12, months: 5000000 }
  });
  assert.equal(oversizedSimulation.status, 400);

  const invalidAvatar = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { avatarUrl: "https://tracker.example/avatar.png" }
  });
  assert.equal(invalidAvatar.status, 400);

  const passwordChange = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: userA.token,
    body: { currentPassword: userA.password, newPassword: "NewStrongPass123" }
  });
  assert.equal(passwordChange.status, 200);
  assert.ok(passwordChange.data.token);
  const revokedOldToken = await api(baseUrl, "/auth/me", { token: userA.token });
  assert.equal(revokedOldToken.status, 401);
  const validNewToken = await api(baseUrl, "/auth/me", { token: passwordChange.data.token });
  assert.equal(validNewToken.status, 200);
  const decodedChangedToken = jwt.decode(passwordChange.data.token);
  assert.equal(decodedChangedToken.sst, decodedToken.payload.sst);
  assert.equal(decodedChangedToken.exp, decodedToken.payload.exp);

  const emailWithoutPassword = await api(baseUrl, "/auth/me", {
    method: "PUT",
    token: passwordChange.data.token,
    body: { email: `changed-${Date.now()}@example.com` }
  });
  assert.equal(emailWithoutPassword.status, 400);

  const removedStatementImport = await api(baseUrl, "/bank-connections/import", {
    method: "POST",
    token: passwordChange.data.token,
    body: { content: "recurso removido" }
  });
  assert.equal(removedStatementImport.status, 404);

  await repository.upsertBankConnection(userA.user.id, "statement_import", "legacy-hidden", {
    label: "Importação antiga",
    accounts: [{ balance: 999 }],
    investments: [],
    transactions: []
  });

  const bankConnections = await api(baseUrl, "/bank-connections", { token: passwordChange.data.token });
  assert.equal(bankConnections.status, 200);
  assert.equal(bankConnections.data.providerConfigured, false);
  assert.equal(bankConnections.data.providerEnvironment, "trial");
  assert.equal(bankConnections.data.connections.length, 0);
  assert.deepEqual(bankConnections.data.methods, [
    { id: "open_finance", available: false },
    { id: "direct_api", available: true }
  ]);
  assert.ok(bankConnections.data.directBankCatalog.some((provider) => provider.id === "inter"));
  assert.equal(bankConnections.data.totals.accountBalance, 0);

  const disabledBankConnection = await api(baseUrl, "/bank-connections/direct/request", {
    method: "POST",
    token: passwordChange.data.token,
    body: {
      bankId: "inter",
      accountType: "business",
      scopes: ["balance"],
      acceptedReadOnlyTerms: true
    }
  });
  assert.equal(disabledBankConnection.status, 503);
  assert.equal(disabledBankConnection.data.code, "BANK_CONNECTIONS_COMING_SOON");
  process.env.BANK_CONNECTIONS_ENABLED = "true";

  const rejectedBankSecret = await api(baseUrl, "/bank-connections/direct/request", {
    method: "POST",
    token: passwordChange.data.token,
    body: {
      bankId: "inter",
      accountType: "business",
      scopes: ["balance", "transactions"],
      acceptedReadOnlyTerms: true,
      clientSecret: "segredo-que-nao-deve-ser-recebido"
    }
  });
  assert.equal(rejectedBankSecret.status, 400);
  assert.match(rejectedBankSecret.data.message, /Não envie senha, token, certificado ou segredo bancário/);

  const unsupportedAccountType = await api(baseUrl, "/bank-connections/direct/request", {
    method: "POST",
    token: passwordChange.data.token,
    body: {
      bankId: "inter",
      accountType: "personal",
      scopes: ["balance"],
      acceptedReadOnlyTerms: true
    }
  });
  assert.equal(unsupportedAccountType.status, 400);

  const directBankRequest = await api(baseUrl, "/bank-connections/direct/request", {
    method: "POST",
    token: passwordChange.data.token,
    body: {
      bankId: "inter",
      accountType: "business",
      scopes: ["balance", "transactions"],
      acceptedReadOnlyTerms: true
    }
  });
  assert.equal(directBankRequest.status, 201);
  assert.equal(directBankRequest.data.connection.provider, "direct_api");
  assert.equal(directBankRequest.data.connection.syncStatus, "pending");
  assert.equal(directBankRequest.data.connection.externalId, undefined);
  assert.equal(directBankRequest.data.connection.directConfig.accountType, "business");

  const bankConnectionsWithRequest = await api(baseUrl, "/bank-connections", { token: passwordChange.data.token });
  assert.equal(bankConnectionsWithRequest.status, 200);
  assert.equal(bankConnectionsWithRequest.data.connections.length, 1);
  assert.equal(bankConnectionsWithRequest.data.totals.netWorth, 0);

  const isolatedAfterDirectRequest = await api(baseUrl, "/bank-connections", { token: userB.token });
  assert.equal(isolatedAfterDirectRequest.status, 200);
  assert.equal(isolatedAfterDirectRequest.data.connections.length, 0);

  const isolatedBankConnections = await api(baseUrl, "/bank-connections", { token: userB.token });
  assert.equal(isolatedBankConnections.status, 200);
  assert.equal(isolatedBankConnections.data.connections.length, 0);
  assert.equal(isolatedBankConnections.data.totals.netWorth, 0);

  const connectTokenWithoutProvider = await api(baseUrl, "/bank-connections/pluggy/token", {
    method: "POST",
    token: passwordChange.data.token
  });
  assert.equal(connectTokenWithoutProvider.status, 503);
  assert.equal(connectTokenWithoutProvider.data.accessToken, undefined);
  assert.match(connectTokenWithoutProvider.data.message, /Open Finance ainda não foi configurada/);

  const unauthorizedWebhook = await api(baseUrl, "/bank-connections/pluggy/webhook", {
    method: "POST",
    body: { event: "item/updated", eventId: "event-unauthorized" }
  });
  assert.equal(unauthorizedWebhook.status, 401);
  const acceptedWebhook = await api(baseUrl, "/bank-connections/pluggy/webhook", {
    method: "POST",
    headers: { Authorization: "Bearer pluggy-test-webhook-secret" },
    body: { event: "item/updated", eventId: "event-accepted" }
  });
  assert.equal(acceptedWebhook.status, 202);
  assert.deepEqual(acceptedWebhook.data, { received: true });
  delete process.env.BANK_CONNECTIONS_ENABLED;

  const secondDeviceLogin = await api(baseUrl, "/auth/login", {
    method: "POST",
    body: { email: userB.email, password: userB.password }
  });
  assert.equal(secondDeviceLogin.status, 200);
  const firstDeviceAfterSecondLogin = await api(baseUrl, "/auth/me", { token: userB.token });
  assert.equal(firstDeviceAfterSecondLogin.status, 401);
  assert.match(firstDeviceAfterSecondLogin.data.message, /outro dispositivo/);
  const secondDeviceSession = await api(baseUrl, "/auth/me", { token: secondDeviceLogin.data.token });
  assert.equal(secondDeviceSession.status, 200);

  const malformedJson = await api(baseUrl, "/auth/login", {
    method: "POST",
    rawBody: "{not-json"
  });
  assert.equal(malformedJson.status, 400);
  assert.equal(malformedJson.data.message, "O corpo da requisição contém JSON inválido.");
  assert.match(summary.headers.get("cache-control"), /no-store/);
});
