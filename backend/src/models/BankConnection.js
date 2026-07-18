const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    externalId: String,
    name: String,
    type: String,
    subtype: String,
    balance: { type: Number, default: 0 },
    currencyCode: { type: String, default: "BRL" }
  },
  { _id: false }
);

const investmentSchema = new mongoose.Schema(
  {
    externalId: String,
    name: String,
    code: String,
    type: String,
    subtype: String,
    balance: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    unitValue: { type: Number, default: 0 },
    amountProfit: { type: Number, default: 0 },
    currencyCode: { type: String, default: "BRL" }
  },
  { _id: false }
);

const bankTransactionSchema = new mongoose.Schema(
  {
    externalId: String,
    accountExternalId: String,
    description: String,
    amount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    date: { type: Date, required: true },
    type: String,
    category: String,
    status: String,
    currencyCode: { type: String, default: "BRL" }
  },
  { _id: false }
);

const bankConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ["pluggy", "statement_import"],
      required: true
    },
    externalId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    institutionName: {
      type: String,
      default: ""
    },
    sourceFile: {
      type: String,
      default: ""
    },
    accounts: {
      type: [accountSchema],
      default: []
    },
    investments: {
      type: [investmentSchema],
      default: []
    },
    transactions: {
      type: [bankTransactionSchema],
      default: []
    },
    lastSyncedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

bankConnectionSchema.index({ userId: 1, provider: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model("BankConnection", bankConnectionSchema);
