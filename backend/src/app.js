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
const { isMemoryMode } = require("./config/db");
const { allowedOrigins, isProduction } = require("./config/security");

const app = express();
const origins = allowedOrigins();

if (isProduction() && origins.length === 0) {
  throw new Error("CLIENT_URL é obrigatória em produção.");
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || (!isProduction() && origins.length === 0) || origins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error("Origem não autorizada pelo CORS."));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mode: isMemoryMode() ? "memory-local" : "mongodb",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/limits", limitRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/simulator", simulatorRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/widgets", widgetRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    message: error.message || "Erro interno do servidor."
  });
});

module.exports = app;
