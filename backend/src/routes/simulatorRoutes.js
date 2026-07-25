const express = require("express");
const simulatorController = require("../controllers/simulatorController");
const authMiddleware = require("../middleware/authMiddleware");
const { requirePlus } = require("../middleware/plusMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.post("/compound", requirePlus("Simulações completas"), simulatorController.compound);

module.exports = router;
