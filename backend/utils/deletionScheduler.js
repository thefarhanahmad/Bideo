const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follower = require('../models/Follower');
const Playlist = require('../models/Playlist');
const MonetizationApplication = require('../models/MonetizationApplication');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const { deleteLocalFile } = require('./localUpload');

const permanentlyDeleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  if (user.avatar) deleteLocalFile(user.avatar);
  if (user.coverImage) deleteLocalFile(user.coverImage);

  // Delete videos owned by user
  const userVideos = await Video.find({ owner: userId });
  for (const video of userVideos) {
    if (video.url) deleteLocalFile(video.url);
    if (video.thumbnail) deleteLocalFile(video.thumbnail);
    await video.deleteOne();
  }

  // Delete posts, comments, playlists, followers, monetization records
  await Post.deleteMany({ owner: userId });
  await Comment.deleteMany({ user: userId });
  await Playlist.deleteMany({ owner: userId });
  await Follower.deleteMany({ $or: [{ follower: userId }, { channel: userId }] });
  await MonetizationApplication.deleteMany({ user: userId });
  await VideoMonetizationReview.deleteMany({ user: userId });

  await user.deleteOne();
};

const processScheduledDeletions = async () => {
  try {
    const expiredUsers = await User.find({
      deletionScheduled: true,
      scheduledDeletionDate: { $lte: new Date() },
    });

    for (const user of expiredUsers) {
      console.log(`[DeletionScheduler] Permanently deleting user ${user._id} (${user.name})`);
      await permanentlyDeleteUser(user._id);
    }
  } catch (err) {
    console.error('[DeletionScheduler] Error processing scheduled deletions:', err);
  }
};

const initDeletionScheduler = () => {
  // Run once on startup
  processScheduledDeletions();
  // Run every 30 minutes
  setInterval(processScheduledDeletions, 30 * 60 * 1000);
};

module.exports = {
  permanentlyDeleteUser,
  processScheduledDeletions,
  initDeletionScheduler,
};
