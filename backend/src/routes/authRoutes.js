const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const emailActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas solicitações de e-mail. Aguarde alguns minutos." }
});

const codeAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas de código. Solicite um novo código mais tarde." }
});

const usernameAvailabilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas consultas de nome de usuário. Aguarde alguns minutos." }
});

router.post("/register", emailActionLimiter, authController.register);
router.get("/username-availability", usernameAvailabilityLimiter, authController.usernameAvailability);
router.post("/login", authController.login);
router.post("/verify-email", codeAttemptLimiter, authController.verifyEmail);
router.post("/resend-verification", emailActionLimiter, authController.resendVerification);
router.post("/forgot-password", emailActionLimiter, authController.forgotPassword);
router.post("/reset-password", codeAttemptLimiter, authController.resetPassword);
router.get("/me", authMiddleware, authController.me);
router.put("/me", authMiddleware, authController.updateProfile);

module.exports = router;
