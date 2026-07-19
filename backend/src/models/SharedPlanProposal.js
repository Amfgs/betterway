const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema(
  {
    revision: { type: Number, required: true, min: 1 },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    terms: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const sharedPlanProposalSchema = new mongoose.Schema(
  {
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentSenderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    currentRecipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["goal", "limit"], required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true },
    revision: { type: Number, default: 1, min: 1 },
    terms: { type: mongoose.Schema.Types.Mixed, required: true },
    revisions: { type: [revisionSchema], default: [] },
    createdResourceId: { type: String, default: "" },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

sharedPlanProposalSchema.index({ participantIds: 1, updatedAt: -1 });
sharedPlanProposalSchema.index({ currentRecipientId: 1, status: 1 });

module.exports = mongoose.model("SharedPlanProposal", sharedPlanProposalSchema);
