const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
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
  text: {
    type: String,
    required: [true, 'Please add some text'],
    maxlength: [500, 'Comment cannot be more than 500 characters'],
  },
  likes: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    }
  ],
  replies: [
    {
      user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
      text: {
        type: String,
        required: true,
        maxlength: [500, 'Reply cannot be more than 500 characters'],
      },
      likes: [
        {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        }
      ],
      createdAt: {
        type: Date,
        default: Date.now,
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Comment', commentSchema);
