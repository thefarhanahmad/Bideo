const mongoose = require('mongoose');

const followerSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  channel: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// One user can follow a channel only once
followerSchema.index({ follower: 1, channel: 1 }, { unique: true });

// Query-performance indexes (added 2026-10-19; already present in production).
followerSchema.index({ channel: 1, createdAt: -1 });

module.exports = mongoose.model('Follower', followerSchema);
