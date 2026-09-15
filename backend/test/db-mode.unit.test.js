const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "production";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/betterway-test-not-connected";

const { isDatabaseConnected, isMemoryMode } = require("../src/config/db");

test("não troca para o armazenamento em memória quando o Mongo configurado oscila", () => {
  assert.equal(isDatabaseConnected(), false);
  assert.equal(isMemoryMode(), false);
});
