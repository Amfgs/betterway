const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { asNumber } = require("../utils/financial");

const list = asyncHandler(async (req, res) => {
  const limits = await repository.listLimits(req.user.id);
  return res.json({ limits });
});

const create = asyncHandler(async (req, res) => {
  const { category, amount, active, participantIds } = req.body;

  if (!category || amount === undefined) {
    return res.status(400).json({ message: "Categoria e valor do limite são obrigatórios." });
  }

  const limit = await repository.createLimit({
    userId: req.user.id,
    participantIds: Array.isArray(participantIds) ? participantIds : [],
    category,
    amount: asNumber(amount),
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

  const limit = await repository.updateLimit(req.user.id, req.params.id, fields);
  if (!limit) return res.status(404).json({ message: "Limite não encontrado." });
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
