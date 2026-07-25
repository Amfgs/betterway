const crypto = require("node:crypto");
const { getJwtSecret } = require("../config/security");

function normalizeCpf(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function cpfSecret() {
  return String(process.env.CPF_HASH_SECRET || getJwtSecret());
}

function hashCpf(value) {
  const cpf = normalizeCpf(value);
  if (!isValidCpf(cpf)) return "";
  return crypto.createHmac("sha256", cpfSecret()).update(cpf).digest("hex");
}

function cpfIdentity(value) {
  const cpf = normalizeCpf(value);
  if (!isValidCpf(cpf)) return null;
  return {
    hash: hashCpf(cpf),
    last4: cpf.slice(-4)
  };
}

function cpfMatches(value, expectedHash) {
  const candidate = hashCpf(value);
  const expected = String(expectedHash || "");
  if (!candidate || !expected) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

module.exports = {
  cpfIdentity,
  cpfMatches,
  isValidCpf,
  normalizeCpf
};
