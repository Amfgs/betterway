const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getJwtSecret, isProduction } = require("../config/security");
const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { sendPasswordResetEmail, smtpConfigured } = require("../services/emailService");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    getJwtSecret(),
    {
      expiresIn: "7d"
    }
  );
}

function cleanUser(user) {
  const copy = { ...user };
  delete copy.passwordHash;
  return copy;
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, salary, monthlyLimit, hourlyRate } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nome, e-mail e senha são obrigatórios." });
  }

  const exists = await repository.findUserByEmail(email, true);
  if (exists) {
    return res.status(409).json({ message: "Este e-mail já está cadastrado." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repository.createUser({
    name,
    email,
    passwordHash,
    salary,
    monthlyLimit,
    hourlyRate
  });

  return res.status(201).json({
    token: signToken(user),
    user: cleanUser(user)
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await repository.findUserByEmail(email, true);
  if (!user) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  return res.json({
    token: signToken(user),
    user: cleanUser(user)
  });
});

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Informe o e-mail da conta." });
  }

  if (isProduction() && !smtpConfigured()) {
    return res.status(503).json({ message: "A recuperação por e-mail está temporariamente indisponível." });
  }

  const user = await repository.findUserByEmail(email, true);
  if (!user) {
    return res.json({ message: "Se o e-mail estiver cadastrado, enviaremos um link de redefinição." });
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  await repository.updateUser(user.id, {
    resetPasswordHash: hashResetToken(resetToken),
    resetPasswordExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  });
  await sendPasswordResetEmail({ email: user.email, name: user.name, token: resetToken });

  return res.json({
    message: smtpConfigured()
      ? "Enviamos um e-mail com o link para redefinir sua senha."
      : "SMTP não configurado. Use o código de desenvolvimento retornado para redefinir a senha.",
    devResetToken: !isProduction() && !smtpConfigured() ? resetToken : undefined
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: "E-mail, código e nova senha são obrigatórios." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "A nova senha precisa ter pelo menos 6 caracteres." });
  }

  const user = await repository.findUserByEmail(email, true);
  const expired = user?.resetPasswordExpiresAt && new Date(user.resetPasswordExpiresAt).getTime() < Date.now();
  const tokenMatches = user?.resetPasswordHash && user.resetPasswordHash === hashResetToken(String(token));
  if (!user || expired || !tokenMatches) {
    return res.status(400).json({ message: "Código de redefinição inválido ou expirado." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await repository.updateUser(user.id, {
    passwordHash,
    resetPasswordHash: "",
    resetPasswordExpiresAt: null
  });

  return res.json({ message: "Senha redefinida. Entre usando a nova senha." });
});

const me = asyncHandler(async (req, res) => {
  return res.json({ user: req.user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, email } = req.body;
  const allowed = ["name", "salary", "monthlyLimit", "hourlyRate", "theme", "avatarUrl"];
  const fields = allowed.reduce((acc, key) => {
    if (req.body[key] !== undefined) acc[key] = req.body[key];
    return acc;
  }, {});

  if (email !== undefined && String(email).toLowerCase() !== String(req.user.email).toLowerCase()) {
    const existing = await repository.findUserByEmail(email, true);
    if (existing && String(existing.id) !== String(req.user.id)) {
      return res.status(409).json({ message: "Este e-mail já está cadastrado." });
    }
    fields.email = String(email).toLowerCase();
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ message: "Informe a senha atual para definir uma nova senha." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "A nova senha precisa ter pelo menos 6 caracteres." });
    }
    const userWithPassword = await repository.findUserById(req.user.id, true);
    const valid = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Senha atual incorreta." });
    }
    fields.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const user = await repository.updateUser(req.user.id, fields);
  return res.json({ user });
});

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
  updateProfile
};
