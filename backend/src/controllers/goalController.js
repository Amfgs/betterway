const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const crypto = require("crypto");
const { asNumber, normalizeDateForStorage } = require("../utils/financial");
const { cleanText, isValidDateKey, numberInRange, uniqueIds } = require("../utils/validation");

async function authorizedParticipants(userId, participantIds) {
  const requested = uniqueIds(participantIds, userId);
  const accepted = new Set(await repository.getAcceptedFriendIds(userId));
  if (requested.some((id) => !accepted.has(id))) return null;
  return requested;
}

const list = asyncHandler(async (req, res) => {
  const goals = await repository.listGoals(req.user.id);
  return res.json({ goals });
});

const create = asyncHandler(async (req, res) => {
  const { name, targetAmount, currentAmount, dueDate, participantIds } = req.body;
  const cleanName = cleanText(name, 120);
  const target = numberInRange(targetAmount, 0.01, 1e15);
  const current = numberInRange(currentAmount === undefined || currentAmount === "" ? 0 : currentAmount, 0, 1e15);
  if (!cleanName || target === null || current === null || current > target || !isValidDateKey(dueDate)) {
    return res.status(400).json({ message: "Nome, valor alvo e prazo são obrigatórios." });
  }
  const participants = await authorizedParticipants(req.user.id, participantIds);
  if (!participants) return res.status(403).json({ message: "Metas só podem ser compartilhadas com amizades aceitas." });

  const goal = await repository.createGoal({
    userId: req.user.id,
    participantIds: participants,
    name: cleanName,
    targetAmount: target,
    currentAmount: current,
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

  if (fields.name !== undefined) fields.name = cleanText(fields.name, 120);
  if (fields.dueDate !== undefined && !isValidDateKey(req.body.dueDate)) {
    return res.status(400).json({ message: "Informe um prazo válido para a meta." });
  }
  if (fields.targetAmount !== undefined && numberInRange(fields.targetAmount, 0.01, 1e15) === null) {
    return res.status(400).json({ message: "Informe um valor alvo válido." });
  }
  if (fields.currentAmount !== undefined && numberInRange(fields.currentAmount, 0, 1e15) === null) {
    return res.status(400).json({ message: "Informe um valor atual válido." });
  }
  if (fields.participantIds !== undefined) {
    const participants = await authorizedParticipants(req.user.id, fields.participantIds);
    if (!participants) return res.status(403).json({ message: "Metas só podem ser compartilhadas com amizades aceitas." });
    fields.participantIds = participants;
  }
  const existingGoal = (await repository.listGoals(req.user.id)).find((goal) => {
    return String(goal.id) === String(req.params.id) && String(goal.userId) === String(req.user.id);
  });
  if (!existingGoal) return res.status(404).json({ message: "Meta não encontrada ou sem permissão para editar." });
  const nextTarget = fields.targetAmount ?? Number(existingGoal.targetAmount || 0);
  const nextCurrent = fields.currentAmount ?? Number(existingGoal.currentAmount || 0);
  if (nextCurrent > nextTarget) {
    return res.status(400).json({ message: "O valor atual da meta não pode superar o valor alvo." });
  }

  const goal = await repository.updateGoal(req.user.id, req.params.id, fields);
  if (!goal) return res.status(404).json({ message: "Meta não encontrada ou sem permissão para editar." });
  return res.json({ goal });
});

const movement = asyncHandler(async (req, res) => {
  const { type, amount, notes } = req.body;
  const movementType = type === "withdraw" ? "withdraw" : "deposit";
  const movementAmount = numberInRange(amount, 0.01, 1e15);

  if (movementAmount === null) {
    return res.status(400).json({ message: "Informe um valor válido para movimentar a meta." });
  }

  const goal = await repository.addGoalMovement(req.user.id, req.params.id, {
    id: crypto.randomUUID(),
    userId: req.user.id,
    type: movementType,
    amount: movementAmount,
    notes: cleanText(notes, 500),
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
