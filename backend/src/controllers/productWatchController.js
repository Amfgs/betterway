const crypto = require("node:crypto");
const asyncHandler = require("../utils/asyncHandler");
const { runScheduledProductWatch } = require("../services/productWatchService");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

const run = asyncHandler(async (req, res) => {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return res.status(503).json({ message: "Monitoramento agendado ainda não configurado." });
  if (!safeEqual(req.get("authorization"), `Bearer ${secret}`)) {
    return res.status(401).json({ message: "Não autorizado." });
  }

  const result = await runScheduledProductWatch();
  return res.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
});

module.exports = { run };
