const { PluggyClient } = require("pluggy-sdk");

function providerConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

function client() {
  if (!providerConfigured()) {
    const error = new Error("A conexão Open Finance ainda não foi configurada no servidor.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  return new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET
  });
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccount(account) {
  return {
    externalId: account.id,
    name: account.marketingName || account.name || "Conta bancária",
    type: account.type || "BANK",
    subtype: account.subtype || "",
    balance: asNumber(account.balance),
    currencyCode: account.currencyCode || "BRL"
  };
}

function normalizeInvestment(investment) {
  return {
    externalId: investment.id,
    name: investment.name || investment.code || "Investimento",
    code: investment.code || investment.isin || "",
    type: investment.type || "OTHER",
    subtype: investment.subtype || "",
    balance: asNumber(
      investment.balance ?? investment.amountWithdrawal ?? investment.amount ??
        asNumber(investment.value) * asNumber(investment.quantity)
    ),
    quantity: asNumber(investment.quantity),
    unitValue: asNumber(investment.value),
    amountProfit: asNumber(investment.amountProfit),
    currencyCode: investment.currencyCode || "BRL"
  };
}

function normalizeTransaction(transaction) {
  return {
    externalId: transaction.id,
    accountExternalId: transaction.accountId,
    description: String(transaction.description || transaction.descriptionRaw || "Movimentação bancária").slice(0, 240),
    amount: asNumber(transaction.amountInAccountCurrency ?? transaction.amount),
    balance: asNumber(transaction.balance),
    date: transaction.date || new Date().toISOString(),
    type: transaction.type || "OTHER",
    category: transaction.category || "",
    status: transaction.status || "POSTED",
    currencyCode: transaction.currencyCode || "BRL"
  };
}

function transactionWindowStart() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 90);
  return date.toISOString().slice(0, 10);
}

async function createConnectToken(userId) {
  const candidate = process.env.APP_WEB_URL || String(process.env.CLIENT_URL || "").split(",")[0] || "http://localhost:5173";
  let appUrl;
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
    appUrl = parsed.origin;
  } catch {
    const error = new Error("A URL pública do aplicativo está configurada incorretamente.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  const result = await client().createConnectToken(undefined, {
    clientUserId: String(userId),
    avoidDuplicates: true,
    oauthRedirectUri: `${appUrl.replace(/\/$/, "")}/perfil`
  });
  return result.accessToken;
}

async function fetchSnapshot(itemId, expectedUserId) {
  const pluggy = client();
  const item = await pluggy.fetchItem(itemId);
  if (expectedUserId && String(item.clientUserId || "") !== String(expectedUserId)) {
    const error = new Error("Esta conexão bancária não pertence ao usuário autenticado.");
    error.status = 403;
    throw error;
  }
  const [accountResult, investmentResult] = await Promise.allSettled([
    pluggy.fetchAccounts(itemId),
    pluggy.fetchInvestments(itemId)
  ]);
  if (accountResult.status === "rejected" && investmentResult.status === "rejected") {
    throw accountResult.reason;
  }
  const rawAccounts = accountResult.status === "fulfilled"
    ? (accountResult.value.results || []).filter((account) => account.type === "BANK")
    : [];
  const accounts = rawAccounts.map(normalizeAccount);
  const investments = investmentResult.status === "fulfilled"
    ? (investmentResult.value.results || []).map(normalizeInvestment)
    : [];
  const transactionResults = await Promise.allSettled(
    rawAccounts.map((account) => pluggy.fetchAllTransactions(account.id, { dateFrom: transactionWindowStart() }))
  );
  const transactions = transactionResults
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .map(normalizeTransaction)
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 500);

  return {
    externalId: itemId,
    label: item.connector?.name || "Instituição conectada",
    institutionName: item.connector?.name || "",
    accounts,
    investments,
    transactions,
    lastSyncedAt: new Date().toISOString()
  };
}

async function deleteItem(itemId) {
  await client().deleteItem(itemId);
}

module.exports = {
  providerConfigured,
  createConnectToken,
  fetchSnapshot,
  deleteItem
};
