const mongoose = require('mongoose');

const videoMonetizationReviewSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.ObjectId,
    ref: 'Video',
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'passed', 'failed'],
    default: 'pending'
  },
  reviewMessage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

videoMonetizationReviewSchema.index({ status: 1, user: 1 });
videoMonetizationReviewSchema.index({ user: 1, status: 1 });
videoMonetizationReviewSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('VideoMonetizationReview', videoMonetizationReviewSchema);
