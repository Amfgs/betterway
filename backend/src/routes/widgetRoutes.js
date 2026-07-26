const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const widgetController = require("../controllers/widgetController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", widgetController.state);
router.get("/streak", widgetController.streak);
router.put("/preferences", widgetController.updatePreferences);

module.exports = router;
