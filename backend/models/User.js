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
    default: null,
  },
  coverImage: {
    type: String,
    default: null,
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
  channelName: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  about: {
    type: String,
  },
  followersCount: {
    type: Number,
    default: 0,
  },
  followingChannels: [
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
  searchHistory: [
    {
      term: {
        type: String,
        trim: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
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
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Set default avatar if not present
  if (!this.avatar) {
    this.avatar = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(this.name)}&backgroundColor=00acc1,1e88e5,5e35b1,7b1fa2,c2185b,e53935,f4511e,fb8c00,fdd835,ffb300`;
  }
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
