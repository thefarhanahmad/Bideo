const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add an ad title'],
    trim: true,
  },
  image: {
    type: String,
    required: [true, 'Please add an ad image URL'],
  },
  type: {
    type: String,
    enum: ['banner', 'full'],
    default: 'banner',
  },
  activeStatus: {
    type: Boolean,
    default: true,
  },
  link: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Ad', adSchema);
