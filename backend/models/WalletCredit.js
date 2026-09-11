const mongoose = require('mongoose');

const walletCreditSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  video: {
    type: mongoose.Schema.ObjectId,
    ref: 'Video',
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  source: {
    type: String,
    enum: ['video_view', 'short_view', 'boost', 'bonus', 'adjustment'],
    default: 'video_view',
  },
  status: {
    type: String,
    enum: ['pending', 'credited', 'cancelled'],
    default: 'pending',
    index: true,
  },
  isCredited: {
    type: Boolean,
    default: false,
    index: true,
  },
  availableAt: {
    type: Date,
    required: true,
    index: true,
  },
  creditedAt: {
    type: Date,
    default: null,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

walletCreditSchema.index({ status: 1, availableAt: 1 });
walletCreditSchema.index({ user: 1, status: 1, createdAt: -1 });
walletCreditSchema.index({ user: 1, createdAt: -1 });

const WalletCredit = mongoose.model('WalletCredit', walletCreditSchema);

module.exports = WalletCredit;
