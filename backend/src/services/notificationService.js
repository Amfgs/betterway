const repository = require("./repository");
const { sendGoalProgressEmail, sendGoalReachedEmail, sendLimitAlertEmail } = require("./emailService");
const { hasPlusAccess } = require("../utils/subscription");

function preferences(user) {
  return {
    emailEnabled: true,
    limitAlerts: true,
    goalAlerts: true,
    productAlerts: true,
    weeklyReports: false,
    monthlyReports: false,
    limitThreshold: 80,
    goalThreshold: 80,
    ...(user.notificationPreferences || {})
  };
}

function state(user) {
  return {
    limitAlertMonth: "",
    limitAlertLevel: 0,
    goalReachedIds: [],
    goalAlertLevels: [],
    lastWeeklyReportKey: "",
    lastMonthlyReportKey: "",
    ...(user.notificationState || {})
  };
}

async function maybeSendLimitAlert({ user, month, spent, limit }) {
  const prefs = preferences(user);
  if (!hasPlusAccess(user) || !prefs.emailEnabled || !prefs.limitAlerts || !user.email || Number(limit || 0) <= 0) return false;

  const usagePercent = (Number(spent || 0) / Number(limit)) * 100;
  const threshold = Math.max(50, Math.min(Number(prefs.limitThreshold || 80), 100));
  if (usagePercent < threshold) return false;

  const alertLevel = usagePercent >= 100 ? 100 : threshold;
  const currentState = state(user);
  if (currentState.limitAlertMonth === month && Number(currentState.limitAlertLevel || 0) >= alertLevel) return false;

  try {
    const result = await sendLimitAlertEmail({
      email: user.email,
      name: user.name,
      usagePercent,
      spent,
      limit
    });
    if (!result.delivered) return false;
    await repository.updateUser(user.id, {
      notificationState: {
        ...currentState,
        limitAlertMonth: month,
        limitAlertLevel: alertLevel
      }
    });
    return true;
  } catch (error) {
    console.warn("Falha ao enviar alerta de limite:", error.message);
    return false;
  }
}

async function maybeSendGoalReachedAlert({ user, goal }) {
  const prefs = preferences(user);
  if (!hasPlusAccess(user) || !prefs.emailEnabled || !prefs.goalAlerts || !user.email || !goal) return false;
  if (Number(goal.currentAmount || 0) < Number(goal.targetAmount || 0)) return false;

  const currentState = state(user);
  const goalId = String(goal.id || goal._id || "");
  if (!goalId || currentState.goalReachedIds.includes(goalId)) return false;

  try {
    const result = await sendGoalReachedEmail({
      email: user.email,
      name: user.name,
      goalName: goal.name,
      targetAmount: goal.targetAmount
    });
    if (!result.delivered) return false;
    await repository.updateUser(user.id, {
      notificationState: {
        ...currentState,
        goalReachedIds: [...currentState.goalReachedIds, goalId].slice(-100)
      }
    });
    return true;
  } catch (error) {
    console.warn("Falha ao enviar alerta de meta:", error.message);
    return false;
  }
}

async function maybeSendGoalProgressAlert({ user, goal }) {
  const prefs = preferences(user);
  if (!hasPlusAccess(user) || !prefs.emailEnabled || !prefs.goalAlerts || !user.email || !goal) return false;
  const target = Number(goal.targetAmount || 0);
  if (target <= 0) return false;

  const progress = Math.min((Number(goal.currentAmount || 0) / target) * 100, 100);
  const threshold = Math.max(50, Math.min(Number(prefs.goalThreshold || 80), 100));
  if (progress < threshold) return false;
  const level = progress >= 100 ? 100 : threshold;
  const currentState = state(user);
  const goalId = String(goal.id || goal._id || "");
  const previous = (currentState.goalAlertLevels || []).find((entry) => entry.goalId === goalId);
  if (!goalId || Number(previous?.level || 0) >= level) return false;

  try {
    const result = await sendGoalProgressEmail({
      email: user.email,
      name: user.name,
      goalName: goal.name,
      currentAmount: goal.currentAmount,
      targetAmount: goal.targetAmount,
      progress
    });
    if (!result.delivered) return false;
    const nextLevels = [
      ...(currentState.goalAlertLevels || []).filter((entry) => entry.goalId !== goalId),
      { goalId, level }
    ].slice(-100);
    await repository.updateUser(user.id, {
      notificationState: {
        ...currentState,
        goalAlertLevels: nextLevels,
        goalReachedIds: level >= 100
          ? [...new Set([...(currentState.goalReachedIds || []), goalId])].slice(-100)
          : currentState.goalReachedIds || []
      }
    });
    return true;
  } catch (error) {
    console.warn("Falha ao enviar alerta de progresso da meta:", error.message);
    return false;
  }
}

module.exports = {
  maybeSendGoalReachedAlert,
  maybeSendGoalProgressAlert,
  maybeSendLimitAlert
};
