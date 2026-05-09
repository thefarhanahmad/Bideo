const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  avatar: {
    type: String,
    default: 'default-avatar.png',
  },
  subscribersCount: {
    type: Number,
    default: 0,
  },
  subscribedChannels: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],
  watchHistory: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Video',
    },
  ],
  likedVideos: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Video',
    },
  ],
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

module.exports = mongoose.model('User', userSchema);
