export const storageKeys = {
  authToken: "betterway_token",
  legacyAuthToken: ["valorize_token", "fintrack_token"],
  authSessionStartedAt: "betterway_session_started_at",
  authSessionPersistent: "betterway_session_persistent",
  theme: "betterway_theme",
  legacyTheme: ["valorize_theme", "fintrack_theme"],
  calendarSpecs: "betterway:calendar-specs",
  legacyCalendarSpecs: ["valorize:calendar-specs", "fintrack:calendar-specs"],
  investmentVisualizer: "betterway:last-investment-visualizer",
  legacyInvestmentVisualizer: ["valorize:last-investment-visualizer", "fintrack:last-investment-visualizer"],
  investmentVisualizerTicker: "betterway:last-investment-visualizer-ticker",
  legacyInvestmentVisualizerTicker: ["valorize:last-investment-visualizer-ticker", "fintrack:last-investment-visualizer-ticker"],
  sidebarCollapsed: "betterway.sidebar.collapsed",
  legacySidebarCollapsed: ["valorize.sidebar.collapsed"]
};

export const AUTH_SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

function legacyKeys(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function readStoredValue(key, legacyKey, fallback = null) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;

  for (const candidate of legacyKeys(legacyKey)) {
    const legacy = localStorage.getItem(candidate);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      return legacy;
    }
  }

  return fallback;
}

export function removeStoredValue(key, legacyKey) {
  localStorage.removeItem(key);
  legacyKeys(legacyKey).forEach((candidate) => localStorage.removeItem(candidate));
}

function tokenStartedAt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    const seconds = Number(decoded.sst || decoded.iat || 0);
    return seconds > 0 ? seconds * 1000 : Date.now();
  } catch {
    return Date.now();
  }
}

export function clearAuthSession() {
  removeStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
  localStorage.removeItem(storageKeys.authSessionStartedAt);
  sessionStorage.removeItem(storageKeys.authToken);
  sessionStorage.removeItem(storageKeys.authSessionStartedAt);
}

export function storeAuthSession(token, { persistent = true, startedAt } = {}) {
  clearAuthSession();
  const storage = persistent ? localStorage : sessionStorage;
  const resolvedStartedAt = Number(startedAt) || tokenStartedAt(token);
  storage.setItem(storageKeys.authToken, token);
  storage.setItem(storageKeys.authSessionStartedAt, String(resolvedStartedAt));
  localStorage.setItem(storageKeys.authSessionPersistent, String(persistent));
  return {
    token,
    persistent,
    startedAt: resolvedStartedAt,
    expiresAt: resolvedStartedAt + AUTH_SESSION_TTL_MS
  };
}

export function readAuthSession() {
  const sessionToken = sessionStorage.getItem(storageKeys.authToken);
  const persistentToken = readStoredValue(storageKeys.authToken, storageKeys.legacyAuthToken);
  const token = sessionToken || persistentToken;
  if (!token) return null;

  const persistent = !sessionToken;
  const storage = persistent ? localStorage : sessionStorage;
  const storedStart = Number(storage.getItem(storageKeys.authSessionStartedAt));
  const startedAt = storedStart > 0 ? storedStart : tokenStartedAt(token);
  const expiresAt = startedAt + AUTH_SESSION_TTL_MS;

  if (expiresAt <= Date.now()) {
    clearAuthSession();
    return null;
  }
  if (!storedStart) storage.setItem(storageKeys.authSessionStartedAt, String(startedAt));
  return { token, persistent, startedAt, expiresAt };
}

export function readAuthToken() {
  return readAuthSession()?.token || null;
}

export function scopedStorageKey(key, userId) {
  return `${key}:${encodeURIComponent(String(userId || "anonymous"))}`;
}

export function readScopedStoredValue(key, legacyKey, userId, fallback = null) {
  return readStoredValue(
    scopedStorageKey(key, userId),
    legacyKeys(legacyKey).map((candidate) => scopedStorageKey(candidate, userId)),
    fallback
  );
}
