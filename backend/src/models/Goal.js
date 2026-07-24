const mongoose = require("mongoose");

const pricePointSchema = new mongoose.Schema(
  {
    price: {
      type: Number,
      required: true,
      min: 0
    },
    checkedAt: {
      type: Date,
      required: true
    }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false
    },
    url: {
      type: String,
      default: "",
      maxlength: 2048
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240
    },
    imageUrl: {
      type: String,
      default: "",
      maxlength: 2048
    },
    store: {
      type: String,
      default: "",
      maxlength: 120
    },
    currency: {
      type: String,
      enum: ["BRL"],
      default: "BRL"
    },
    targetPrice: {
      type: Number,
      min: 0,
      default: 0
    },
    currentPrice: {
      type: Number,
      min: 0,
      default: 0
    },
    previousPrice: {
      type: Number,
      min: 0,
      default: 0
    },
    lowestPrice: {
      type: Number,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: ["active", "unavailable", "error"],
      default: "active"
    },
    lastCheckedAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      default: "",
      maxlength: 240
    },
    priceHistory: {
      type: [pricePointSchema],
      default: []
    },
    alertState: {
      priceReached: {
        type: Boolean,
        default: false
      },
      affordable: {
        type: Boolean,
        default: false
      },
      priceNotifiedAt: {
        type: Date,
        default: null
      },
      affordableNotifiedAt: {
        type: Date,
        default: null
      }
    }
  },
  { _id: false }
);

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    participantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    name: {
      type: String,
      required: true,
      trim: true
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    movements: [
      {
        id: {
          type: String,
          required: true
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        type: {
          type: String,
          enum: ["deposit", "withdraw"],
          required: true
        },
        amount: {
          type: Number,
          required: true,
          min: 0
        },
        previousAmount: {
          type: Number,
          required: true,
          min: 0
        },
        nextAmount: {
          type: Number,
          required: true,
          min: 0
        },
        notes: {
          type: String,
          default: ""
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    dueDate: {
      type: Date,
      required: true
    },
    product: {
      type: productSchema,
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Goal", goalSchema);
