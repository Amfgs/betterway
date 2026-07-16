import avatarAurora from "../assets/avatars/avatar-aurora.webp";
import avatarGrafite from "../assets/avatars/avatar-grafite.webp";
import avatarIndigo from "../assets/avatars/avatar-indigo.webp";
import avatarSolar from "../assets/avatars/avatar-solar.webp";
import avatarVerde from "../assets/avatars/avatar-verde.webp";

export const avatarOptions = [
  { label: "Aurora", value: "aurora", src: avatarAurora },
  { label: "Pulso", value: "verde", src: avatarVerde },
  { label: "Faísca", value: "solar", src: avatarSolar },
  { label: "Horizonte", value: "indigo", src: avatarIndigo },
  { label: "Brisa", value: "grafite", src: avatarGrafite }
];

const avatarValues = new Set(avatarOptions.map((avatar) => avatar.value));

export function normalizeAvatar(value) {
  return avatarValues.has(value) ? value : avatarOptions[0].value;
}

export function avatarSrc(value) {
  return avatarOptions.find((avatar) => avatar.value === normalizeAvatar(value))?.src || avatarOptions[0].src;
}
