const express = require("express");
const simulatorController = require("../controllers/simulatorController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.post("/compound", simulatorController.compound);

module.exports = router;
