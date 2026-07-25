const express = require("express");
const adminController = require("../controllers/adminController");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();
router.use(adminMiddleware);
router.post("/plus-grants", adminController.grantPlus);
router.delete("/plus-grants/:email", adminController.revokePlus);

module.exports = router;
