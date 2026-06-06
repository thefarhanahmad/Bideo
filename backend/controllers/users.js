const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Follower = require('../models/Follower');
const { deleteFromCloudinary } = require('../utils/cloudinary');

// @desc Create user
// @route POST /api/users
// @access Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, avatar, role } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required' });

    let existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'User with this email already exists' });

    const user = await User.create({ name, email, avatar: avatar || '', role: role || 'user' });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Update user channel info
// @route PUT /api/users/channel
// @access Private
exports.updateChannel = async (req, res, next) => {
  try {
    const { channelName, about, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { channelName, about, avatar },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.getChannelProfile = async (req, res, next) => {
  try {
    const channelObj = await User.findById(req.params.id).select('name avatar channelName about followersCount createdAt');
    if (!channelObj) return res.status(404).json({ success: false, message: 'Channel not found' });

    const channel = channelObj.toObject();
    if (req.user) {
      const isFollowing = await Follower.findOne({
        follower: req.user.id,
        channel: req.params.id,
      });
      channel.isFollowing = !!isFollowing;
    } else {
      channel.isFollowing = false;
    }

    const filter = (req.query.filter || 'videos').toLowerCase();
    const sort = (req.query.sort || 'latest').toLowerCase();
    const isOwner = req.user && req.user.id.toString() === channel._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';
    const visibilityQuery = isOwner || isAdmin
      ? {}
      : { $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] };
    const videoQuery = { owner: channel._id, ...visibilityQuery };
    const postQuery = { owner: channel._id, ...visibilityQuery };

    let sortQuery = { createdAt: -1 };
    if (sort === 'popular') sortQuery = { views: -1, createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };

    let videos = [];
    let posts = [];

    if (filter === 'posts') {
      posts = await Post.find(postQuery)
        .populate('owner', 'name avatar channelName')
        .sort(sortQuery);
    } else {
      if (filter === 'shorts') {
        videoQuery.isShort = true;
      } else {
        videoQuery.isShort = { $ne: true };
      }

      videos = await Video.find(videoQuery)
        .populate('owner', 'name avatar channelName followersCount')
        .populate('category', 'name')
        .sort(sortQuery);
    }

    res.status(200).json({ success: true, data: { channel, videos, posts } });
  } catch (err) {
    next(err);
  }
};

// @desc Get all users
// @route GET /api/users
// @access Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-__v');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

// @desc Get single user
// @route GET /api/users/:id
// @access Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Update user
// @route PUT /api/users/:id
// @access Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    const update = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Add video to watch history
// @route   POST /api/users/history
// @access  Private
exports.addToHistory = async (req, res, next) => {
  try {
    const { videoId } = req.body;
    const user = await User.findById(req.user.id);

    // Remove if already exists to move to top
    user.watchHistory = (user.watchHistory || []).filter(id => id.toString() !== videoId);
    user.watchHistory.unshift(videoId);
    
    // Keep only last 50
    if (user.watchHistory.length > 50) {
      user.watchHistory = user.watchHistory.slice(0, 50);
    }

    await user.save();
    res.status(200).json({ success: true, data: user.watchHistory });
  } catch (err) {
    next(err);
  }
};

// @desc    Get watch history
// @route   GET /api/users/history
// @access  Private
exports.getHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'watchHistory',
      populate: { path: 'owner', select: 'name channelName avatar' }
    });

    res.status(200).json({ success: true, data: user.watchHistory || [] });
  } catch (err) {
    next(err);
  }
};

exports.getLikedVideos = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'likedVideos',
      populate: [
        { path: 'owner', select: 'name channelName avatar' },
        { path: 'category', select: 'name' },
      ],
    });
    res.status(200).json({ success: true, data: user.likedVideos || [] });
  } catch (err) {
    next(err);
  }
};

exports.addSearchHistory = async (req, res, next) => {
  try {
    const term = (req.body.term || '').trim();
    if (!term) return res.status(400).json({ success: false, message: 'Search term is required' });
    const user = await User.findById(req.user.id);
    user.searchHistory = (user.searchHistory || []).filter((item) => item.term.toLowerCase() !== term.toLowerCase());
    user.searchHistory.unshift({ term, createdAt: new Date() });
    user.searchHistory = user.searchHistory.slice(0, 20);
    await user.save();
    res.status(200).json({ success: true, data: user.searchHistory });
  } catch (err) {
    next(err);
  }
};

exports.getSearchHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('searchHistory');
    res.status(200).json({ success: true, data: user.searchHistory || [] });
  } catch (err) {
    next(err);
  }
};

exports.clearSearchHistory = async (req, res, next) => {
  try {
    const term = req.query.term;
    const update = term
      ? { $pull: { searchHistory: { term } } }
      : { $set: { searchHistory: [] } };
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('searchHistory');
    res.status(200).json({ success: true, data: user.searchHistory || [] });
  } catch (err) {
    next(err);
  }
};

// @desc Delete user
// @route DELETE /api/users/:id
// @access Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Delete avatar from Cloudinary
    if (user.avatar) {
      await deleteFromCloudinary(user.avatar, 'image');
    }

    await user.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
