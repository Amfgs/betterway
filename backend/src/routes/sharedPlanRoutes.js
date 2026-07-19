const express = require("express");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/sharedPlanController");

const router = express.Router();
router.use(authMiddleware);
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  keyGenerator: (req) => String(req.user.id),
  message: { message: "Muitas operações colaborativas. Aguarde alguns minutos." },
  standardHeaders: "draft-7",
  legacyHeaders: false
}));
router.get("/", controller.list);
router.post("/", controller.create);
router.post("/:id/counter", controller.counter);
router.post("/:id/accept", controller.accept);
router.post("/:id/reject", controller.reject);

module.exports = router;
