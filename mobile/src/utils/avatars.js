export const avatarOptions = [
  { label: "Aurora", value: "aurora", source: require("../assets/avatars/avatar-aurora.webp") },
  { label: "Pulso", value: "verde", source: require("../assets/avatars/avatar-verde.webp") },
  { label: "Faísca", value: "solar", source: require("../assets/avatars/avatar-solar.webp") },
  { label: "Horizonte", value: "indigo", source: require("../assets/avatars/avatar-indigo.webp") },
  { label: "Brisa", value: "grafite", source: require("../assets/avatars/avatar-grafite.webp") },
  { label: "Nexo", value: "nexo", source: require("../assets/avatars/avatar-nexo.webp") },
  { label: "Coral", value: "coral", source: require("../assets/avatars/avatar-coral.webp") },
  { label: "Júlia", value: "julia", source: require("../assets/avatars/avatar-julia.webp") },
  { label: "Ritmo", value: "ritmo", source: require("../assets/avatars/avatar-ritmo.webp") },
  { label: "Lótus", value: "lotus", source: require("../assets/avatars/avatar-lotus.webp") }
];

export function normalizeAvatar(value) {
  return avatarOptions.some((avatar) => avatar.value === value) ? value : avatarOptions[0].value;
}

export function avatarSource(value) {
  return avatarOptions.find((avatar) => avatar.value === normalizeAvatar(value))?.source || avatarOptions[0].source;
}
