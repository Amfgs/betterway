const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { getMarketCatalog, getQuotes } = require("../services/marketService");
const { asNumber } = require("../utils/financial");

const fixedIncomeTypes = new Set([
  "cash",
  "fixed_income",
  "treasury_selic",
  "treasury_ipca",
  "treasury_prefixado",
  "cdb",
  "lci_lca",
  "debenture",
  "fund",
  "pension"
]);

function enrichPortfolio(assets, quotes) {
  const enriched = assets.map((asset) => {
    const quote = quotes[asset.ticker] || { price: asset.averagePrice, changePercent: 0, source: "manual" };
    const currentValue = asNumber(asset.quantity) * asNumber(quote.price);
    const invested = asNumber(asset.quantity) * asNumber(asset.averagePrice);
    return {
      ...asset,
      currentPrice: quote.price,
      changePercent: quote.changePercent,
      quoteSource: quote.source,
      invested,
      currentValue,
      profit: currentValue - invested,
      profitPercent: invested ? ((currentValue - invested) / invested) * 100 : 0
    };
  });

  const totals = enriched.reduce(
    (acc, asset) => {
      acc.invested += asset.invested;
      acc.currentValue += asset.currentValue;
      acc.profit += asset.profit;
      acc.byType[asset.type] = (acc.byType[asset.type] || 0) + asset.currentValue;
      return acc;
    },
    { invested: 0, currentValue: 0, profit: 0, byType: {} }
  );

  return {
    assets: enriched,
    totals: {
      ...totals,
      profitPercent: totals.invested ? (totals.profit / totals.invested) * 100 : 0,
      allocation: Object.entries(totals.byType).map(([type, value]) => ({ type, value }))
    }
  };
}

function normalizeTicker(ticker) {
  return String(ticker || "").trim().toUpperCase();
}

function normalizeSplit(split) {
  const ticker = normalizeTicker(split.ticker);
  const type = split.type || "stock";
  const amount = asNumber(split.amount);
  const isFixedIncome = fixedIncomeTypes.has(type);
  const averagePrice = isFixedIncome ? asNumber(split.averagePrice, 1) || 1 : asNumber(split.averagePrice);
  const quantity = isFixedIncome ? asNumber(split.quantity, amount) || amount : asNumber(split.quantity, averagePrice ? amount / averagePrice : 0);
  const finalQuantity = quantity || 1;
  const finalAveragePrice = averagePrice || amount / finalQuantity;

  return {
    ticker,
    name: split.name || "",
    type,
    amount,
    quantity: finalQuantity,
    averagePrice: finalAveragePrice,
    currency: split.currency || "BRL"
  };
}

async function upsertAssetFromSplit(userId, split) {
  const assets = await repository.listAssets(userId);
  const existing = assets.find((asset) => asset.ticker === split.ticker && asset.type === split.type);

  if (!existing) {
    return repository.createAsset({
      userId,
      ticker: split.ticker,
      name: split.name,
      type: split.type,
      quantity: split.quantity,
      averagePrice: split.averagePrice,
      currency: split.currency
    });
  }

  const currentQuantity = asNumber(existing.quantity);
  const currentAverage = asNumber(existing.averagePrice);
  const nextQuantity = currentQuantity + split.quantity;
  const nextAveragePrice = nextQuantity
    ? ((currentQuantity * currentAverage) + (split.quantity * split.averagePrice)) / nextQuantity
    : split.averagePrice;

  return repository.updateAsset(userId, existing.id, {
    name: split.name || existing.name,
    quantity: nextQuantity,
    averagePrice: nextAveragePrice,
    currency: split.currency || existing.currency
  });
}

const portfolio = asyncHandler(async (req, res) => {
  const assets = await repository.listAssets(req.user.id);
  const quotes = await getQuotes(assets);
  return res.json({ portfolio: enrichPortfolio(assets, quotes) });
});

const market = asyncHandler(async (req, res) => {
  const items = await getMarketCatalog();
  return res.json({
    updatedAt: new Date().toISOString(),
    items
  });
});

const pendingInvestments = asyncHandler(async (req, res) => {
  const transactions = await repository.listTransactions(req.user.id);
  const pending = transactions.filter((transaction) => {
    return (
      transaction.type === "expense" &&
      transaction.category === "Investimentos" &&
      transaction.investmentStatus !== "resolved"
    );
  });

  return res.json({ pendingInvestments: pending });
});

const resolveInvestment = asyncHandler(async (req, res) => {
  const { transactionId, splits } = req.body;
  if (!transactionId || !Array.isArray(splits) || !splits.length) {
    return res.status(400).json({ message: "Informe a transação e ao menos um investimento para explicar." });
  }

  const transactions = await repository.listTransactions(req.user.id);
  const transaction = transactions.find((item) => String(item.id) === String(transactionId));
  if (!transaction || transaction.type !== "expense" || transaction.category !== "Investimentos") {
    return res.status(404).json({ message: "Saída de investimento não encontrada." });
  }

  const normalizedSplits = splits.map(normalizeSplit);
  const invalid = normalizedSplits.find((split) => !split.ticker || !split.amount || !split.quantity || !split.averagePrice);
  if (invalid) {
    return res.status(400).json({ message: "Cada parte precisa ter ticker, valor, quantidade e preço médio válidos." });
  }

  const total = normalizedSplits.reduce((sum, split) => sum + split.amount, 0);
  const transactionAmount = asNumber(transaction.amount);
  if (Math.abs(total - transactionAmount) > 0.01) {
    return res.status(400).json({
      message: `A soma das divisões precisa fechar ${transactionAmount.toFixed(2)}. Hoje está ${total.toFixed(2)}.`
    });
  }

  const createdSplits = [];
  for (const split of normalizedSplits) {
    const asset = await upsertAssetFromSplit(req.user.id, split);
    createdSplits.push({
      assetId: asset.id,
      ticker: split.ticker,
      name: split.name,
      type: split.type,
      amount: split.amount,
      quantity: split.quantity,
      averagePrice: split.averagePrice,
      createdAt: new Date().toISOString()
    });
  }

  const updatedTransaction = await repository.updateTransaction(req.user.id, transaction.id, {
    investmentStatus: "resolved",
    investmentSplits: createdSplits,
    resolvedAt: new Date().toISOString()
  });
  const assets = await repository.listAssets(req.user.id);
  const quotes = await getQuotes(assets);

  return res.status(201).json({
    transaction: updatedTransaction,
    portfolio: enrichPortfolio(assets, quotes)
  });
});

const create = asyncHandler(async (req, res) => {
  const { ticker, name, type, quantity, averagePrice, currency } = req.body;
  if (!ticker || !quantity || averagePrice === undefined) {
    return res.status(400).json({ message: "Ticker, quantidade e preço médio são obrigatórios." });
  }

  const asset = await repository.createAsset({
    userId: req.user.id,
    ticker,
    name,
    type,
    quantity: asNumber(quantity),
    averagePrice: asNumber(averagePrice),
    currency
  });

  return res.status(201).json({ asset });
});

const update = asyncHandler(async (req, res) => {
  const fields = ["ticker", "name", "type", "quantity", "averagePrice", "currency"].reduce((acc, key) => {
    if (req.body[key] !== undefined) {
      acc[key] = ["quantity", "averagePrice"].includes(key) ? asNumber(req.body[key]) : req.body[key];
    }
    return acc;
  }, {});

  const asset = await repository.updateAsset(req.user.id, req.params.id, fields);
  if (!asset) return res.status(404).json({ message: "Ativo não encontrado." });
  return res.json({ asset });
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await repository.deleteAsset(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: "Ativo não encontrado." });
  return res.status(204).send();
});

module.exports = {
  portfolio,
  market,
  pendingInvestments,
  resolveInvestment,
  create,
  update,
  remove
};
