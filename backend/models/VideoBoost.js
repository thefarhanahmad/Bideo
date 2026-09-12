const mongoose = require('mongoose');

const videoBoostSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.ObjectId,
    ref: 'Video',
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  coinsSpent: {
    type: Number,
    required: true,
    enum: [100, 250, 500, 1000],
  },
  durationHours: {
    type: Number,
    required: true,
    enum: [1, 3, 6, 24],
  },
  status: {
    type: String,
    enum: ['queued', 'active', 'completed', 'cancelled'],
    default: 'queued',
    index: true,
  },
  queuePosition: {
    type: Number,
    default: 1,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true,
  },
  estimatedStartTime: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('VideoBoost', videoBoostSchema);
