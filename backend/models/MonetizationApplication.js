const mongoose = require('mongoose');

const monetizationApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  adharNumber: {
    type: String,
    required: false,
    default: '',
    trim: true,
  },
  upiId: {
    type: String,
    required: false,
    default: '',
    trim: true,
  },
  bankDetails: {
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true }
  },
  reviewMessage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

monetizationApplicationSchema.index({ status: 1, createdAt: -1 });
monetizationApplicationSchema.index({ status: 1, updatedAt: -1 });
monetizationApplicationSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('MonetizationApplication', monetizationApplicationSchema);
