const asyncHandler = require("../utils/asyncHandler");
const { buildCompoundProjection } = require("../utils/financial");
const { numberInRange } = require("../utils/validation");

const frequencies = new Set(["monthly", "bimonthly", "quarterly", "semiannual", "yearly"]);

const compound = asyncHandler(async (req, res) => {
  const initialAmount = numberInRange(req.body.initialAmount || 0, 0, 1e15);
  const recurringContribution = numberInRange(req.body.recurringContribution ?? req.body.monthlyContribution ?? 0, 0, 1e15);
  const annualRate = numberInRange(req.body.annualRate, -99.99, 1000);
  const months = numberInRange(req.body.months, 1, 1200);
  const annualContributionIncrease = numberInRange(req.body.annualContributionIncrease || 0, -99.99, 1000);
  const extraContribution = numberInRange(req.body.extraContribution || 0, 0, 1e15);
  const extraContributionMonth = numberInRange(req.body.extraContributionMonth || 0, 0, 1200);
  const contributionFrequency = req.body.contributionFrequency || "monthly";
  if ([initialAmount, recurringContribution, annualRate, months, annualContributionIncrease, extraContribution, extraContributionMonth].includes(null)) {
    return res.status(400).json({ message: "Revise os valores da simulação. O prazo máximo é de 100 anos." });
  }
  if (!frequencies.has(contributionFrequency) || extraContributionMonth > months) {
    return res.status(400).json({ message: "Frequência ou mês do aporte extra inválido." });
  }

  const projection = buildCompoundProjection({
    initialAmount,
    recurringContribution,
    contributionFrequency,
    annualRate,
    months: Math.round(months),
    annualContributionIncrease,
    extraContribution,
    extraContributionMonth: Math.round(extraContributionMonth)
  });

  return res.json({ projection });
});

module.exports = {
  compound
};
