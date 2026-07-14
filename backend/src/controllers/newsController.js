const asyncHandler = require("../utils/asyncHandler");
const { getFinancialNews } = require("../services/newsService");

const list = asyncHandler(async (req, res) => {
  const articles = await getFinancialNews();
  return res.json({ articles });
});

module.exports = {
  list
};
