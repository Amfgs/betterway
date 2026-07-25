const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { requirePlus } = require("../middleware/plusMiddleware");
const reportController = require("../controllers/reportController");

const router = express.Router();
router.get("/run", reportController.run);
router.get("/preview", authMiddleware, requirePlus("Relatórios financeiros"), reportController.preview);
router.post("/send", authMiddleware, requirePlus("Relatórios financeiros"), reportController.sendNow);

module.exports = router;
