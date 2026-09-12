const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['ad_reward', 'boost_spend', 'admin_adjustment'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
