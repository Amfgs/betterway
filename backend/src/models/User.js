const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    avatarUrl: {
      type: String,
      default: ""
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    resetPasswordHash: {
      type: String,
      default: "",
      select: false
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    salary: {
      type: Number,
      default: 4500
    },
    monthlyLimit: {
      type: Number,
      default: 3200
    },
    hourlyRate: {
      type: Number,
      default: 25
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "dark"
    },
    friendIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    widgetPreferences: {
      primaryWidgetKind: {
        type: String,
        enum: ["goal", "limit"],
        default: "goal"
      },
      primaryWidgetId: {
        type: String,
        default: ""
      },
      streakReminderTime: {
        type: String,
        default: "22:30"
      },
      appBlockingIntent: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
