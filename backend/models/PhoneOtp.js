const mongoose = require("mongoose");

const phoneOtpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ["reset_password", "verification"],
    default: "reset_password",
  },
  attempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900, // MongoDB TTL index: automatically deleted after 15 minutes (900 seconds)
  },
});

phoneOtpSchema.index({ phone: 1, purpose: 1 });

module.exports = mongoose.model("PhoneOtp", phoneOtpSchema);
