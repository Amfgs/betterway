const avatarValues = [
  "aurora",
  "verde",
  "solar",
  "indigo",
  "grafite",
  "nexo",
  "coral",
  "julia",
  "ritmo",
  "lotus"
];

const AVATAR_VALUES = new Set(avatarValues);

function normalizeAvatarValue(value) {
  return AVATAR_VALUES.has(value) ? value : "";
}

module.exports = { AVATAR_VALUES, normalizeAvatarValue };
