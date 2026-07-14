const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");

const list = asyncHandler(async (req, res) => {
  const friends = await repository.listFriends(req.user.id);
  return res.json({ friends });
});

const create = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email do amigo e obrigatorio." });

  const friend = await repository.addFriend(req.user.id, email);
  if (!friend) return res.status(404).json({ message: "Usuário não encontrado para adicionar como amigo." });

  return res.status(201).json({ friend });
});

const remove = asyncHandler(async (req, res) => {
  await repository.deleteFriend(req.user.id, req.params.id);
  return res.status(204).send();
});

module.exports = {
  list,
  create,
  remove
};
