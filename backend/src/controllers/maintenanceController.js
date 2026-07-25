const crypto = require("node:crypto");
const asyncHandler = require("../utils/asyncHandler");
const { runScheduledProductWatch } = require("../services/productWatchService");
const { runScheduledReports } = require("../services/reportService");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

const run = asyncHandler(async (req, res) => {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return res.status(503).json({ message: "Rotina agendada ainda não configurada." });
  if (!safeEqual(req.get("authorization"), `Bearer ${secret}`)) {
    return res.status(401).json({ message: "Não autorizado." });
  }

  const [products, reports] = await Promise.allSettled([
    runScheduledProductWatch(),
    runScheduledReports()
  ]);
  return res.json({
    ok: products.status === "fulfilled" && reports.status === "fulfilled",
    products: products.status === "fulfilled" ? products.value : { failed: true },
    reports: reports.status === "fulfilled" ? reports.value : { failed: true },
    checkedAt: new Date().toISOString()
  });
});

module.exports = { run };
