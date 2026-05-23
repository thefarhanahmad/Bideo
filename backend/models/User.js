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
    required: false,
    unique: true,
    sparse: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  avatar: {
    type: String,
    default: 'default-avatar.png',
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  password: {
    type: String,
    minlength: 6,
    select: false,
  },
  authProvider: {
    type: String,
    enum: ['phone', 'google'],
    default: 'google',
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

userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

module.exports = mongoose.model('User', userSchema);
