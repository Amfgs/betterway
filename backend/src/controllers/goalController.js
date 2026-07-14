const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const crypto = require("crypto");
const { asNumber, normalizeDateForStorage } = require("../utils/financial");

const list = asyncHandler(async (req, res) => {
  const goals = await repository.listGoals(req.user.id);
  return res.json({ goals });
});

const create = asyncHandler(async (req, res) => {
  const { name, targetAmount, currentAmount, dueDate, participantIds } = req.body;
  if (!name || !targetAmount || !dueDate) {
    return res.status(400).json({ message: "Nome, valor alvo e prazo são obrigatórios." });
  }

  const goal = await repository.createGoal({
    userId: req.user.id,
    participantIds: Array.isArray(participantIds) ? participantIds : [],
    name,
    targetAmount: asNumber(targetAmount),
    currentAmount: asNumber(currentAmount),
    movements: [],
    dueDate: normalizeDateForStorage(dueDate)
  });

  return res.status(201).json({ goal });
});

const update = asyncHandler(async (req, res) => {
  const fields = ["name", "targetAmount", "currentAmount", "dueDate", "participantIds"].reduce((acc, key) => {
    if (req.body[key] !== undefined) {
      if (["targetAmount", "currentAmount"].includes(key)) acc[key] = asNumber(req.body[key]);
      else if (key === "participantIds") acc[key] = Array.isArray(req.body[key]) ? req.body[key] : [];
      else if (key === "dueDate") acc[key] = normalizeDateForStorage(req.body[key]);
      else acc[key] = req.body[key];
    }
    return acc;
  }, {});

  const goal = await repository.updateGoal(req.user.id, req.params.id, fields);
  if (!goal) return res.status(404).json({ message: "Meta não encontrada." });
  return res.json({ goal });
});

const movement = asyncHandler(async (req, res) => {
  const { type, amount, notes } = req.body;
  const movementType = type === "withdraw" ? "withdraw" : "deposit";
  const movementAmount = Math.abs(asNumber(amount));

  if (!movementAmount) {
    return res.status(400).json({ message: "Informe um valor válido para movimentar a meta." });
  }

  const goal = await repository.addGoalMovement(req.user.id, req.params.id, {
    id: crypto.randomUUID(),
    userId: req.user.id,
    type: movementType,
    amount: movementAmount,
    notes: notes || "",
    createdAt: new Date().toISOString()
  });

  if (!goal) return res.status(404).json({ message: "Meta não encontrada." });
  return res.status(201).json({ goal, movement: goal.movements?.[0] || null });
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await repository.deleteGoal(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: "Meta não encontrada." });
  return res.status(204).send();
});

module.exports = {
  list,
  create,
  update,
  movement,
  remove
};
