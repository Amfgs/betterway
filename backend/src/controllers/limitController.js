const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { asNumber } = require("../utils/financial");
const { cleanText, numberInRange, uniqueIds } = require("../utils/validation");

async function authorizedParticipants(userId, participantIds) {
  const requested = uniqueIds(participantIds, userId);
  const accepted = new Set(await repository.getAcceptedFriendIds(userId));
  if (requested.some((id) => !accepted.has(id))) return null;
  return requested;
}

const list = asyncHandler(async (req, res) => {
  const limits = await repository.listLimits(req.user.id);
  return res.json({ limits });
});

const create = asyncHandler(async (req, res) => {
  const { category, amount, active, participantIds } = req.body;

  const cleanCategory = cleanText(category, 80);
  const validAmount = numberInRange(amount, 0.01, 1e15);
  if (!cleanCategory || validAmount === null) {
    return res.status(400).json({ message: "Categoria e valor do limite são obrigatórios." });
  }
  const participants = await authorizedParticipants(req.user.id, participantIds);
  if (!participants) return res.status(403).json({ message: "Limites só podem ser compartilhados com amizades aceitas." });

  const limit = await repository.createLimit({
    userId: req.user.id,
    participantIds: participants,
    category: cleanCategory,
    amount: validAmount,
    active: active !== false
  });

  return res.status(201).json({ limit });
});

const update = asyncHandler(async (req, res) => {
  const fields = ["category", "amount", "active", "participantIds"].reduce((acc, key) => {
    if (req.body[key] !== undefined) {
      if (key === "amount") acc[key] = asNumber(req.body[key]);
      else if (key === "participantIds") acc[key] = Array.isArray(req.body[key]) ? req.body[key] : [];
      else acc[key] = req.body[key];
    }
    return acc;
  }, {});

  if (fields.category !== undefined) {
    fields.category = cleanText(fields.category, 80);
    if (!fields.category) return res.status(400).json({ message: "Informe uma categoria válida." });
  }
  if (fields.amount !== undefined && numberInRange(fields.amount, 0.01, 1e15) === null) {
    return res.status(400).json({ message: "Informe um valor de limite válido." });
  }
  if (fields.participantIds !== undefined) {
    const participants = await authorizedParticipants(req.user.id, fields.participantIds);
    if (!participants) return res.status(403).json({ message: "Limites só podem ser compartilhados com amizades aceitas." });
    fields.participantIds = participants;
  }
  if (fields.active !== undefined && typeof fields.active !== "boolean") {
    return res.status(400).json({ message: "O estado do limite precisa ser verdadeiro ou falso." });
  }

  const limit = await repository.updateLimit(req.user.id, req.params.id, fields);
  if (!limit) return res.status(404).json({ message: "Limite não encontrado ou sem permissão para editar." });
  return res.json({ limit });
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await repository.deleteLimit(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: "Limite não encontrado." });
  return res.status(204).send();
});

module.exports = {
  list,
  create,
  update,
  remove
};
