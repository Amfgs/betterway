const express = require("express");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/bankConnectionController");
const webhookController = require("../controllers/pluggyWebhookController");

const router = express.Router();
const providerActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user.id),
  message: { message: "Muitas operações de conexão bancária. Aguarde alguns minutos e tente novamente." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  message: { message: "Muitos eventos Pluggy. Tente novamente em instantes." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

function requireBankConnectionsEnabled(req, res, next) {
  if (process.env.BANK_CONNECTIONS_ENABLED === "true") return next();
  return res.status(503).json({
    code: "BANK_CONNECTIONS_COMING_SOON",
    message: "A conexão com instituições estará disponível em breve."
  });
}

router.post("/pluggy/webhook", webhookLimiter, webhookController.receive);
router.use(authMiddleware);
router.get("/", controller.list);
router.post("/pluggy/token", requireBankConnectionsEnabled, providerActionLimiter, controller.createConnectToken);
router.post("/pluggy/sync", requireBankConnectionsEnabled, providerActionLimiter, controller.syncPluggy);
router.post("/direct/request", requireBankConnectionsEnabled, providerActionLimiter, controller.requestDirectConnection);
router.post("/refresh", requireBankConnectionsEnabled, providerActionLimiter, controller.refresh);
router.delete("/:id", requireBankConnectionsEnabled, controller.remove);

module.exports = router;
