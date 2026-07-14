function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDateKey(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate()
    };
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function dateKey(value = new Date()) {
  const parts = parseDateKey(value);
  if (!parts) return dateKey(new Date());
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateKeyToDate(key, hour = 12) {
  const parts = parseDateKey(key);
  if (!parts) return new Date();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, 0, 0, 0));
}

function addDaysToDateKey(key, days) {
  const date = dateKeyToDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function formatDateKeyPtBR(key) {
  const parts = parseDateKey(key);
  if (!parts) return "-";
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

function formatShortDateKeyPtBR(key) {
  const parts = parseDateKey(key);
  if (!parts) return "-";
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
}

function normalizeDateForStorage(value) {
  return dateKeyToDate(dateKey(value)).toISOString();
}

function financialWindow(month = currentMonthKey()) {
  const [yearValue, monthValue] = String(month).split("-").map(Number);
  const now = new Date();
  const year = Number.isFinite(yearValue) ? yearValue : now.getFullYear();
  const calendarMonth = Number.isFinite(monthValue) ? monthValue : now.getMonth() + 1;
  const monthIndex = calendarMonth - 1;
  const start = new Date(year, monthIndex, -2);
  const endExclusive = new Date(year, monthIndex, 28);
  const startKey = dateKey(start);
  const endExclusiveKey = dateKey(endExclusive);

  return {
    month: `${year}-${String(calendarMonth).padStart(2, "0")}`,
    start,
    endExclusive,
    startKey,
    endExclusiveKey,
    mongoStart: dateKeyToDate(startKey, 0),
    mongoEndExclusive: dateKeyToDate(endExclusiveKey, 0),
    days: Math.round((endExclusive - start) / 86400000),
    label: `${formatDateKeyPtBR(startKey)} a ${formatDateKeyPtBR(addDaysToDateKey(endExclusiveKey, -1))}`
  };
}

function monthKey(value) {
  return dateKey(value).slice(0, 7);
}

function isInsideFinancialWindow(value, window) {
  const key = dateKey(value);
  return key >= window.startKey && key < window.endExclusiveKey;
}

function limitStatus(usagePercent) {
  if (usagePercent >= 100) return "danger";
  if (usagePercent >= 80) return "warning";
  return "safe";
}

function compoundValue(principal, monthlyRate, months) {
  return principal * Math.pow(1 + monthlyRate, months);
}

function compoundWithContributions(principal, monthlyContribution, monthlyRate, months) {
  if (monthlyRate === 0) {
    return principal + monthlyContribution * months;
  }
  return (
    principal * Math.pow(1 + monthlyRate, months) +
    monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  );
}

function calculateOpportunity(transaction, user, goals, monthTransactions) {
  const amount = asNumber(transaction.amount);
  const hourlyRate = Math.max(asNumber(user.hourlyRate, asNumber(user.salary) / 176), 1);
  const hoursWorked = amount / hourlyRate;
  const monthlyIncome = monthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + asNumber(item.amount), 0);
  const monthlyExpense = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + asNumber(item.amount), 0);
  const monthlySavings = Math.max(monthlyIncome - monthlyExpense, asNumber(user.salary) * 0.12, 250);
  const dailySavings = Math.max(monthlySavings / 30, 10);
  const activeGoals = goals
    .filter((goal) => asNumber(goal.targetAmount) > asNumber(goal.currentAmount))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const goal = activeGoals[0] || null;
  const daysDelayed = Math.ceil(amount / dailySavings);
  const futureValue = compoundValue(amount, 0.0105, 36);

  return {
    purchaseAmount: amount,
    goalName: goal?.name || "liberdade financeira",
    daysDelayed,
    futureValue,
    hoursWorked,
    monthlySavings,
    messages: [
      `Esse gasto adiou sua meta "${goal?.name || "liberdade financeira"}" em ${daysDelayed} dias.`,
      `Investidos a 1,05% ao mês, esses R$ ${amount.toFixed(2)} virariam R$ ${futureValue.toFixed(2)} em 3 anos.`,
      `Você precisou trabalhar ${hoursWorked.toFixed(1)} horas para pagar por essa compra.`
    ]
  };
}

const contributionFrequencyMonths = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12
};

function buildCompoundProjection({
  initialAmount,
  monthlyContribution,
  recurringContribution,
  contributionFrequency = "monthly",
  annualRate,
  months,
  annualContributionIncrease = 0,
  extraContribution = 0,
  extraContributionMonth = 0
}) {
  const principal = asNumber(initialAmount);
  const pmt = asNumber(recurringContribution ?? monthlyContribution);
  const periods = Math.max(Math.round(asNumber(months)), 1);
  const monthlyRate = Math.pow(1 + asNumber(annualRate) / 100, 1 / 12) - 1;
  const frequency = contributionFrequencyMonths[contributionFrequency] || 1;
  const annualIncrease = asNumber(annualContributionIncrease) / 100;
  const extra = Math.max(asNumber(extraContribution), 0);
  const extraMonth = Math.max(Math.round(asNumber(extraContributionMonth)), 0);
  const series = [];
  let balance = principal;
  let invested = principal;

  series.push({
    month: 0,
    invested: Number(invested.toFixed(2)),
    interest: 0,
    balance: Number(balance.toFixed(2)),
    contribution: Number(principal.toFixed(2))
  });

  for (let month = 1; month <= periods; month += 1) {
    balance *= 1 + monthlyRate;

    const annualStep = Math.floor((month - 1) / 12);
    const recurring = month % frequency === 0 ? pmt * Math.pow(1 + annualIncrease, annualStep) : 0;
    const oneTime = extra > 0 && month === extraMonth ? extra : 0;
    const contribution = recurring + oneTime;
    balance += contribution;
    invested += contribution;

    series.push({
      month,
      invested: Number(invested.toFixed(2)),
      interest: Number((balance - invested).toFixed(2)),
      balance: Number(balance.toFixed(2)),
      contribution: Number(contribution.toFixed(2))
    });
  }

  const final = series[series.length - 1];
  return {
    monthlyRate,
    annualRate: asNumber(annualRate),
    months: periods,
    contributionFrequency,
    annualContributionIncrease: asNumber(annualContributionIncrease),
    extraContribution: extra,
    extraContributionMonth: extraMonth,
    finalAmount: final.balance,
    totalInvested: final.invested,
    totalInterest: final.interest,
    returnPercent: final.invested ? (final.interest / final.invested) * 100 : 0,
    series
  };
}

module.exports = {
  asNumber,
  currentMonthKey,
  dateKey,
  dateKeyToDate,
  addDaysToDateKey,
  formatShortDateKeyPtBR,
  normalizeDateForStorage,
  financialWindow,
  monthKey,
  isInsideFinancialWindow,
  limitStatus,
  calculateOpportunity,
  buildCompoundProjection
};
