const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      default: ""
    },
    type: {
      type: String,
      enum: [
        "stock",
        "fii",
        "etf",
        "crypto",
        "cash",
        "fixed_income",
        "treasury_selic",
        "treasury_ipca",
        "treasury_prefixado",
        "cdb",
        "lci_lca",
        "debenture",
        "fund",
        "pension"
      ],
      default: "stock"
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    averagePrice: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "BRL"
    }
  },
  {
    timestamps: true
  }
);

assetSchema.index({ userId: 1, ticker: 1 });

module.exports = mongoose.model("Asset", assetSchema);
