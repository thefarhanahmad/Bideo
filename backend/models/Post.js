const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    trim: true,
    maxlength: [2000, 'Post cannot be more than 2000 characters'],
  },
  imageUrl: String,
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public',
  },
  likes: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],
  commentsCount: {
    type: Number,
    default: 0,
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

postSchema.index({ owner: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
