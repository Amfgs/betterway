const express = require("express");
const maintenanceController = require("../controllers/maintenanceController");

const router = express.Router();
router.get("/run", maintenanceController.run);

module.exports = router;
