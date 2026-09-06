const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follower = require('../models/Follower');
const Playlist = require('../models/Playlist');
const MonetizationApplication = require('../models/MonetizationApplication');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const VideoReport = require('../models/VideoReport');
const VideoView = require('../models/VideoView');
const Notification = require('../models/Notification');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { deleteLocalFile } = require('./localUpload');

const permanentlyDeleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  // 1. Delete user avatar & cover image files from disk
  if (user.avatar) deleteLocalFile(user.avatar);
  if (user.coverImage) deleteLocalFile(user.coverImage);

  // 2. Delete all videos owned by user (both disk files and DB records)
  const userVideos = await Video.find({ owner: userId });
  for (const video of userVideos) {
    const videoFileUrl = video.videoUrl || video.url;
    if (videoFileUrl) deleteLocalFile(videoFileUrl);
    if (video.thumbnail) deleteLocalFile(video.thumbnail);

    await Promise.all([
      VideoMonetizationReview.deleteMany({ video: video._id }),
      VideoReport.deleteMany({ video: video._id }),
      VideoView.deleteMany({ video: video._id }),
      Comment.deleteMany({ video: video._id }),
      Notification.deleteMany({ video: video._id }),
      Playlist.updateMany({ videos: video._id }, { $pull: { videos: video._id } }),
      User.updateMany(
        { $or: [{ watchHistory: video._id }, { likedVideos: video._id }] },
        { $pull: { watchHistory: video._id, likedVideos: video._id } }
      ),
    ]);

    await video.deleteOne();
  }

  // 3. Delete all posts owned by user (both image files and DB records)
  const userPosts = await Post.find({ owner: userId });
  for (const post of userPosts) {
    if (post.imageUrl) deleteLocalFile(post.imageUrl);

    await Promise.all([
      Comment.deleteMany({ post: post._id }),
      Notification.deleteMany({ post: post._id }),
    ]);

    await post.deleteOne();
  }

  // 4. Delete user's comments, playlists, followers, monetization records, notifications, views, withdrawals, reports
  await Promise.all([
    Comment.deleteMany({ user: userId }),
    Playlist.deleteMany({ owner: userId }),
    Follower.deleteMany({ $or: [{ follower: userId }, { channel: userId }] }),
    MonetizationApplication.deleteMany({ user: userId }),
    VideoMonetizationReview.deleteMany({ user: userId }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] }),
    VideoView.deleteMany({ user: userId }),
    WithdrawalRequest.deleteMany({ user: userId }),
    VideoReport.deleteMany({ reporter: userId }),
    Video.updateMany({ $or: [{ likes: userId }, { dislikes: userId }] }, { $pull: { likes: userId, dislikes: userId } }),
    Post.updateMany({ likes: userId }, { $pull: { likes: userId } }),
    User.updateMany({ followingChannels: userId }, { $pull: { followingChannels: userId } }),
  ]);

  // 5. Finally, permanently delete the user document
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
