const express = require("express");
const goalController = require("../controllers/goalController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", goalController.list);
router.post("/", goalController.create);
router.post("/:id/movements", goalController.movement);
router.put("/:id", goalController.update);
router.delete("/:id", goalController.remove);

module.exports = router;
