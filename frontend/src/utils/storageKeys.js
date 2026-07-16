export const storageKeys = {
  authToken: "betterway_token",
  legacyAuthToken: ["valorize_token", "fintrack_token"],
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
