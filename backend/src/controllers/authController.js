const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
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
  availableUsername,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  numberInRange
} = require("../utils/validation");
const { AVATAR_VALUES } = require("../utils/avatars");

const STANDARD_WORKDAYS_PER_MONTH = 22;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const SESSION_TTL_SECONDS = 15 * 24 * 60 * 60;
const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailEnabled: true,
  limitAlerts: true,
  goalAlerts: true,
  limitThreshold: 80
};
const DEFAULT_ONBOARDING = {
  avatarPromptDismissed: false,
  bankPromptDismissed: false,
  installPromptDismissed: false,
  installCompleted: false,
  simulatedInvestment: false,
  viewedNews: false
};
function normalizeSessionStart(value) {
  const now = Math.floor(Date.now() / 1000);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > now + 300) return now;
  return Math.floor(parsed);
}

function signToken(user, sessionStartedAt) {
  const sessionStart = normalizeSessionStart(sessionStartedAt);
  return jwt.sign(
    {
      sub: user.id,
      ver: Number(user.authVersion || 0),
      sst: sessionStart,
      exp: sessionStart + SESSION_TTL_SECONDS
    },
    getJwtSecret(),
    {
      algorithm: "HS256"
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
  delete copy.googleSubject;
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

function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

async function createGoogleUsername(name, email) {
  const seed = String(email || "").split("@")[0] || name || "usuario";
  const attempted = new Set();

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = availableUsername(seed, attempted);
    if (!(await repository.findUserByUsername(candidate))) return candidate;
    attempted.add(candidate);
  }

  throw new Error("Não foi possível gerar um nome de usuário disponível.");
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

const usernameAvailability = asyncHandler(async (req, res) => {
  const username = normalizeUsername(req.query.username);

  if (!username) {
    return res.status(400).json({
      available: false,
      valid: false,
      message: "Informe um nome de usuário."
    });
  }

  if (!isValidUsername(username)) {
    return res.json({
      username,
      available: false,
      valid: false,
      message: "Use de 3 a 24 caracteres, começando e terminando com letra ou número, sem símbolos repetidos."
    });
  }

  const existingUser = await repository.findUserByUsername(username);
  const available = !existingUser;
  return res.json({
    username,
    available,
    valid: true,
    message: available ? "Nome de usuário disponível." : "Este nome de usuário já está em uso."
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
    sessionExpiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    user: cleanUser(user)
  });
});

const authProviders = asyncHandler(async (req, res) => {
  return res.json({ google: Boolean(googleClientId()) });
});

const googleLogin = asyncHandler(async (req, res) => {
  const clientId = googleClientId();
  const credential = String(req.body?.credential || "");

  if (!clientId) {
    return res.status(503).json({ message: "O acesso com Google ainda não foi configurado." });
  }
  if (!credential || credential.length > 12_000) {
    return res.status(400).json({ message: "A credencial do Google é inválida." });
  }

  let payload;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: "Não foi possível validar o acesso com Google." });
  }

  if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
    return res.status(401).json({ message: "Use uma conta Google com e-mail verificado." });
  }

  const subject = String(payload.sub);
  const email = normalizeEmail(payload.email);
  const name = cleanText(payload.name || email.split("@")[0], 120);
  let user = await repository.findUserByGoogleSubject(subject);

  if (user && normalizeEmail(user.email) !== email) {
    return res.status(409).json({
      message: "Esta conta Google está vinculada a outro e-mail na Better Way. Entre com e-mail e senha."
    });
  }

  if (!user) {
    const existing = await repository.findUserByEmail(email, true);
    if (existing?.googleSubject && existing.googleSubject !== subject) {
      return res.status(409).json({ message: "Este e-mail já está vinculado a outra conta Google." });
    }

    if (existing) {
      user = await repository.updateUser(existing.id, {
        googleSubject: subject,
        emailVerified: true,
        emailVerifiedAt: existing.emailVerifiedAt || new Date().toISOString(),
        emailVerificationHash: "",
        emailVerificationExpiresAt: null,
        emailVerificationAttempts: 0,
        emailVerificationSentAt: null
      });
    } else {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 10);
      user = await repository.createUser({
        name,
        username: await createGoogleUsername(name, email),
        email,
        passwordHash,
        googleSubject: subject,
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        salary: 0,
        monthlyLimit: 0,
        hourlyRate: 0,
        workHoursPerDay: 8
      });
    }
  } else if (user.emailVerified === false) {
    user = await repository.updateUser(user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      emailVerificationHash: "",
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: null
    });
  }

  return res.json({
    token: signToken(user),
    sessionExpiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
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
    sessionExpiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
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

const profileProgress = asyncHandler(async (req, res) => {
  const [connections, friendships] = await Promise.all([
    repository.listBankConnections(req.user.id),
    repository.listFriendships(req.user.id)
  ]);
  const onboarding = { ...DEFAULT_ONBOARDING, ...(req.user.onboarding || {}) };
  const tasks = [
    {
      id: "avatar",
      title: "Escolha seu avatar",
      description: "Mostre como você aparece na BW e para seus amigos.",
      completed: Boolean(req.user.avatarUrl),
      to: "/perfil?tab=conta&edit=avatar"
    },
    {
      id: "bank",
      title: "Conecte uma instituição",
      description: "Atualize saldo, extrato e investimentos automaticamente.",
      completed: connections.some((connection) =>
        connection.syncStatus === "active" && ["pluggy", "direct_api"].includes(connection.provider)
      ),
      to: "/perfil?tab=conexoes"
    },
    {
      id: "friend",
      title: "Adicione uma amizade",
      description: "Crie metas e limites em conjunto.",
      completed: Boolean(friendships.friends?.length),
      to: "/amigos?add=1"
    },
    {
      id: "simulation",
      title: "Faça uma simulação",
      description: "Compare um aporte com prazo e rendimento esperados.",
      completed: Boolean(onboarding.simulatedInvestment),
      to: "/investimentos?view=simulador"
    },
    {
      id: "news",
      title: "Veja o mercado",
      description: "Abra uma notícia para acompanhar o cenário financeiro.",
      completed: Boolean(onboarding.viewedNews),
      to: "/investimentos?view=noticias"
    },
    {
      id: "install",
      title: "Adicione a BW ao celular",
      description: "Abra a ferramenta como um app pela tela de início.",
      completed: Boolean(onboarding.installCompleted),
      action: "install"
    }
  ];
  const completed = tasks.filter((task) => task.completed).length;

  return res.json({
    completed,
    total: tasks.length,
    percent: Math.round((completed / tasks.length) * 100),
    tasks
  });
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
  if (req.body.notificationPreferences !== undefined) {
    const requested = req.body.notificationPreferences;
    if (!requested || typeof requested !== "object" || Array.isArray(requested)) {
      return res.status(400).json({ message: "Preferências de notificação inválidas." });
    }
    const current = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(req.user.notificationPreferences || {}) };
    for (const key of ["emailEnabled", "limitAlerts", "goalAlerts"]) {
      if (requested[key] !== undefined) {
        if (typeof requested[key] !== "boolean") {
          return res.status(400).json({ message: "As preferências de e-mail precisam ser verdadeiras ou falsas." });
        }
        current[key] = requested[key];
      }
    }
    if (requested.limitThreshold !== undefined) {
      const threshold = numberInRange(requested.limitThreshold, 50, 100);
      if (threshold === null) {
        return res.status(400).json({ message: "O aviso de limite precisa estar entre 50% e 100%." });
      }
      current.limitThreshold = Math.round(threshold);
    }
    fields.notificationPreferences = current;
  }
  if (req.body.onboarding !== undefined) {
    const requested = req.body.onboarding;
    if (!requested || typeof requested !== "object" || Array.isArray(requested)) {
      return res.status(400).json({ message: "Estado de configuração inválido." });
    }
    const current = { ...DEFAULT_ONBOARDING, ...(req.user.onboarding || {}) };
    for (const key of Object.keys(DEFAULT_ONBOARDING)) {
      if (requested[key] !== undefined) {
        if (typeof requested[key] !== "boolean") {
          return res.status(400).json({ message: "O estado de configuração precisa ser verdadeiro ou falso." });
        }
        current[key] = requested[key];
      }
    }
    fields.onboarding = current;
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
    token: sensitiveChange ? signToken(user, req.auth?.sessionStartedAt) : undefined
  });
});

module.exports = {
  register,
  usernameAvailability,
  login,
  authProviders,
  googleLogin,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me,
  profileProgress,
  updateProfile
};
