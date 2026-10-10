const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add an announcement title'],
    trim: true,
  },
  image: {
    type: String,
    required: [true, 'Please add an announcement image URL'],
  },
  type: {
    type: String,
    enum: ['banner', 'full'],
    default: 'full',
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

// Explicitly use the 'ads' collection in MongoDB so all existing records are fully preserved
module.exports = mongoose.model('Announcement', announcementSchema, 'ads');
