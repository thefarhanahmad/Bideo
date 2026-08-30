const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  stack: {
    type: String,
    default: '',
  },
  statusCode: {
    type: Number,
    default: 500,
  },
  endpoint: {
    type: String,
    default: '',
  },
  method: {
    type: String,
    default: 'GET',
  },
  status: {
    type: String,
    enum: ['unresolved', 'resolved'],
    default: 'unresolved',
  },
  count: {
    type: Number,
    default: 1,
  },
  firstSeenAt: {
    type: Date,
    default: Date.now,
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
  },
  adminNote: {
    type: String,
    default: '',
  },
  resolvedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for fast searching and sorting
ErrorLogSchema.index({ status: 1, lastSeenAt: -1 });
ErrorLogSchema.index({ endpoint: 1, method: 1 });

module.exports = mongoose.model('ErrorLog', ErrorLogSchema);
