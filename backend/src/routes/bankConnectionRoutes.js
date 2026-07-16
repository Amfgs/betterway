const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const controller = require("../controllers/bankConnectionController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", controller.list);
router.post("/pluggy/token", controller.createConnectToken);
router.post("/pluggy/sync", controller.syncPluggy);
router.post("/refresh", controller.refresh);
router.post("/import", controller.importStatement);
router.delete("/:id", controller.remove);

module.exports = router;
