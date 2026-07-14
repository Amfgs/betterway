const express = require("express");
const limitController = require("../controllers/limitController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", limitController.list);
router.post("/", limitController.create);
router.put("/:id", limitController.update);
router.delete("/:id", limitController.remove);

module.exports = router;
