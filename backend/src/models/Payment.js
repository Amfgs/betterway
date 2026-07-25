const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ["mercadopago"],
      default: "mercadopago"
    },
    providerPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    method: {
      type: String,
      enum: ["card", "pix"],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      enum: ["BRL"],
      default: "BRL"
    },
    status: {
      type: String,
      default: "created",
      index: true
    },
    statusDetail: {
      type: String,
      default: "",
      maxlength: 160
    },
    accessGrantedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
