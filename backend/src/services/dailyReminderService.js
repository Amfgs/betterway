const repository = require("./repository");
const { sendDailyEntryReminderEmail } = require("./emailService");
const { buildTransactionStreak, dateKeyInTimeZone } = require("../utils/streak");

const DELIVERY_BATCH_SIZE = 5;

async function sendUserDailyReminder(user, now = new Date()) {
  if (!user?.email || user.emailVerified === false || user.notificationPreferences?.dailyEntryReminder === false) {
    return "disabled";
  }

  const today = dateKeyInTimeZone(now);
  const notificationState = user.notificationState || {};
  if (notificationState.lastDailyReminderDate === today) return "already-sent";

  const transactions = await repository.listTransactions(user.id);
  const streak = buildTransactionStreak(transactions, { today });
  if (streak.todayLogged) return "already-updated";

  const result = await sendDailyEntryReminderEmail({
    currentStreak: streak.currentStreak,
    email: user.email,
    name: user.name
  });
  if (!result.delivered) return "not-configured";

  await repository.updateUser(user.id, {
    notificationState: {
      ...notificationState,
      lastDailyReminderDate: today
    }
  });
  return "delivered";
}

async function runDailyEntryReminders(now = new Date()) {
  const users = await repository.listUsers();
  const result = {
    alreadySent: 0,
    alreadyUpdated: 0,
    candidates: users.length,
    delivered: 0,
    disabled: 0,
    failed: 0,
    notConfigured: 0
  };

  for (let index = 0; index < users.length; index += DELIVERY_BATCH_SIZE) {
    const batch = users.slice(index, index + DELIVERY_BATCH_SIZE);
    const deliveries = await Promise.allSettled(batch.map((user) => sendUserDailyReminder(user, now)));
    deliveries.forEach((delivery) => {
      if (delivery.status === "rejected") {
        result.failed += 1;
        console.warn("Falha ao enviar lembrete diário:", delivery.reason?.message || "erro desconhecido");
        return;
      }
      if (delivery.value === "delivered") result.delivered += 1;
      else if (delivery.value === "already-sent") result.alreadySent += 1;
      else if (delivery.value === "already-updated") result.alreadyUpdated += 1;
      else if (delivery.value === "not-configured") result.notConfigured += 1;
      else result.disabled += 1;
    });
  }

  return result;
}

module.exports = {
  runDailyEntryReminders,
  sendUserDailyReminder
};
