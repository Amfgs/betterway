const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getJwtSecret, isProduction } = require("../config/security");
const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const {
  sendEmailVerification,
  sendPasswordResetEmail,
  emailConfigured
} = require("../services/emailService");
const {
  cleanText,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  numberInRange
} = require("../utils/validation");

const STANDARD_WORKDAYS_PER_MONTH = 22;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const AVATAR_VALUES = new Set(["aurora", "verde", "solar", "indigo", "grafite"]);

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      ver: Number(user.authVersion || 0)
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: "7d"
    }
  );
}

function cleanUser(user) {
  const copy = { ...user };
  delete copy.passwordHash;
  delete copy.resetPasswordHash;
  delete copy.resetPasswordExpiresAt;
  delete copy.resetPasswordAttempts;
  delete copy.resetPasswordSentAt;
  delete copy.emailVerificationHash;
  delete copy.emailVerificationExpiresAt;
  delete copy.emailVerificationAttempts;
  delete copy.emailVerificationSentAt;
  return copy;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createVerificationCode() {
  return String(crypto.randomInt(10000000, 100000000));
}

function validPassword(value) {
  return (
    typeof value === "string" &&
    value.length >= MIN_PASSWORD_LENGTH &&
    Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES
  );
}

function passwordRequirementMessage(prefix = "A senha") {
  return `${prefix} precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres e no máximo ${MAX_PASSWORD_BYTES} bytes.`;
}

function sentRecently(value) {
  return value && Date.now() - new Date(value).getTime() < EMAIL_RESEND_COOLDOWN_MS;
}

async function issueVerificationCode(user) {
  const verificationToken = createVerificationCode();
  await repository.updateUser(user.id, {
    emailVerificationHash: hashToken(verificationToken),
    emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    emailVerificationAttempts: 0,
    emailVerificationSentAt: new Date().toISOString()
  });
  await sendEmailVerification({ email: user.email, name: user.name, token: verificationToken });
  return verificationToken;
}

const register = asyncHandler(async (req, res) => {
  const { name, username, email, password, confirmPassword, salary, monthlyLimit, hourlyRate, workHoursPerDay } = req.body;

  const cleanName = cleanText(name, 120);
  const normalizedUsername = normalizeUsername(username);
  if (!cleanName || !normalizedUsername || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: "Nome, usuário, e-mail, senha e confirmação são obrigatórios." });
  }
  if (!isValidUsername(normalizedUsername)) {
    return res.status(400).json({
      message: "O nome de usuário deve ter de 3 a 24 caracteres e usar apenas letras, números, ponto ou sublinhado."
    });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ message: passwordRequirementMessage() });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "As senhas não coincidem." });
  }
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }
  const salaryValue = Number(salary || 0);
  const monthlyLimitValue = Number(monthlyLimit || 0);
  const workHoursValue = Number(workHoursPerDay === undefined || workHoursPerDay === "" ? 8 : workHoursPerDay);
  if (!Number.isFinite(salaryValue) || salaryValue < 0 || !Number.isFinite(monthlyLimitValue) || monthlyLimitValue < 0) {
    return res.status(400).json({ message: "Salário e teto mensal precisam ser valores válidos." });
  }
  if (!Number.isFinite(workHoursValue) || workHoursValue <= 0 || workHoursValue > 24) {
    return res.status(400).json({ message: "As horas trabalhadas por dia precisam estar entre 1 e 24." });
  }
  if (isProduction() && !emailConfigured()) {
    return res.status(503).json({ message: "O cadastro está temporariamente indisponível porque a entrega de e-mail não foi configurada." });
  }

  const exists = await repository.findUserByEmail(normalizedEmail, true);
  if (exists) {
    return res.status(409).json({ code: "EMAIL_EXISTS", message: "Este e-mail já está cadastrado." });
  }
  const usernameExists = await repository.findUserByUsername(normalizedUsername, true);
  if (usernameExists) {
    return res.status(409).json({ code: "USERNAME_EXISTS", message: "Este nome de usuário já está em uso." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const calculatedHourlyRate = salaryValue > 0
    ? Number((salaryValue / (workHoursValue * STANDARD_WORKDAYS_PER_MONTH)).toFixed(2))
    : Math.max(Number(hourlyRate || 0), 0);
  const user = await repository.createUser({
    name: cleanName,
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    emailVerified: false,
    emailVerifiedAt: null,
    salary: salaryValue,
    monthlyLimit: monthlyLimitValue,
    hourlyRate: calculatedHourlyRate,
    workHoursPerDay: workHoursValue
  });
  const verificationToken = await issueVerificationCode(user);

  return res.status(201).json({
    email: user.email,
    message: emailConfigured()
      ? "Conta criada. Enviamos um código para confirmar seu e-mail."
      : "Conta criada. No ambiente local, o código foi preenchido automaticamente.",
    devVerificationToken: !isProduction() && !emailConfigured() ? verificationToken : undefined
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!isValidEmail(email) || !validPassword(password)) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const user = await repository.findUserByEmail(normalizeEmail(email), true);
  if (!user) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }
  if (user.emailVerified === false) {
    return res.status(403).json({
      code: "EMAIL_NOT_VERIFIED",
      message: "Confirme seu e-mail antes de entrar."
    });
  }

  return res.json({
    token: signToken(user),
    user: cleanUser(user)
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, token } = req.body;

  if (!isValidEmail(email) || !/^\d{8}$/.test(String(token || ""))) {
    return res.status(400).json({ message: "E-mail e código de verificação são obrigatórios." });
  }

  const user = await repository.findUserByEmail(normalizeEmail(email), true);
  if (!user) {
    return res.status(400).json({ message: "Código de verificação inválido ou expirado." });
  }
  if (user.emailVerified !== false) {
    return res.status(409).json({ code: "EMAIL_ALREADY_VERIFIED", message: "Este e-mail já foi confirmado. Entre normalmente." });
  }

  const expired = user.emailVerificationExpiresAt && new Date(user.emailVerificationExpiresAt).getTime() < Date.now();
  const tokenMatches = user.emailVerificationHash && user.emailVerificationHash === hashToken(token);
  if (expired || !tokenMatches) {
    const attempts = Number(user.emailVerificationAttempts || 0) + 1;
    const locked = attempts >= MAX_CODE_ATTEMPTS;
    await repository.updateUser(user.id, {
      emailVerificationAttempts: attempts,
      ...(locked ? { emailVerificationHash: "", emailVerificationExpiresAt: null } : {})
    });
    return res.status(400).json({
      message: locked
        ? "O código foi bloqueado após muitas tentativas. Solicite um novo código."
        : "Código de verificação inválido ou expirado."
    });
  }

  const verifiedUser = await repository.updateUser(user.id, {
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    emailVerificationHash: "",
    emailVerificationExpiresAt: null,
    emailVerificationAttempts: 0,
    emailVerificationSentAt: null
  });

  return res.json({
    message: "E-mail confirmado. Sua conta está pronta.",
    token: signToken(verifiedUser),
    user: cleanUser(verifiedUser)
  });
});

const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Informe o e-mail da conta." });
  }
  if (isProduction() && !emailConfigured()) {
    return res.status(503).json({ message: "A entrega de e-mail está temporariamente indisponível." });
  }

  const user = await repository.findUserByEmail(normalizeEmail(email), true);
  if (!user || user.emailVerified !== false) {
    return res.json({ message: "Se a conta estiver pendente, enviaremos um novo código." });
  }
  if (sentRecently(user.emailVerificationSentAt)) {
    return res.json({ message: "Se a conta estiver pendente, enviaremos um novo código." });
  }

  const verificationToken = await issueVerificationCode(user);
  return res.json({
    message: emailConfigured()
      ? "Enviamos um novo código de verificação."
      : "No ambiente local, o novo código foi preenchido automaticamente.",
    devVerificationToken: !isProduction() && !emailConfigured() ? verificationToken : undefined
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const genericMessage = "Se o e-mail estiver cadastrado, enviaremos um código de redefinição.";

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }

  if (isProduction() && !emailConfigured()) {
    return res.status(503).json({ message: "A recuperação por e-mail está temporariamente indisponível." });
  }

  const user = await repository.findUserByEmail(normalizeEmail(email), true);
  if (!user) {
    return res.json({ message: genericMessage });
  }
  if (sentRecently(user.resetPasswordSentAt)) {
    return res.json({ message: genericMessage });
  }

  const resetToken = createVerificationCode();
  await repository.updateUser(user.id, {
    resetPasswordHash: hashToken(resetToken),
    resetPasswordExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    resetPasswordAttempts: 0,
    resetPasswordSentAt: new Date().toISOString()
  });
  await sendPasswordResetEmail({ email: user.email, name: user.name, token: resetToken });

  return res.json({
    message: emailConfigured() ? genericMessage : "No ambiente local, o código foi preenchido automaticamente.",
    devResetToken: !isProduction() && !emailConfigured() ? resetToken : undefined
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;

  if (!isValidEmail(email) || !/^\d{8}$/.test(String(token || "")) || !newPassword) {
    return res.status(400).json({ message: "E-mail, código e nova senha são obrigatórios." });
  }
  if (!validPassword(newPassword)) {
    return res.status(400).json({ message: passwordRequirementMessage("A nova senha") });
  }

  const user = await repository.findUserByEmail(normalizeEmail(email), true);
  const expired = user?.resetPasswordExpiresAt && new Date(user.resetPasswordExpiresAt).getTime() < Date.now();
  const tokenMatches = user?.resetPasswordHash && user.resetPasswordHash === hashToken(token);
  if (!user || expired || !tokenMatches) {
    if (user) {
      const attempts = Number(user.resetPasswordAttempts || 0) + 1;
      const locked = attempts >= MAX_CODE_ATTEMPTS;
      await repository.updateUser(user.id, {
        resetPasswordAttempts: attempts,
        ...(locked ? { resetPasswordHash: "", resetPasswordExpiresAt: null } : {})
      });
    }
    return res.status(400).json({ message: "Código de redefinição inválido ou expirado." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await repository.updateUser(user.id, {
    passwordHash,
    resetPasswordHash: "",
    resetPasswordExpiresAt: null,
    resetPasswordAttempts: 0,
    resetPasswordSentAt: null,
    authVersion: Number(user.authVersion || 0) + 1
  });

  return res.json({ message: "Senha redefinida. Entre usando a nova senha." });
});

const me = asyncHandler(async (req, res) => {
  return res.json({ user: req.user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, email } = req.body;
  const allowed = ["name", "username", "salary", "monthlyLimit", "hourlyRate", "workHoursPerDay", "theme", "avatarUrl"];
  const fields = allowed.reduce((acc, key) => {
    if (req.body[key] !== undefined) acc[key] = req.body[key];
    return acc;
  }, {});
  const normalizedEmail = email === undefined ? req.user.email : normalizeEmail(email);
  const emailChanged = normalizedEmail !== normalizeEmail(req.user.email);
  const sensitiveChange = Boolean(newPassword || emailChanged);
  let userWithPassword = null;

  if (fields.name !== undefined) {
    fields.name = cleanText(fields.name, 120);
    if (!fields.name) return res.status(400).json({ message: "Informe um nome válido." });
  }
  if (fields.username !== undefined) {
    fields.username = normalizeUsername(fields.username);
    if (!isValidUsername(fields.username)) {
      return res.status(400).json({
        message: "O nome de usuário deve ter de 3 a 24 caracteres e usar apenas letras, números, ponto ou sublinhado."
      });
    }
    const existingUsername = await repository.findUserByUsername(fields.username, true);
    if (existingUsername && String(existingUsername.id) !== String(req.user.id)) {
      return res.status(409).json({ code: "USERNAME_EXISTS", message: "Este nome de usuário já está em uso." });
    }
  }
  for (const key of ["salary", "monthlyLimit", "hourlyRate"]) {
    if (fields[key] !== undefined) {
      const number = numberInRange(fields[key], 0, 1e15);
      if (number === null) return res.status(400).json({ message: "Os dados financeiros precisam ser valores válidos." });
      fields[key] = number;
    }
  }
  if (fields.workHoursPerDay !== undefined) {
    const hours = numberInRange(fields.workHoursPerDay, 1, 24);
    if (hours === null) return res.status(400).json({ message: "As horas trabalhadas por dia precisam estar entre 1 e 24." });
    fields.workHoursPerDay = hours;
  }
  if (fields.theme !== undefined && !["light", "dark"].includes(fields.theme)) {
    return res.status(400).json({ message: "Tema inválido." });
  }
  if (fields.avatarUrl !== undefined && !AVATAR_VALUES.has(fields.avatarUrl)) {
    return res.status(400).json({ message: "Selecione um avatar disponível na Better Way." });
  }

  if (sensitiveChange) {
    if (!currentPassword) {
      return res.status(400).json({ message: "Informe a senha atual para alterar e-mail ou senha." });
    }
    userWithPassword = await repository.findUserById(req.user.id, true);
    const valid = validPassword(currentPassword) && userWithPassword?.passwordHash && await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
    if (!valid) return res.status(401).json({ message: "Senha atual incorreta." });
  }

  if (emailChanged) {
    if (!isValidEmail(normalizedEmail)) return res.status(400).json({ message: "Informe um e-mail válido." });
    if (isProduction() && !emailConfigured()) {
      return res.status(503).json({ message: "A alteração de e-mail está indisponível até a entrega de e-mail ser configurada." });
    }
    const existing = await repository.findUserByEmail(normalizedEmail, true);
    if (existing && String(existing.id) !== String(req.user.id)) {
      return res.status(409).json({ message: "Este e-mail já está cadastrado." });
    }
    fields.email = normalizedEmail;
    fields.emailVerified = false;
    fields.emailVerifiedAt = null;
  }

  if (newPassword) {
    if (!validPassword(newPassword)) {
      return res.status(400).json({ message: passwordRequirementMessage("A nova senha") });
    }
    fields.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (sensitiveChange) fields.authVersion = Number(userWithPassword.authVersion || 0) + 1;

  const user = await repository.updateUser(req.user.id, fields);
  if (emailChanged) {
    const verificationToken = await issueVerificationCode(user);
    return res.json({
      requiresEmailVerification: true,
      email: user.email,
      message: emailConfigured()
        ? "E-mail alterado. Enviamos um código para confirmar o novo endereço."
        : "E-mail alterado. No ambiente local, o código foi preenchido automaticamente.",
      devVerificationToken: !isProduction() && !emailConfigured() ? verificationToken : undefined
    });
  }

  return res.json({
    user,
    token: sensitiveChange ? signToken(user) : undefined
  });
});

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me,
  updateProfile
};
