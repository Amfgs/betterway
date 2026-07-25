const crypto = require("node:crypto");
const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { buildReport, runScheduledReports, sendUserReport } = require("../services/reportService");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

const preview = asyncHandler(async (req, res) => {
  const frequency = req.query.frequency === "monthly" ? "monthly" : "weekly";
  return res.json({ report: await buildReport(req.user.id, frequency) });
});

const sendNow = asyncHandler(async (req, res) => {
  const frequency = req.body.frequency === "monthly" ? "monthly" : "weekly";
  const user = await repository.findUserById(req.user.id);
  const sent = await sendUserReport(user, frequency);
  return res.json({ sent, message: sent ? "Relatório enviado para seu e-mail." : "Este relatório já foi enviado ou está desativado." });
});

const run = asyncHandler(async (req, res) => {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return res.status(503).json({ message: "Relatórios agendados ainda não configurados." });
  if (!safeEqual(req.get("authorization"), `Bearer ${secret}`)) return res.status(401).json({ message: "Não autorizado." });
  return res.json({ ok: true, ...(await runScheduledReports()), checkedAt: new Date().toISOString() });
});

module.exports = { preview, run, sendNow };
