const express = require("express");
const productWatchController = require("../controllers/productWatchController");

const router = express.Router();
router.get("/run", productWatchController.run);

module.exports = router;
