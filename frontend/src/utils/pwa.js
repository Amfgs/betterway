export function devicePlatform(environment = globalThis) {
  const navigatorValue = environment.navigator || {};
  const agent = String(navigatorValue.userAgent || "");
  const hintedPlatform = String(navigatorValue.userAgentData?.platform || "");
  const ios = /iPad|iPhone|iPod/i.test(agent) || (
    navigatorValue.platform === "MacIntel" && Number(navigatorValue.maxTouchPoints || 0) > 1
  );
  if (ios) return "ios";
  if (/Android/i.test(agent) || /Android/i.test(hintedPlatform)) return "android";
  return "desktop";
}

export function isStandaloneApp(environment = globalThis) {
  return Boolean(
    environment.matchMedia?.("(display-mode: standalone)").matches ||
    environment.navigator?.standalone
  );
}
