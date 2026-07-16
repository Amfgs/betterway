function cleanText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const reservedUsernames = new Set(["admin", "api", "betterway", "root", "suporte", "system", "undefined"]);

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function isValidUsername(value) {
  const username = normalizeUsername(value);
  return (
    username.length >= 3 &&
    username.length <= 24 &&
    /^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(username) &&
    !/[._]{2}/.test(username) &&
    !reservedUsernames.has(username)
  );
}

function usernameBase(value, fallback = "usuario") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, ".")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 24);
  return isValidUsername(normalized) ? normalized : fallback;
}

function availableUsername(value, usedValues, fallback = "usuario") {
  const used = usedValues instanceof Set ? usedValues : new Set(usedValues || []);
  const base = usernameBase(value, fallback);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate) || !isValidUsername(candidate)) {
    const suffixText = String(suffix);
    candidate = `${base.slice(0, 24 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  return candidate;
}

function numberInRange(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function isValidDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1900 && year <= 2200 && month >= 1 && month <= 12;
}

function uniqueIds(values, excludedId) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(String).filter((value) => value && value !== String(excludedId || "")))];
}

module.exports = {
  cleanText,
  availableUsername,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  numberInRange,
  isValidDateKey,
  isValidMonthKey,
  uniqueIds
};
