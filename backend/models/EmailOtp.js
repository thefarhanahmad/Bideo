const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // MongoDB TTL index: automatically deleted after 10 minutes (600 seconds)
  },
});

emailOtpSchema.index({ userId: 1, email: 1 });

module.exports = mongoose.model('EmailOtp', emailOtpSchema);
