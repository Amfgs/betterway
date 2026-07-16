const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: /^[a-z0-9][a-z0-9._]*[a-z0-9]$/
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
    authVersion: {
      type: Number,
      min: 0,
      default: 0
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
    resetPasswordAttempts: {
      type: Number,
      min: 0,
      default: 0,
      select: false
    },
    resetPasswordSentAt: {
      type: Date,
      default: null,
      select: false
    },
    emailVerified: {
      type: Boolean,
      default: true
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    emailVerificationHash: {
      type: String,
      default: "",
      select: false
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    emailVerificationAttempts: {
      type: Number,
      min: 0,
      default: 0,
      select: false
    },
    emailVerificationSentAt: {
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
    workHoursPerDay: {
      type: Number,
      min: 1,
      max: 24,
      default: 8
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
    acceptedFriendIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    sentFriendRequestIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    receivedFriendRequestIds: [
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
