const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    isSuperfluous: {
      type: Boolean,
      default: false
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      default: ""
    },
    investmentStatus: {
      type: String,
      enum: ["pending", "resolved", "not_applicable"],
      default: "not_applicable"
    },
    investmentSplits: [
      {
        assetId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Asset"
        },
        ticker: String,
        name: String,
        type: String,
        amount: Number,
        quantity: Number,
        averagePrice: Number,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
