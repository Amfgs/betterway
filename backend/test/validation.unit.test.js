const assert = require("node:assert/strict");
const test = require("node:test");
const { numberInRange, parseLocalizedNumber } = require("../src/utils/validation");

test("interpreta valores monetários com ponto ou vírgula sem perder centavos", () => {
  assert.equal(parseLocalizedNumber("50.92"), 50.92);
  assert.equal(parseLocalizedNumber("50,92"), 50.92);
  assert.equal(parseLocalizedNumber("1.234,56"), 1234.56);
  assert.equal(parseLocalizedNumber("1,234.56"), 1234.56);
  assert.equal(parseLocalizedNumber("R$ 2.500,75"), 2500.75);
  assert.equal(numberInRange("50.92", 0.01, 1000), 50.92);
});

test("rejeita valores monetários ambíguos ou não numéricos", () => {
  assert.ok(Number.isNaN(parseLocalizedNumber("50.9.2")));
  assert.equal(numberInRange("R$ nada", 0.01, 1000), null);
});
