const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/security");
const repository = require("../services/repository");

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Token ausente." });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await repository.findUserById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado." });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}

module.exports = authMiddleware;
