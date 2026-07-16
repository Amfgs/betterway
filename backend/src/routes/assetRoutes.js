const express = require("express");
const assetController = require("../controllers/assetController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/portfolio", assetController.portfolio);
router.get("/market", assetController.market);
router.get("/market/history", assetController.marketHistory);
router.get("/pending-investments", assetController.pendingInvestments);
router.post("/resolve-investment", assetController.resolveInvestment);
router.post("/", assetController.create);
router.put("/:id", assetController.update);
router.delete("/:id", assetController.remove);

module.exports = router;
