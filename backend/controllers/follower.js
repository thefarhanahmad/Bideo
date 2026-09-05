const mongoose = require('mongoose');
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

    if (!mongoose.isValidObjectId(channelId)) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const channel = await User.findById(channelId).select('_id');
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
      
      // Update counts atomically without triggering full document schema validation
      await User.findByIdAndUpdate(channelId, {
        $inc: { followersCount: -1 }
      });
      await User.updateOne(
        { _id: channelId, followersCount: { $lt: 0 } },
        { $set: { followersCount: 0 } }
      );

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

    // Update counts atomically without triggering full document schema validation
    await User.findByIdAndUpdate(channelId, {
      $inc: { followersCount: 1 }
    });

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
    const followings = await Follower.find({ follower: req.user.id }).populate('channel', 'name avatar followersCount channelName isVerified');

    res.status(200).json({
      success: true,
      count: followings.length,
      data: followings,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get channel's followers
// @route   GET /api/followers/:channelId/followers
// @access  Public (softProtect)
exports.getChannelFollowers = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [followersDocs, total] = await Promise.all([
      Follower.find({ channel: channelId })
        .populate('follower', 'name avatar channelName isVerified followersCount about')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Follower.countDocuments({ channel: channelId }),
    ]);

    let myFollowings = new Set();
    if (req.user) {
      const followList = await Follower.find({ follower: req.user.id }).select('channel').lean();
      myFollowings = new Set(followList.map((f) => f.channel.toString()));
    }

    const data = followersDocs
      .filter((doc) => doc.follower)
      .map((doc) => {
        const u = doc.follower;
        return {
          _id: u._id,
          name: u.name,
          channelName: u.channelName,
          avatar: u.avatar,
          isVerified: u.isVerified,
          followersCount: u.followersCount || 0,
          about: u.about,
          isFollowing: myFollowings.has(u._id.toString()),
          isMe: req.user ? req.user.id.toString() === u._id.toString() : false,
          followedAt: doc.createdAt,
        };
      });

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get channel's followings
// @route   GET /api/followers/:channelId/followings
// @access  Public (softProtect)
exports.getChannelFollowings = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [followingsDocs, total] = await Promise.all([
      Follower.find({ follower: channelId })
        .populate('channel', 'name avatar channelName isVerified followersCount about')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Follower.countDocuments({ follower: channelId }),
    ]);

    let myFollowings = new Set();
    if (req.user) {
      const followList = await Follower.find({ follower: req.user.id }).select('channel').lean();
      myFollowings = new Set(followList.map((f) => f.channel.toString()));
    }

    const data = followingsDocs
      .filter((doc) => doc.channel)
      .map((doc) => {
        const ch = doc.channel;
        return {
          _id: ch._id,
          name: ch.name,
          channelName: ch.channelName,
          avatar: ch.avatar,
          isVerified: ch.isVerified,
          followersCount: ch.followersCount || 0,
          about: ch.about,
          isFollowing: myFollowings.has(ch._id.toString()),
          isMe: req.user ? req.user.id.toString() === ch._id.toString() : false,
          followedAt: doc.createdAt,
        };
      });

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      data,
    });
  } catch (err) {
    next(err);
  }
};
