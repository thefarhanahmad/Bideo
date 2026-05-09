const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Please add a playlist name'],
    trim: true,
  },
  videos: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Video',
    }
  ],
  isPrivate: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Playlist', playlistSchema);
