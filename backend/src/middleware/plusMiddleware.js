const { hasPlusAccess } = require("../utils/subscription");

function plusRequired(res, feature) {
  return res.status(402).json({
    code: "PLUS_REQUIRED",
    feature,
    message: `${feature} faz parte do BW Plus.`
  });
}

function requirePlus(feature) {
  return (req, res, next) => {
    if (!hasPlusAccess(req.user)) return plusRequired(res, feature);
    return next();
  };
}

module.exports = {
  plusRequired,
  requirePlus
};
