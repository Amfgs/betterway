export const storageKeys = {
  authToken: "valorize_token",
  legacyAuthToken: "fintrack_token",
  theme: "valorize_theme",
  legacyTheme: "fintrack_theme",
  calendarSpecs: "valorize:calendar-specs",
  legacyCalendarSpecs: "fintrack:calendar-specs",
  investmentVisualizer: "valorize:last-investment-visualizer",
  legacyInvestmentVisualizer: "fintrack:last-investment-visualizer",
  investmentVisualizerTicker: "valorize:last-investment-visualizer-ticker",
  legacyInvestmentVisualizerTicker: "fintrack:last-investment-visualizer-ticker"
};

export function readStoredValue(key, legacyKey, fallback = null) {
  const current = localStorage.getItem(key);
  if (current !== null) return current;

  const legacy = legacyKey ? localStorage.getItem(legacyKey) : null;
  if (legacy !== null) {
    localStorage.setItem(key, legacy);
    return legacy;
  }

  return fallback;
}

export function removeStoredValue(key, legacyKey) {
  localStorage.removeItem(key);
  if (legacyKey) localStorage.removeItem(legacyKey);
}
