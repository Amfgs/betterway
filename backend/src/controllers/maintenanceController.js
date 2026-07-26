const crypto = require("node:crypto");
const asyncHandler = require("../utils/asyncHandler");
const { runScheduledProductWatch } = require("../services/productWatchService");
const { runScheduledReports } = require("../services/reportService");
const { runDailyEntryReminders } = require("../services/dailyReminderService");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function authorizeCron(req, res) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) {
    res.status(503).json({ message: "Rotina agendada ainda não configurada." });
    return false;
  }
  if (!safeEqual(req.get("authorization"), `Bearer ${secret}`)) {
    res.status(401).json({ message: "Não autorizado." });
    return false;
  }
  return true;
}

const run = asyncHandler(async (req, res) => {
  if (!authorizeCron(req, res)) return;

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

const dailyReminders = asyncHandler(async (req, res) => {
  if (!authorizeCron(req, res)) return;
  const reminders = await runDailyEntryReminders();
  return res.json({
    ok: reminders.failed === 0,
    reminders,
    checkedAt: new Date().toISOString()
  });
});

module.exports = { dailyReminders, run };
