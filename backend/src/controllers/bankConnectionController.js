const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const pluggy = require("../services/pluggyService");
const { parseStatement } = require("../services/statementImportService");
const { summarizeConnections } = require("../services/bankSummaryService");

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

async function syncPluggyItem(userId, itemId) {
  const snapshot = await pluggy.fetchSnapshot(itemId, userId);
  return repository.upsertBankConnection(userId, "pluggy", itemId, snapshot);
}

const list = asyncHandler(async (req, res) => {
  const connections = await repository.listBankConnections(req.user.id);
  return res.json({
    providerConfigured: pluggy.providerConfigured(),
    connections: publicConnections(connections),
    totals: summarizeConnections(connections),
    methods: [
      { id: "open_finance", available: pluggy.providerConfigured() },
      { id: "statement_import", available: true }
    ]
  });
});

const createConnectToken = asyncHandler(async (req, res) => {
  const connectToken = await pluggy.createConnectToken(req.user.id);
  return res.json({ connectToken });
});

const syncPluggy = asyncHandler(async (req, res) => {
  const itemId = String(req.body.itemId || "").trim();
  if (!itemId || itemId.length > 200) return res.status(400).json({ message: "A conexão bancária não informou um item válido." });
  const connection = await syncPluggyItem(req.user.id, itemId);
  const connections = await repository.listBankConnections(req.user.id);
  return res.status(201).json({ connection: publicConnection(connection), totals: summarizeConnections(connections) });
});

const refresh = asyncHandler(async (req, res) => {
  const connections = await repository.listBankConnections(req.user.id);
  const directConnections = connections.filter((connection) => connection.provider === "pluggy");
  let refreshed = 0;
  let failed = 0;

  for (const connection of directConnections) {
    try {
      await syncPluggyItem(req.user.id, connection.externalId);
      refreshed += 1;
    } catch (error) {
      console.warn("Falha ao atualizar uma conexão Pluggy:", error.message);
      failed += 1;
    }
  }

  const updated = await repository.listBankConnections(req.user.id);
  return res.json({
    connections: publicConnections(updated),
    totals: summarizeConnections(updated),
    refreshed,
    failed
  });
});

const importStatement = asyncHandler(async (req, res) => {
  const snapshot = parseStatement(req.body.content, {
    accountName: req.body.accountName,
    institutionName: req.body.institutionName,
    openingBalance: req.body.openingBalance,
    fileName: req.body.fileName,
    format: req.body.format
  });
  const connection = await repository.upsertBankConnection(
    req.user.id,
    "statement_import",
    snapshot.externalId,
    snapshot
  );
  const connections = await repository.listBankConnections(req.user.id);
  return res.status(201).json({
    connection: publicConnection(connection),
    totals: summarizeConnections(connections),
    recordCount: snapshot.recordCount,
    detectedFormat: snapshot.detectedFormat
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
  importStatement,
  remove
};
