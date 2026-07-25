const repository = require("./repository");
const { sendFinancialReportEmail } = require("./emailService");
const { hasPlusAccess } = require("../utils/subscription");

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function reportPeriod(frequency, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start;
  if (frequency === "monthly") {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    end.setUTCDate(1);
  } else {
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 7);
  }
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const labelEnd = new Date(end.getTime() - 1);
  return {
    start,
    end,
    key: `${frequency}:${dayKey(start)}:${dayKey(end)}`,
    label: `${formatter.format(start)} a ${formatter.format(labelEnd)}`
  };
}

async function buildReport(userId, frequency, now = new Date()) {
  const period = reportPeriod(frequency, now);
  const [transactions, goals] = await Promise.all([
    repository.listTransactions(userId),
    repository.listGoals(userId)
  ]);
  const relevant = transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return date >= period.start && date < period.end;
  });
  const income = relevant
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const investmentTransactions = relevant.filter(
    (transaction) => transaction.type === "expense" && transaction.category === "Investimentos"
  );
  const investments = investmentTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const expenses = relevant
    .filter((transaction) => transaction.type === "expense" && transaction.category !== "Investimentos")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  return {
    frequency,
    period,
    totals: {
      income,
      expenses,
      investments,
      balance: income - expenses - investments
    },
    goals: goals.map((goal) => ({
      name: goal.name,
      progress: Number(goal.targetAmount || 0) > 0
        ? Math.min((Number(goal.currentAmount || 0) / Number(goal.targetAmount)) * 100, 100)
        : 0
    }))
  };
}

async function sendUserReport(user, frequency, now = new Date()) {
  if (!hasPlusAccess(user) || !user.email || user.notificationPreferences?.emailEnabled === false) return false;
  const preferenceKey = frequency === "weekly" ? "weeklyReports" : "monthlyReports";
  if (!user.notificationPreferences?.[preferenceKey]) return false;
  const report = await buildReport(user.id, frequency, now);
  const state = user.notificationState || {};
  const stateKey = frequency === "weekly" ? "lastWeeklyReportKey" : "lastMonthlyReportKey";
  if (state[stateKey] === report.period.key) return false;

  const result = await sendFinancialReportEmail({
    email: user.email,
    name: user.name,
    periodLabel: report.period.label,
    totals: report.totals,
    goals: report.goals,
    frequency
  });
  if (!result.delivered) return false;
  await repository.updateUser(user.id, {
    notificationState: { ...state, [stateKey]: report.period.key }
  });
  return true;
}

function brazilDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    day: "2-digit",
    timeZone: "America/Recife"
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

async function runScheduledReports(now = new Date()) {
  const parts = brazilDateParts(now);
  const frequencies = [
    ...(parts.weekday === "Mon" ? ["weekly"] : []),
    ...(parts.day === "01" ? ["monthly"] : [])
  ];
  if (!frequencies.length) return { candidates: 0, delivered: 0, failed: 0 };
  const users = await repository.listUsers();
  let delivered = 0;
  let failed = 0;
  for (const user of users) {
    for (const frequency of frequencies) {
      try {
        if (await sendUserReport(user, frequency, now)) delivered += 1;
      } catch (error) {
        failed += 1;
        console.warn("Falha ao gerar relatório financeiro:", error.message);
      }
    }
  }
  return { candidates: users.length, delivered, failed };
}

module.exports = {
  buildReport,
  reportPeriod,
  runScheduledReports,
  sendUserReport
};
