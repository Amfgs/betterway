const asyncHandler = require("../utils/asyncHandler");
const { buildCompoundProjection } = require("../utils/financial");

const compound = asyncHandler(async (req, res) => {
  const projection = buildCompoundProjection({
    initialAmount: req.body.initialAmount,
    monthlyContribution: req.body.monthlyContribution,
    recurringContribution: req.body.recurringContribution,
    contributionFrequency: req.body.contributionFrequency,
    annualRate: req.body.annualRate,
    months: req.body.months,
    annualContributionIncrease: req.body.annualContributionIncrease,
    extraContribution: req.body.extraContribution,
    extraContributionMonth: req.body.extraContributionMonth
  });

  return res.json({ projection });
});

module.exports = {
  compound
};
