const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const goalRoutes = require("./routes/goalRoutes");
const friendRoutes = require("./routes/friendRoutes");
const limitRoutes = require("./routes/limitRoutes");
const assetRoutes = require("./routes/assetRoutes");
const simulatorRoutes = require("./routes/simulatorRoutes");
const newsRoutes = require("./routes/newsRoutes");
const widgetRoutes = require("./routes/widgetRoutes");
const bankConnectionRoutes = require("./routes/bankConnectionRoutes");
const sharedPlanRoutes = require("./routes/sharedPlanRoutes");
const { isMemoryMode } = require("./config/db");
const { allowedOrigins, isProduction } = require("./config/security");

const app = express();
const origins = allowedOrigins();
app.disable("x-powered-by");

if (isProduction() && origins.length === 0) {
  throw new Error("CLIENT_URL é obrigatória em produção.");
}

app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || (!isProduction() && origins.length === 0) || origins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      const error = new Error("Origem não autorizada pelo CORS.");
      error.status = 403;
      return callback(error);
    },
    credentials: false
  })
);
app.use(express.json({ limit: "1mb" }));
app.use((error, req, res, next) => {
  if (error.status === 403) return next(error);
  if (error.status === 413) return res.status(413).json({ message: "O corpo da requisição excede o limite permitido." });
  if (error.status === 415) return res.status(415).json({ message: "A codificação do corpo da requisição não é suportada." });
  if ((req.get("content-type") || "").toLowerCase().includes("application/json")) {
    return res.status(400).json({ message: "O corpo da requisição contém JSON inválido." });
  }
  return next(error);
});
if (process.env.NODE_ENV !== "test") app.use(morgan(isProduction() ? "tiny" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    skip: (req) => req.path === "/api/bank-connections/pluggy/webhook",
    message: { message: "Muitas solicitações. Aguarde alguns minutos e tente novamente." },
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: { message: "Muitas tentativas de autenticação. Aguarde alguns minutos." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    ...(!isProduction() ? { mode: isMemoryMode() ? "memory-local" : "mongodb" } : {}),
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/shared-plans", sharedPlanRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/limits", limitRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/simulator", simulatorRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/widgets", widgetRoutes);
app.use("/api/bank-connections", bankConnectionRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
});

app.use((error, req, res, next) => {
  if (isProduction()) {
    console.error("Falha na API", { name: error.name, status: error.status || 500, path: req.path });
  } else if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }
  const status = error.type === "entity.parse.failed" || ["ValidationError", "CastError"].includes(error.name)
    ? 400
    : error.code === 11000
      ? 409
      : Number(error.status || 500);
  res.status(status).json({
    message: status >= 500 && !error.expose
      ? "Não foi possível concluir a operação. Tente novamente em instantes."
      : error.type === "entity.parse.failed"
        ? "O corpo da requisição contém JSON inválido."
        : ["ValidationError", "CastError"].includes(error.name)
          ? "Os dados enviados são inválidos."
          : error.code === 11000
            ? error.keyPattern?.username
              ? "Este nome de usuário já está em uso."
              : error.keyPattern?.email
                ? "Este e-mail já está cadastrado."
                : "Já existe um registro com esses dados."
        : error.message || "Não foi possível concluir a operação."
  });
});

module.exports = app;
