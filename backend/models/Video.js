const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters'],
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters'],
  },
  thumbnail: {
    type: String,
    required: [true, 'Please add a thumbnail URL'],
  },
  videoUrl: {
    type: String,
    required: [true, 'Please add a video URL'],
  },
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    }
  ],
  commentsCount: {
    type: Number,
    default: 0,
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
  },
  tags: [String],
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public',
  },
  duration: {
    type: Number, // in seconds
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Video', videoSchema);
