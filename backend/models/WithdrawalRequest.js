const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please provide withdrawal amount'],
    min: [1000, 'Minimum withdrawal amount is ₹1,000'],
  },
  payoutMethod: {
    type: String,
    enum: ['upi', 'bank'],
    required: true,
  },
  payoutDetails: {
    upiId: { type: String, default: null },
    bankName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    holderName: { type: String, default: null },
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  transactionId: {
    type: String,
    default: null,
  },
  adminNote: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
