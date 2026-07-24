const express = require("express");
const rateLimit = require("express-rate-limit");
const goalController = require("../controllers/goalController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const productLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: "Muitas consultas de produto. Aguarde alguns minutos e tente novamente." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

router.use(authMiddleware);
router.get("/", goalController.list);
router.post("/product/preview", productLookupLimiter, goalController.previewProduct);
router.post("/products/refresh", productLookupLimiter, goalController.refreshProducts);
router.post("/", goalController.create);
router.post("/:id/movements", goalController.movement);
router.post("/:id/product/check", productLookupLimiter, goalController.checkProduct);
router.put("/:id/product", goalController.updateProduct);
router.put("/:id", goalController.update);
router.delete("/:id", goalController.remove);

module.exports = router;
