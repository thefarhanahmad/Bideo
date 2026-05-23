const Follower = require('../models/Follower');
const User = require('../models/User');

// @desc    Follow a channel
// @route   POST /api/followers/:channelId
// @access  Private
exports.follow = async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const followerId = req.user.id;

    if (channelId === followerId) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const channel = await User.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    let follow = await Follower.findOne({
      follower: followerId,
      channel: channelId,
    });

    if (follow) {
      // Unfollow
      await follow.deleteOne();
      
      // Update counts and arrays
      channel.followersCount -= 1;
      await channel.save();

      await User.findByIdAndUpdate(followerId, {
        $pull: { followingChannels: channelId }
      });

      return res.status(200).json({ success: true, message: 'Unfollowed successfully' });
    }

    // Follow
    follow = await Follower.create({
      follower: followerId,
      channel: channelId,
    });

    channel.followersCount += 1;
    await channel.save();

    await User.findByIdAndUpdate(followerId, {
      $addToSet: { followingChannels: channelId }
    });

    res.status(201).json({
      success: true,
      data: follow,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user's followings
// @route   GET /api/followers/me
// @access  Private
exports.getFollowings = async (req, res, next) => {
  try {
    const followings = await Follower.find({ follower: req.user.id }).populate('channel', 'name avatar followersCount channelName');

    res.status(200).json({
      success: true,
      count: followings.length,
      data: followings,
    });
  } catch (err) {
    next(err);
  }
};
