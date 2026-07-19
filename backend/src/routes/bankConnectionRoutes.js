const express = require("express");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/bankConnectionController");

const router = express.Router();
const providerActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user.id),
  message: { message: "Muitas operações de conexão bancária. Aguarde alguns minutos e tente novamente." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

router.use(authMiddleware);
router.get("/", controller.list);
router.post("/pluggy/token", providerActionLimiter, controller.createConnectToken);
router.post("/pluggy/sync", providerActionLimiter, controller.syncPluggy);
router.post("/refresh", providerActionLimiter, controller.refresh);
router.delete("/:id", controller.remove);

module.exports = router;
