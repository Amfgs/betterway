const mongoose = require("mongoose");

const pluggyWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    event: { type: String, enum: ["item/created", "item/updated", "item/error"], required: true },
    itemId: { type: String, default: "" },
    clientUserId: { type: String, default: "" },
    error: {
      code: { type: String, default: "" },
      message: { type: String, default: "" }
    },
    status: { type: String, enum: ["pending", "processed"], default: "pending", index: true }
  },
  { timestamps: true }
);

pluggyWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });

module.exports = mongoose.model("PluggyWebhookEvent", pluggyWebhookEventSchema);
