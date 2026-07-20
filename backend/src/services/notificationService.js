const repository = require("./repository");
const { sendGoalReachedEmail, sendLimitAlertEmail } = require("./emailService");

function preferences(user) {
  return {
    emailEnabled: true,
    limitAlerts: true,
    goalAlerts: true,
    limitThreshold: 80,
    ...(user.notificationPreferences || {})
  };
}

function state(user) {
  return {
    limitAlertMonth: "",
    limitAlertLevel: 0,
    goalReachedIds: [],
    ...(user.notificationState || {})
  };
}

async function maybeSendLimitAlert({ user, month, spent, limit }) {
  const prefs = preferences(user);
  if (!prefs.emailEnabled || !prefs.limitAlerts || !user.email || Number(limit || 0) <= 0) return false;

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
  if (!prefs.emailEnabled || !prefs.goalAlerts || !user.email || !goal) return false;
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

module.exports = {
  maybeSendGoalReachedAlert,
  maybeSendLimitAlert
};
