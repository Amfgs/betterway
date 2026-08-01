const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-at-least-thirty-two-characters";

const authMiddleware = require("../src/middleware/authMiddleware");
const repository = require("../src/services/repository");

function responseMock() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test("encaminha falhas do banco sem convertê-las em sessão expirada", async (t) => {
  const originalFindUserById = repository.findUserById;
  t.after(() => {
    repository.findUserById = originalFindUserById;
  });
  repository.findUserById = async () => {
    throw new Error("banco temporariamente indisponível");
  };

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { sub: "user-id", ver: 0, sv: 0, sst: now, exp: now + 60 },
    process.env.JWT_SECRET,
    { algorithm: "HS256" }
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = responseMock();
  let nextError = null;

  await authMiddleware(req, res, (error) => {
    nextError = error;
  });

  assert.equal(res.statusCode, null);
  assert.match(nextError.message, /temporariamente indisponível/);
});

test("mantém 401 para token realmente inválido", async () => {
  const req = { headers: { authorization: "Bearer token-invalido" } };
  const res = responseMock();
  let nextCalled = false;

  await authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.message, "Sessão inválida ou expirada.");
  assert.equal(nextCalled, false);
});
