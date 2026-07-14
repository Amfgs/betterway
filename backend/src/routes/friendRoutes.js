const express = require("express");
const friendController = require("../controllers/friendController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", friendController.list);
router.post("/", friendController.create);
router.delete("/:id", friendController.remove);

module.exports = router;
