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

module.exports = mongoose.model('Follower', followerSchema);
