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
  originalImageSize: {
    type: Number,
    default: 0,
  },
  compressedImageSize: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Ad', adSchema);
