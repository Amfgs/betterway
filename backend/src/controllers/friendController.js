const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { isValidUsername, normalizeUsername } = require("../utils/validation");

const list = asyncHandler(async (req, res) => {
  const friendships = await repository.listFriendships(req.user.id);
  return res.json(friendships);
});

const create = asyncHandler(async (req, res) => {
  const username = normalizeUsername(req.body.username);
  if (!isValidUsername(username)) {
    return res.status(400).json({ message: "Informe um nome de usuário válido." });
  }

  const result = await repository.requestFriend(req.user.id, username);
  if (!result) {
    return res.status(202).json({
      status: "pending",
      message: "Se esse nome de usuário existir, o pedido ficará disponível para aceite."
    });
  }

  const messages = {
    pending: "Pedido de amizade enviado.",
    accepted: "Amizade aceita porque já havia um pedido dessa pessoa.",
    existing: "Essa pessoa já está na sua lista de amigos."
  };
  return res.status(result.status === "pending" ? 202 : 200).json({
    status: result.status,
    user: result.user,
    message: messages[result.status]
  });
});

const accept = asyncHandler(async (req, res) => {
  const friend = await repository.acceptFriend(req.user.id, req.params.id);
  if (!friend) return res.status(404).json({ message: "Pedido de amizade não encontrado." });
  return res.json({ friend, message: "Pedido de amizade aceito." });
});

const removeRequest = asyncHandler(async (req, res) => {
  await repository.deleteFriendRequest(req.user.id, req.params.id);
  return res.status(204).send();
});

const remove = asyncHandler(async (req, res) => {
  await repository.deleteFriend(req.user.id, req.params.id);
  return res.status(204).send();
});

module.exports = {
  list,
  create,
  accept,
  removeRequest,
  remove
};
