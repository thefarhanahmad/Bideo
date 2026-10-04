const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  mediaUrl: {
    type: String,
    required: [true, 'Please provide an image for the story'],
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image',
  },
  caption: {
    type: String,
    trim: true,
    maxlength: 300,
    default: '',
  },
  views: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],
  ownerViewed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
});

// Indexes for fast tray lookups and expiration cleanup
storySchema.index({ user: 1, expiresAt: 1 });
storySchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Story', storySchema);
