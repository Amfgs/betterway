const assert = require("node:assert/strict");
const test = require("node:test");

const { buildTransactionStreak, dateKeyInTimeZone } = require("../src/utils/streak");

function transaction(date) {
  return { date: `${date}T12:00:00.000Z` };
}

test("usa o dia brasileiro durante a janela do lembrete noturno", () => {
  const now = new Date("2026-07-26T00:30:00.000Z");
  assert.equal(dateKeyInTimeZone(now), "2026-07-25");
});

test("conta dias consecutivos e reconhece o registro de hoje", () => {
  const streak = buildTransactionStreak([
    transaction("2026-07-23"),
    transaction("2026-07-24"),
    transaction("2026-07-25")
  ], { today: "2026-07-25" });

  assert.equal(streak.todayLogged, true);
  assert.equal(streak.currentStreak, 3);
});

test("preserva a sequência até o fim do dia quando ainda falta registrar hoje", () => {
  const streak = buildTransactionStreak([
    transaction("2026-07-23"),
    transaction("2026-07-24")
  ], { today: "2026-07-25" });

  assert.equal(streak.todayLogged, false);
  assert.equal(streak.currentStreak, 2);
});
