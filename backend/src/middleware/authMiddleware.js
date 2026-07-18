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

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    const user = await repository.findUserById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado." });
    }
    if (Number(decoded.ver || 0) !== Number(user.authVersion || 0)) {
      return res.status(401).json({ message: "Sua sessão foi encerrada após uma alteração de segurança." });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Confirme seu e-mail antes de acessar a conta."
      });
    }

    const sessionStartedAt = Number(decoded.sst || decoded.iat || 0);
    if (!sessionStartedAt || sessionStartedAt > Math.floor(Date.now() / 1000) + 300) {
      return res.status(401).json({ message: "Sessão inválida ou expirada." });
    }

    req.user = user;
    req.auth = { sessionStartedAt };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}

module.exports = authMiddleware;
