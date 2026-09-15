import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  clear() {
    this.values.clear();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  removeItem(key) {
    this.values.delete(key);
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { atob: globalThis.atob };

const {
  clearAuthSession,
  readAuthSession,
  readOrCreateDeviceId,
  storageKeys,
  storeAuthSession
} = await import("../src/utils/storageKeys.js");

function token(sessionStartedAt, marker) {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sst: sessionStartedAt, marker })).toString("base64url");
  return `${header}.${payload}.signature`;
}

test("mantém uma sessão persistente disponível após o armazenamento temporário ser limpo", () => {
  localStorage.clear();
  sessionStorage.clear();
  const startedAt = Date.now();
  const persistentToken = token(Math.floor(startedAt / 1000), "persistent");

  storeAuthSession(persistentToken, { persistent: true, startedAt });
  sessionStorage.clear();

  const restored = readAuthSession();
  assert.equal(restored.token, persistentToken);
  assert.equal(restored.persistent, true);
});

test("um token temporário antigo não substitui a sessão persistente de 15 dias", () => {
  localStorage.clear();
  sessionStorage.clear();
  const startedAt = Date.now();
  const persistentToken = token(Math.floor(startedAt / 1000), "persistent");
  const staleSessionToken = token(Math.floor(startedAt / 1000), "stale");

  storeAuthSession(persistentToken, { persistent: true, startedAt });
  sessionStorage.setItem(storageKeys.authToken, staleSessionToken);
  sessionStorage.setItem(storageKeys.authSessionStartedAt, String(startedAt));

  const restored = readAuthSession();
  assert.equal(restored.token, persistentToken);
  assert.equal(restored.persistent, true);
  assert.equal(sessionStorage.getItem(storageKeys.authToken), null);
});

test("uma resposta atrasada não apaga um token mais novo", () => {
  localStorage.clear();
  sessionStorage.clear();
  const startedAt = Date.now();
  const oldToken = token(Math.floor(startedAt / 1000), "old");
  const newToken = token(Math.floor(startedAt / 1000), "new");

  storeAuthSession(oldToken, { persistent: true, startedAt });
  storeAuthSession(newToken, { persistent: true, startedAt });

  assert.equal(clearAuthSession({ expectedToken: oldToken }), false);
  assert.equal(readAuthSession().token, newToken);
  assert.equal(clearAuthSession({ expectedToken: newToken }), true);
  assert.equal(readAuthSession(), null);
});

test("mantém um identificador estável para reconhecer o mesmo aparelho", () => {
  localStorage.clear();
  const first = readOrCreateDeviceId();
  const second = readOrCreateDeviceId();
  assert.ok(first.length >= 16);
  assert.equal(second, first);
});
