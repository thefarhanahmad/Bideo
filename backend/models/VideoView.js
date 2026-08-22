const mongoose = require('mongoose');

const videoViewSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.ObjectId,
    ref: 'Video',
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  },
  deviceId: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

videoViewSchema.index({ video: 1, createdAt: -1 });
videoViewSchema.index({ user: 1 });
videoViewSchema.index({ deviceId: 1 });

const VideoView = mongoose.model('VideoView', videoViewSchema);

// Safely attempt dropping old unique indexes if they exist in MongoDB
VideoView.collection.dropIndex('video_1_user_1').catch(() => {});
VideoView.collection.dropIndex('video_1_deviceId_1').catch(() => {});

module.exports = VideoView;
