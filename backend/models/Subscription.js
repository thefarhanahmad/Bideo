const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriber: {
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

// One user can subscribe to a channel only once
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
