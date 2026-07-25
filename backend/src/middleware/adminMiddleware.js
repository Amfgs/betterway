const crypto = require("node:crypto");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function adminMiddleware(req, res, next) {
  const configured = String(process.env.ADMIN_API_KEY || "");
  const authorization = String(req.get("authorization") || "");
  const supplied = String(req.get("x-admin-key") || (authorization.startsWith("Bearer ") ? authorization.slice(7) : ""));
  if (!configured) return res.status(503).json({ message: "A administração de planos ainda não foi configurada." });
  if (!safeEqual(supplied, configured)) return res.status(401).json({ message: "Não autorizado." });
  return next();
}

module.exports = adminMiddleware;
