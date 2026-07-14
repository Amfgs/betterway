import avatarAurora from "../assets/avatars/avatar-aurora.png";
import avatarGrafite from "../assets/avatars/avatar-grafite.png";
import avatarIndigo from "../assets/avatars/avatar-indigo.png";
import avatarSolar from "../assets/avatars/avatar-solar.png";
import avatarVerde from "../assets/avatars/avatar-verde.png";

export const avatarOptions = [
  { label: "Aurora", value: "aurora", src: avatarAurora },
  { label: "Verde", value: "verde", src: avatarVerde },
  { label: "Solar", value: "solar", src: avatarSolar },
  { label: "Índigo", value: "indigo", src: avatarIndigo },
  { label: "Grafite", value: "grafite", src: avatarGrafite }
];

const avatarValues = new Set(avatarOptions.map((avatar) => avatar.value));

export function normalizeAvatar(value) {
  return avatarValues.has(value) ? value : avatarOptions[0].value;
}

export function avatarSrc(value) {
  return avatarOptions.find((avatar) => avatar.value === normalizeAvatar(value))?.src || avatarOptions[0].src;
}
