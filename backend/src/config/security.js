function isProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    if (isProduction() && String(process.env.JWT_SECRET).length < 32) {
      throw new Error("JWT_SECRET precisa ter ao menos 32 caracteres em produção.");
    }
    return process.env.JWT_SECRET;
  }
  if (isProduction()) throw new Error("JWT_SECRET é obrigatória em produção.");
  return "dev-secret";
}

function allowedOrigins() {
  return String(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

module.exports = {
  allowedOrigins,
  getJwtSecret,
  isProduction
};
