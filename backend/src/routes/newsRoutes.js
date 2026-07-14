const express = require("express");
const newsController = require("../controllers/newsController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", newsController.list);

module.exports = router;
