const mongoose = require('mongoose');

// Upload pushes created during night hours (10 PM - 8 AM IST), sent at 8 AM by
// utils/uploadPushScheduler.js. At most two documents per person, however many uploads happen:
// - kind 'follower': how many followed creators uploaded overnight + the latest upload's message
// - kind 'recommendation': the single best-matching recommended video seen overnight
// Sent documents are deleted; anything left over expires after 3 days.
const pendingPushSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  kind: {
    type: String,
    enum: ['follower', 'recommendation'],
    required: true,
  },
  count: { type: Number, default: 0 },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Recommendations: how well the video matches the person's watch history
  score: { type: Number, default: 0 },
  // Recommendations: in-app notification to create when the push is sent
  notification: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3 * 24 * 60 * 60,
  },
});

pendingPushSchema.index({ recipient: 1, kind: 1 }, { unique: true });

module.exports = mongoose.model('PendingPush', pendingPushSchema);
