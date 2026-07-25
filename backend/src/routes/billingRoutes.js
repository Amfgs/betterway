const express = require("express");
const rateLimit = require("express-rate-limit");
const billingController = require("../controllers/billingController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas de pagamento. Aguarde alguns minutos." }
});

router.post("/webhook", billingController.webhook);
router.use(authMiddleware);
router.get("/overview", billingController.overview);
router.post("/trial", paymentLimiter, billingController.startTrial);
router.post("/payments/pix", paymentLimiter, billingController.createPixPayment);
router.post("/payments/card", paymentLimiter, billingController.createCardPayment);
router.get("/payments/:id", billingController.paymentStatus);

module.exports = router;
