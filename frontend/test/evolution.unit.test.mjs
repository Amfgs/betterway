import assert from "node:assert/strict";
import test from "node:test";
import { buildFinancialEvolution } from "../src/utils/evolution.js";

const referenceDate = new Date(2026, 6, 30);
const transactions = [
  { type: "income", amount: 50.92, date: "2026-07-30T12:00:00.000Z" },
  { type: "income", amount: 49.08, date: "2026-07-30" },
  { type: "expense", amount: 25.5, date: "2026-07-24" },
  { type: "expense", amount: 80, date: "2026-07-23" },
  { type: "income", amount: 900, date: "2026-07-01" },
  { type: "expense", amount: 120, date: "2025-08-04" },
  { type: "income", amount: 500, date: "2025-07-30" },
  { type: "income", amount: 999, date: "2026-07-31" }
];

test("usa os últimos sete dias como visão padrão e preserva centavos", () => {
  const evolution = buildFinancialEvolution(transactions, undefined, referenceDate);

  assert.equal(evolution.range, "week");
  assert.equal(evolution.series.length, 7);
  assert.equal(evolution.totals.income, 100);
  assert.equal(evolution.totals.expense, 25.5);
  assert.equal(evolution.totals.balance, 74.5);
  assert.equal(evolution.series.at(-1).income, 100);
});

test("a visão de trinta dias inclui exatamente o intervalo até hoje", () => {
  const evolution = buildFinancialEvolution(transactions, "month", referenceDate);

  assert.equal(evolution.series.length, 30);
  assert.equal(evolution.totals.income, 1000);
  assert.equal(evolution.totals.expense, 105.5);
  assert.equal(evolution.totals.balance, 894.5);
});

test("a visão anual agrega doze meses e ignora movimentos fora do período", () => {
  const evolution = buildFinancialEvolution(transactions, "year", referenceDate);

  assert.equal(evolution.series.length, 12);
  assert.equal(evolution.series[0].expense, 120);
  assert.equal(evolution.series.at(-1).income, 1000);
  assert.equal(evolution.totals.income, 1000);
  assert.equal(evolution.totals.expense, 225.5);
});
