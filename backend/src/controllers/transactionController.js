const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { summarizeConnections } = require("../services/bankSummaryService");
const {
  asNumber,
  calculateOpportunity,
  currentMonthKey,
  financialWindow,
  dateKey,
  addDaysToDateKey,
  formatShortDateKeyPtBR,
  normalizeDateForStorage,
  limitStatus,
  monthKey
} = require("../utils/financial");
const { cleanText, isValidDateKey, isValidMonthKey, numberInRange } = require("../utils/validation");

function validateMonthFilter(req, res) {
  if (req.query.month && !isValidMonthKey(req.query.month)) {
    res.status(400).json({ message: "Informe o mês no formato AAAA-MM." });
    return false;
  }
  return true;
}

function totalsByCategory(transactions) {
  const totals = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((map, transaction) => {
      map[transaction.category] = (map[transaction.category] || 0) + asNumber(transaction.amount);
      return map;
    }, {});

  return Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function isSpendingForLimit(transaction) {
  return transaction.type === "expense" && transaction.category !== "Investimentos";
}

function isInvestmentTransaction(transaction) {
  return transaction.type === "expense" && transaction.category === "Investimentos";
}

function buildDailyTrend(transactions, window) {
  const buckets = new Map();

  for (let index = 0; index < window.days; index += 1) {
    const day = addDaysToDateKey(window.startKey, index);
    buckets.set(day, {
      day,
      label: formatShortDateKeyPtBR(day),
      income: 0,
      expense: 0
    });
  }

  transactions.forEach((transaction) => {
    const key = dateKey(transaction.date);
    if (!buckets.has(key)) return;
    const bucket = buckets.get(key);
    bucket[transaction.type] += asNumber(transaction.amount);
  });

  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    balance: bucket.income - bucket.expense
  }));
}

function buildLimitUsage(limits, categories) {
  const totals = categories.reduce((map, item) => {
    map[item.category] = item.total;
    return map;
  }, {});

  return limits.map((limit) => {
    const spent = asNumber(totals[limit.category]);
    const usagePercent = limit.amount ? (spent / limit.amount) * 100 : 0;
    return {
      ...limit,
      spent,
      usagePercent,
      status: limitStatus(usagePercent)
    };
  });
}

function buildBehaviorMessage(status, usagePercent) {
  if (status === "danger") {
    return `Alerta máximo: você já usou ${usagePercent.toFixed(0)}% do teto. Compras por impulso agora estão invadindo suas metas.`;
  }
  if (status === "warning") {
    return `Atenção: você chegou a ${usagePercent.toFixed(0)}% do limite mensal. Cada gasto novo precisa competir com suas metas.`;
  }
  return "Seu fluxo está saudável. Continue usando o dinheiro como ferramenta, não como susto no fim do mês.";
}

const list = asyncHandler(async (req, res) => {
  if (!validateMonthFilter(req, res)) return;
  if (req.query.type && !["income", "expense"].includes(req.query.type)) {
    return res.status(400).json({ message: "Tipo de transação inválido." });
  }
  const transactions = await repository.listTransactions(req.user.id, req.query);
  return res.json({ transactions });
});

const create = asyncHandler(async (req, res) => {
  const { title, amount, type, category, isSuperfluous, date, notes } = req.body;

  const cleanTitle = cleanText(title, 120);
  const cleanCategory = cleanText(category, 80);
  const validAmount = numberInRange(amount, 0.01, 1e15);
  if (!cleanTitle || validAmount === null || !["income", "expense"].includes(type) || !cleanCategory) {
    return res.status(400).json({ message: "Título, valor, tipo e categoria são obrigatórios." });
  }
  if (date && !isValidDateKey(date)) return res.status(400).json({ message: "Informe uma data válida." });

  const transaction = await repository.createTransaction({
    userId: req.user.id,
    title: cleanTitle,
    amount: validAmount,
    type,
    category: cleanCategory,
    isSuperfluous: Boolean(isSuperfluous),
    date: normalizeDateForStorage(date || new Date()),
    notes: cleanText(notes, 1000),
    investmentStatus: isInvestmentTransaction({ type, category }) ? "pending" : "not_applicable"
  });

  let opportunity = null;
  if (transaction.type === "expense" && transaction.isSuperfluous) {
    const monthTransactions = await repository.listTransactions(req.user.id, { month: monthKey(transaction.date) });
    const goals = await repository.listGoals(req.user.id);
    opportunity = calculateOpportunity(transaction, req.user, goals, monthTransactions);
  }

  return res.status(201).json({ transaction, opportunity });
});

const update = asyncHandler(async (req, res) => {
  const currentTransactions = await repository.listTransactions(req.user.id);
  const currentTransaction = currentTransactions.find((transaction) => String(transaction.id) === String(req.params.id));
  const fields = ["title", "amount", "type", "category", "isSuperfluous", "date", "notes"].reduce((acc, key) => {
    if (req.body[key] !== undefined) {
      if (key === "amount") acc[key] = Math.abs(asNumber(req.body[key]));
      else if (key === "date") acc[key] = normalizeDateForStorage(req.body[key]);
      else acc[key] = req.body[key];
    }
    return acc;
  }, {});

  if (!currentTransaction) return res.status(404).json({ message: "Transação não encontrada." });
  if (fields.title !== undefined) {
    fields.title = cleanText(fields.title, 120);
    if (!fields.title) return res.status(400).json({ message: "Informe um título válido." });
  }
  if (fields.amount !== undefined) {
    const amountValue = numberInRange(req.body.amount, 0.01, 1e15);
    if (amountValue === null) return res.status(400).json({ message: "Informe um valor válido." });
    fields.amount = amountValue;
  }
  if (fields.type !== undefined && !["income", "expense"].includes(fields.type)) {
    return res.status(400).json({ message: "Tipo de transação inválido." });
  }
  if (fields.category !== undefined) {
    fields.category = cleanText(fields.category, 80);
    if (!fields.category) return res.status(400).json({ message: "Informe uma categoria válida." });
  }
  if (fields.date !== undefined && !isValidDateKey(req.body.date)) {
    return res.status(400).json({ message: "Informe uma data válida." });
  }
  if (fields.notes !== undefined) fields.notes = cleanText(fields.notes, 1000);
  if (fields.isSuperfluous !== undefined) fields.isSuperfluous = Boolean(fields.isSuperfluous);

  if (fields.type !== undefined || fields.category !== undefined || fields.amount !== undefined) {
    const nextTransaction = {
      ...currentTransaction,
      ...fields
    };
    fields.investmentStatus = isInvestmentTransaction(nextTransaction)
      ? fields.amount !== undefined && currentTransaction.investmentStatus === "resolved"
        ? "pending"
        : currentTransaction.investmentStatus === "resolved"
          ? "resolved"
          : "pending"
      : "not_applicable";
    if (fields.investmentStatus !== "resolved") {
      fields.investmentSplits = [];
      fields.resolvingAt = null;
      fields.resolvedAt = null;
    }
  }

  const transaction = await repository.updateTransaction(req.user.id, req.params.id, fields);
  if (!transaction) return res.status(404).json({ message: "Transação não encontrada." });
  return res.json({ transaction });
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await repository.deleteTransaction(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: "Transação não encontrada." });
  return res.status(204).send();
});

const summary = asyncHandler(async (req, res) => {
  if (!validateMonthFilter(req, res)) return;
  const month = req.query.month || currentMonthKey();
  const window = financialWindow(month);
  const [periodTransactions, allTransactions, goals, limits, assets, bankConnections] = await Promise.all([
    repository.listTransactions(req.user.id, { month }),
    repository.listTransactions(req.user.id),
    repository.listGoals(req.user.id),
    repository.listLimits(req.user.id),
    repository.listAssets(req.user.id),
    repository.listBankConnections(req.user.id)
  ]);

  const monthlyIncome = periodTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + asNumber(transaction.amount), 0);
  const monthlyExpenses = periodTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + asNumber(transaction.amount), 0);
  const expensesForLimit = periodTransactions
    .filter(isSpendingForLimit)
    .reduce((sum, transaction) => sum + asNumber(transaction.amount), 0);
  const categories = totalsByCategory(periodTransactions);
  const balance = monthlyIncome - monthlyExpenses;
  const usagePercent = req.user.monthlyLimit ? (expensesForLimit / req.user.monthlyLimit) * 100 : 0;
  const status = limitStatus(usagePercent);
  const ledgerBankBalance = allTransactions.reduce((sum, transaction) => {
    return transaction.type === "income" ? sum + asNumber(transaction.amount) : sum - asNumber(transaction.amount);
  }, 0);
  const connected = summarizeConnections(bankConnections);
  const bankBalance = connected.accountCount ? connected.accountBalance : ledgerBankBalance;
  const manuallyInvestedCost = assets.reduce(
    (sum, asset) => sum + asNumber(asset.quantity) * asNumber(asset.averagePrice),
    0
  );
  const investedCost = manuallyInvestedCost + connected.investmentBalance;

  return res.json({
    month: window.month,
    window: {
      start: window.start.toISOString(),
      endExclusive: window.endExclusive.toISOString(),
      label: window.label,
      rule: "3 últimos dias do mês anterior + dias 1 a 27 do mês selecionado"
    },
    widgets: {
      income: monthlyIncome,
      expenses: monthlyExpenses,
      expensesForLimit,
      balance,
      monthlyLimit: asNumber(req.user.monthlyLimit),
      usagePercent,
      status,
      behaviorMessage: buildBehaviorMessage(status, usagePercent),
      bankBalance,
      ledgerBankBalance,
      bankBalanceSource: connected.accountCount ? "connected" : "transactions",
      connectedAccountBalance: connected.accountBalance,
      connectedInvestmentBalance: connected.investmentBalance,
      investedCost,
      netWorthEstimate: bankBalance + investedCost
    },
    categories,
    trend: buildDailyTrend(periodTransactions, window),
    goals: goals.map((goal) => ({
      ...goal,
      progress: goal.targetAmount ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
    })),
    limits: buildLimitUsage(limits, categories),
    recentTransactions: periodTransactions.slice(0, 5)
  });
});

module.exports = {
  list,
  create,
  update,
  remove,
  summary
};
