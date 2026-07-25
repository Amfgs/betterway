const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { DEFAULT_SUBSCRIPTION, nextPlusPeriod, subscriptionState } = require("../utils/subscription");
const { isValidEmail, numberInRange } = require("../utils/validation");

const grantPlus = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const days = numberInRange(req.body.days || 30, 1, 3650);
  if (!isValidEmail(email) || days === null) return res.status(400).json({ message: "Informe e-mail e duração válidos." });
  const user = await repository.findUserByEmail(email, true);
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
  const subscription = nextPlusPeriod(user, { source: "admin", days: Math.round(days) });
  const updated = await repository.updateUser(user.id, { subscription });
  return res.json({ email: updated.email, subscription: subscriptionState(updated) });
});

const revokePlus = asyncHandler(async (req, res) => {
  const email = String(req.params.email || "").trim().toLowerCase();
  const user = await repository.findUserByEmail(email, true);
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
  const subscription = {
    ...DEFAULT_SUBSCRIPTION,
    trialUsedAt: user.subscription?.trialUsedAt || null,
    status: "cancelled"
  };
  const updated = await repository.updateUser(user.id, { subscription });
  return res.json({ email: updated.email, subscription: subscriptionState(updated) });
});

module.exports = { grantPlus, revokePlus };
