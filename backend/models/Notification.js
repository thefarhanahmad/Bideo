const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  actor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['video_like', 'video_comment', 'comment_like', 'comment_reply', 'post_like', 'post_comment'],
    required: true,
  },
  video: {
    type: mongoose.Schema.ObjectId,
    ref: 'Video',
  },
  post: {
    type: mongoose.Schema.ObjectId,
    ref: 'Post',
  },
  comment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Comment',
  },
  message: String,
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
