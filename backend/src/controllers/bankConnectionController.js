const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const pluggy = require("../services/pluggyService");
const { summarizeConnections } = require("../services/bankSummaryService");
const { processEvent } = require("./pluggyWebhookController");

function publicConnection(connection) {
  if (!connection) return null;
  const { __v, externalId, sourceFile, userId, ...safe } = connection;
  return {
    ...safe,
    accounts: (connection.accounts || []).map(({ externalId: accountExternalId, ...account }) => account),
    investments: (connection.investments || []).map(({ externalId: investmentExternalId, ...investment }) => investment),
    transactions: (connection.transactions || []).map(({ externalId: transactionExternalId, accountExternalId, ...transaction }) => transaction)
  };
}

function publicConnections(connections) {
  return connections.map(publicConnection);
}

function directConnections(connections) {
  return connections.filter((connection) => connection.provider === "pluggy");
}

async function syncPluggyItem(userId, itemId) {
  const snapshot = await pluggy.fetchSnapshot(itemId, userId);
  return repository.upsertBankConnection(userId, "pluggy", itemId, snapshot);
}

const list = asyncHandler(async (req, res) => {
  if (pluggy.providerConfigured()) {
    const pendingEvents = await repository.listPendingPluggyWebhooks();
    for (const event of pendingEvents) {
      try {
        await processEvent(event);
        await repository.completePluggyWebhook(event.eventId, "processed");
      } catch {
        break;
      }
    }
  }
  const connections = directConnections(await repository.listBankConnections(req.user.id));
  return res.json({
    providerConfigured: pluggy.providerConfigured(),
    providerEnvironment: pluggy.providerEnvironment(),
    connections: publicConnections(connections),
    totals: summarizeConnections(connections),
    methods: [{ id: "open_finance", available: pluggy.providerConfigured() }]
  });
});

const createConnectToken = asyncHandler(async (req, res) => {
  const connectToken = await pluggy.createConnectToken(req.user.id);
  return res.json({
    connectToken,
    accessToken: connectToken,
    providerEnvironment: pluggy.providerEnvironment()
  });
});

const syncPluggy = asyncHandler(async (req, res) => {
  const itemId = String(req.body.itemId || "").trim();
  if (!itemId || itemId.length > 200) return res.status(400).json({ message: "A conexão bancária não informou um item válido." });
  const connection = await syncPluggyItem(req.user.id, itemId);
  const connections = directConnections(await repository.listBankConnections(req.user.id));
  return res.status(201).json({ connection: publicConnection(connection), totals: summarizeConnections(connections) });
});

const refresh = asyncHandler(async (req, res) => {
  const connections = await repository.listBankConnections(req.user.id);
  const connectedProviders = directConnections(connections);
  let refreshed = 0;
  let failed = 0;

  for (const connection of connectedProviders) {
    try {
      await syncPluggyItem(req.user.id, connection.externalId);
      refreshed += 1;
    } catch (error) {
      console.warn("Falha ao atualizar uma conexão Pluggy:", error.message);
      failed += 1;
    }
  }

  const updated = directConnections(await repository.listBankConnections(req.user.id));
  return res.json({
    connections: publicConnections(updated),
    totals: summarizeConnections(updated),
    refreshed,
    failed
  });
});

const remove = asyncHandler(async (req, res) => {
  const connection = await repository.findBankConnection(req.user.id, req.params.id);
  if (!connection) return res.status(404).json({ message: "Conexão financeira não encontrada." });
  if (connection.provider === "pluggy") await pluggy.deleteItem(connection.externalId);
  await repository.deleteBankConnection(req.user.id, connection.id);
  return res.status(204).send();
});

module.exports = {
  list,
  createConnectToken,
  syncPluggy,
  refresh,
  remove
};
