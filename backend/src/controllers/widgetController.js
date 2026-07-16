const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { addDaysToDateKey, asNumber, currentMonthKey, dateKey, limitStatus } = require("../utils/financial");

const defaultPreferences = {
  primaryWidgetKind: "goal",
  primaryWidgetId: "",
  streakReminderTime: "22:30",
  appBlockingIntent: false
};

function normalizePreferences(input = {}) {
  const primaryWidgetKind = input.primaryWidgetKind === "limit" ? "limit" : "goal";
  const reminderTime = String(input.streakReminderTime || defaultPreferences.streakReminderTime);
  const streakReminderTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)
    ? reminderTime
    : defaultPreferences.streakReminderTime;

  return {
    primaryWidgetKind,
    primaryWidgetId: input.primaryWidgetId ? String(input.primaryWidgetId) : "",
    streakReminderTime,
    appBlockingIntent: Boolean(input.appBlockingIntent)
  };
}

function buildLimitItems(limits, transactions) {
  const expensesByCategory = transactions
    .filter((transaction) => transaction.type === "expense" && transaction.category !== "Investimentos")
    .reduce((map, transaction) => {
      map[transaction.category] = (map[transaction.category] || 0) + asNumber(transaction.amount);
      return map;
    }, {});

  return limits.map((limit) => {
    const spent = asNumber(expensesByCategory[limit.category]);
    const amount = asNumber(limit.amount);
    const usagePercent = amount ? (spent / amount) * 100 : 0;
    return {
      ...limit,
      spent,
      remaining: Math.max(amount - spent, 0),
      usagePercent,
      status: limitStatus(usagePercent)
    };
  });
}

function buildGoalItems(goals) {
  return goals.map((goal) => {
    const targetAmount = asNumber(goal.targetAmount);
    const currentAmount = asNumber(goal.currentAmount);
    return {
      ...goal,
      remaining: Math.max(targetAmount - currentAmount, 0),
      progress: targetAmount ? Math.min((currentAmount / targetAmount) * 100, 100) : 0
    };
  });
}

function buildSelectedWidget(preferences, goals, limits) {
  const requestedList = preferences.primaryWidgetKind === "limit" ? limits : goals;
  const requested = requestedList.find((item) => String(item.id) === String(preferences.primaryWidgetId)) || requestedList[0];
  const fallback = requested || goals[0] || limits[0] || null;
  if (!fallback) return null;

  const kind = limits.some((limit) => String(limit.id) === String(fallback.id)) ? "limit" : "goal";
  if (kind === "limit") {
    return {
      kind,
      id: fallback.id,
      title: fallback.category,
      subtitle: `${fallback.remaining.toFixed(2)} restantes`,
      primaryValue: fallback.remaining,
      progress: fallback.usagePercent,
      status: fallback.status
    };
  }

  return {
    kind,
    id: fallback.id,
    title: fallback.name,
    subtitle: `${fallback.progress.toFixed(0)}% da meta`,
    primaryValue: fallback.currentAmount,
    progress: fallback.progress,
    status: fallback.progress >= 100 ? "safe" : "warning"
  };
}

function buildStreak(transactions, preferences) {
  const loggedDays = new Set(transactions.map((transaction) => dateKey(transaction.date)));
  const today = dateKey(new Date());
  const todayLogged = loggedDays.has(today);
  let cursor = todayLogged ? today : addDaysToDateKey(today, -1);
  let currentStreak = 0;

  while (loggedDays.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return {
    currentStreak,
    todayLogged,
    reminderTime: preferences.streakReminderTime,
    nextAction: todayLogged ? "Streak protegido hoje." : "Abra a Better Way e registre suas entradas ou saídas.",
    deadlineLabel: `Até ${preferences.streakReminderTime}`,
    appBlocking: {
      requested: preferences.appBlockingIntent,
      availableInExpoGo: false,
      nativeRequirement: "Bloqueio real exige Screen Time/FamilyControls, entitlements da Apple e um build nativo fora do Expo Go."
    }
  };
}

async function buildWidgetState(user) {
  const month = currentMonthKey();
  const [goalsRaw, limitsRaw, periodTransactions, allTransactions] = await Promise.all([
    repository.listGoals(user.id),
    repository.listLimits(user.id),
    repository.listTransactions(user.id, { month }),
    repository.listTransactions(user.id)
  ]);
  const preferences = normalizePreferences(user.widgetPreferences);
  const goals = buildGoalItems(goalsRaw);
  const limits = buildLimitItems(limitsRaw, periodTransactions);

  return {
    preferences,
    selectedWidget: buildSelectedWidget(preferences, goals, limits),
    options: {
      goals,
      limits
    },
    streak: buildStreak(allTransactions, preferences),
    iosCapabilities: {
      homeScreenWidgets: "development-build-required",
      appBlocking: "native-screen-time-entitlement-required",
      expoGo: "configuration-only"
    }
  };
}

const state = asyncHandler(async (req, res) => {
  return res.json(await buildWidgetState(req.user));
});

const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = normalizePreferences({
    ...req.user.widgetPreferences,
    ...req.body
  });
  const user = await repository.updateUser(req.user.id, { widgetPreferences: preferences });
  return res.json(await buildWidgetState(user));
});

module.exports = {
  state,
  updatePreferences
};
