const { addDaysToDateKey, dateKey } = require("./financial");

const DEFAULT_TIME_ZONE = "America/Recife";

function dateKeyInTimeZone(value = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildTransactionStreak(transactions = [], { now = new Date(), today = "" } = {}) {
  const loggedDays = new Set(transactions.map((transaction) => dateKey(transaction.date)));
  const todayKey = today || dateKeyInTimeZone(now);
  const todayLogged = loggedDays.has(todayKey);
  let cursor = todayLogged ? todayKey : addDaysToDateKey(todayKey, -1);
  let currentStreak = 0;

  while (loggedDays.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return {
    currentStreak,
    today: todayKey,
    todayLogged
  };
}

module.exports = {
  buildTransactionStreak,
  dateKeyInTimeZone
};
