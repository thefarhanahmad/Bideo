const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Follower = require('../models/Follower');
const { deleteLocalFile } = require('../utils/localUpload');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const VideoView = require('../models/VideoView');

const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc Create user
// @route POST /api/users
// @access Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, avatar, role, phone, channelName, password } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required' });

    const trimmedName = name.trim();
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ success: false, message: 'User with this email already exists' });

    const existingName = await User.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
    });
    if (existingName) {
      return res.status(400).json({ success: false, message: 'Username is already taken' });
    }

    if (phone) {
      const existingPhone = await User.findOne({ phone: phone.trim() });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Phone number already registered' });
      }
    }

    let trimmedChannel = undefined;
    if (channelName && typeof channelName === 'string' && channelName.trim()) {
      trimmedChannel = channelName.trim();
      const existingChannel = await User.findOne({
        channelName: { $regex: new RegExp(`^${escapeRegex(trimmedChannel)}$`, 'i') },
      });
      if (existingChannel) {
        return res.status(400).json({ success: false, message: 'Channel name already exists' });
      }
    }

    const userData = {
      name: trimmedName,
      email,
      avatar: avatar || '',
      role: role || 'user',
      channelNameEditCount: 0,
      channelNameChangedAt: trimmedChannel ? new Date() : null,
    };
    if (phone) userData.phone = phone.trim();
    if (trimmedChannel) userData.channelName = trimmedChannel;
    if (password) userData.password = password;

    const user = await User.create(userData);
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
    const { channelName, about, avatar, coverImage, name } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let trimmedChannelName = undefined;
    let shouldUpdateChannelName = false;

    if (channelName !== undefined) {
      if (typeof channelName !== 'string' || channelName.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Channel name cannot be empty' });
      }
      trimmedChannelName = channelName.trim();
      if (trimmedChannelName.length > 25) {
        return res.status(400).json({ success: false, message: 'Channel name cannot exceed 25 characters' });
      }

      const currentChannelName = user.channelName ? user.channelName.trim() : '';
      if (trimmedChannelName.toLowerCase() !== currentChannelName.toLowerCase()) {
        shouldUpdateChannelName = true;

        const existingChannel = await User.findOne({
          _id: { $ne: user._id },
          channelName: { $regex: new RegExp(`^${escapeRegex(trimmedChannelName)}$`, 'i') },
        });

        if (existingChannel) {
          return res.status(400).json({
            success: false,
            message: 'Channel name already exists. Please choose a different channel name.',
          });
        }

        const isFirstCreation = !user.channelName;
        if (!isFirstCreation) {
          const editCount = user.channelNameEditCount || 0;
          if (editCount >= 1 && user.channelNameChangedAt) {
            const COOLDOWN_DAYS = 60;
            const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
            const timeSinceLastChange = Date.now() - new Date(user.channelNameChangedAt).getTime();

            if (timeSinceLastChange < COOLDOWN_MS) {
              const daysRemaining = Math.max(1, Math.ceil((COOLDOWN_MS - timeSinceLastChange) / (24 * 60 * 60 * 1000)));
              const nextAllowedDate = new Date(new Date(user.channelNameChangedAt).getTime() + COOLDOWN_MS);
              return res.status(400).json({
                success: false,
                message: `You can only change your channel name once every 60 days. You will be able to change it again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
                daysRemaining,
                nextAllowedDate,
              });
            }
          }
        }
      }
    }

    const updateFields = {};
    if (about !== undefined) updateFields.about = about;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (coverImage !== undefined) updateFields.coverImage = coverImage;
    if (name !== undefined && typeof name === 'string' && name.trim()) updateFields.name = name.trim();

    if (shouldUpdateChannelName && trimmedChannelName) {
      updateFields.channelName = trimmedChannelName;
      const isFirstCreation = !user.channelName;
      if (isFirstCreation) {
        updateFields.channelNameEditCount = 0;
        updateFields.channelNameChangedAt = new Date();
      } else {
        updateFields.channelNameEditCount = (user.channelNameEditCount || 0) + 1;
        updateFields.channelNameChangedAt = new Date();
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// @desc    Search users for @mention autocomplete
// @route   GET /api/users/search
// @access  Public
exports.searchUsers = async (req, res, next) => {
  try {
    const rawQ = req.query.q || req.query.search || '';
    const q = rawQ.replace(/^@/, '').trim();

    const query = { isBlocked: { $ne: true } };

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const isObjectId = mongoose.Types.ObjectId.isValid(q);

      const orClauses = [
        { channelName: regex },
        { name: regex },
      ];
      if (isObjectId) {
        orClauses.push({ _id: q });
      }
      query.$or = orClauses;
    }

    const users = await User.find(query)
      .select('name channelName avatar isVerified followersCount')
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(15)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

exports.getChannelProfile = async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const cleanId = rawId ? rawId.replace(/^@/, '').trim() : '';
    const isObjectId = mongoose.Types.ObjectId.isValid(cleanId);

    let channelObj = null;
    if (isObjectId) {
      channelObj = await User.findById(cleanId).select('name avatar coverImage channelName about followersCount isVerified isBlocked blockedAt blockReason createdAt');
    }

    if (!channelObj && cleanId) {
      const escaped = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      channelObj = await User.findOne({
        $or: [
          { channelName: regex },
          { name: regex },
          { email: regex },
        ],
      }).select('name avatar coverImage channelName about followersCount isVerified isBlocked blockedAt blockReason createdAt');
    }

    if (!channelObj) return res.status(404).json({ success: false, message: 'Channel not found' });

    const channel = channelObj.toObject();
    const isOwner = req.user && req.user.id.toString() === channel._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    if (channel.isBlocked && !isAdmin && !isOwner) {
      return res.status(404).json({ success: false, message: 'This channel has been suspended' });
    }

    if (req.user) {
      const isFollowing = await Follower.findOne({
        follower: req.user.id,
        channel: channel._id,
      });
      channel.isFollowing = !!isFollowing;
    } else {
      channel.isFollowing = false;
    }

    const [followersCount, followingCount] = await Promise.all([
      Follower.countDocuments({ channel: channel._id }),
      Follower.countDocuments({ follower: channel._id }),
    ]);
    channel.followersCount = followersCount;
    channel.followingCount = followingCount;

    const filter = (req.query.filter || 'videos').toLowerCase();
    const sort = (req.query.sort || 'latest').toLowerCase();
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
        .populate('owner', 'name avatar channelName isVerified')
        .sort(sortQuery)
        .limit(60)
        .lean();
    } else {
      if (filter === 'shorts') {
        videoQuery.isShort = true;
      } else {
        videoQuery.isShort = { $ne: true };
      }

      videos = await Video.find(videoQuery)
        .populate('owner', 'name avatar channelName followersCount isVerified')
        .populate('category', 'name')
        .sort(sortQuery)
        .limit(60)
        .lean();
    }

    // Calculate channel views for this week (last 7 days) and check if in Top 3 weekly leaderboard
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const channelWeeklyViews = await VideoView.aggregate([
      { $match: { createdAt: { $gte: oneWeekAgo } } },
      {
        $lookup: {
          from: 'videos',
          localField: 'video',
          foreignField: '_id',
          as: 'videoDoc',
        },
      },
      { $unwind: '$videoDoc' },
      { $match: { 'videoDoc.owner': channel._id, 'videoDoc.visibility': 'public' } },
      { $count: 'weeklyViews' },
    ]);
    const myWeeklyViews = channelWeeklyViews[0]?.weeklyViews || 0;
    channel.weeklyViews = myWeeklyViews;

    let leaderboardRank = null;
    if (channelObj.role === 'user' && myWeeklyViews > 0) {
      const higherCount = await VideoView.aggregate([
        { $match: { createdAt: { $gte: oneWeekAgo } } },
        {
          $lookup: {
            from: 'videos',
            localField: 'video',
            foreignField: '_id',
            as: 'videoDoc',
          },
        },
        { $unwind: '$videoDoc' },
        { $match: { 'videoDoc.visibility': 'public' } },
        { $group: { _id: '$videoDoc.owner', total: { $sum: 1 } } },
        { $match: { total: { $gt: myWeeklyViews } } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.role': 'user', 'user.isBlocked': { $ne: true } } },
        { $count: 'higher' },
      ]);
      const rank = (higherCount[0]?.higher || 0) + 1;
      if (rank <= 3) {
        leaderboardRank = rank;
      }
    }
    channel.leaderboardRank = leaderboardRank;

    res.status(200).json({ success: true, data: { channel, videos, posts } });
  } catch (err) {
    next(err);
  }
};

// @desc    Get top 20 creators by views for this week (Weekly Leaderboard)
// @route   GET /api/users/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res, next) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const aggregated = await VideoView.aggregate([
      // 1. Only views from this week (last 7 days)
      { $match: { createdAt: { $gte: oneWeekAgo } } },
      // 2. Lookup video
      {
        $lookup: {
          from: 'videos',
          localField: 'video',
          foreignField: '_id',
          as: 'videoDoc',
        },
      },
      { $unwind: '$videoDoc' },
      // 3. Only public videos
      { $match: { 'videoDoc.visibility': 'public' } },
      // 4. Group by creator
      {
        $group: {
          _id: '$videoDoc.owner',
          weeklyViews: { $sum: 1 },
          videoCount: { $addToSet: '$videoDoc._id' },
        },
      },
      // 5. Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      // 6. Filter strictly non-admin user accounts and non-blocked accounts
      {
        $match: {
          'user.role': 'user',
          'user.isBlocked': { $ne: true },
        },
      },
      // 7. Sort by this week's views descending
      { $sort: { weeklyViews: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          channelName: '$user.channelName',
          avatar: '$user.avatar',
          isVerified: '$user.isVerified',
          followersCount: '$user.followersCount',
          about: '$user.about',
          totalViews: '$weeklyViews',
          weeklyViews: '$weeklyViews',
          videoCount: { $size: '$videoCount' },
        },
      },
    ]);

    let leaderboard = [...aggregated];

    // If fewer than 50 creators have views this week, fill remaining slots up to 50 with other active user accounts
    if (leaderboard.length < 50) {
      const existingIds = leaderboard.map((item) => item._id);
      const remainingCount = 50 - leaderboard.length;
      const additionalUsers = await User.find({
        _id: { $nin: existingIds },
        role: 'user',
        isBlocked: { $ne: true },
      })
        .select('_id name channelName avatar isVerified followersCount about')
        .sort({ followersCount: -1, createdAt: -1 })
        .limit(remainingCount)
        .lean();

      for (const u of additionalUsers) {
        leaderboard.push({
          _id: u._id,
          name: u.name,
          channelName: u.channelName,
          avatar: u.avatar,
          isVerified: u.isVerified,
          followersCount: u.followersCount || 0,
          about: u.about,
          totalViews: 0,
          weeklyViews: 0,
          videoCount: 0,
        });
      }
    }

    leaderboard.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));

    let userFollowings = new Set();
    if (req.user) {
      const followings = await Follower.find({ follower: req.user.id }).select('channel').lean();
      userFollowings = new Set(followings.map((f) => f.channel.toString()));
    }

    const results = leaderboard.slice(0, 50).map((item, idx) => {
      const rank = idx + 1;
      return {
        ...item,
        rank,
        isFollowing: userFollowings.has(item._id.toString()),
        isCurrentUser: req.user ? req.user.id.toString() === item._id.toString() : false,
      };
    });

    // 2. Aggregate top creators by new followers gained this week or highest followers
    const weeklyFollowersAgg = await Follower.aggregate([
      { $match: { createdAt: { $gte: oneWeekAgo } } },
      {
        $group: {
          _id: '$channel',
          weeklyGain: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.role': 'user',
          'user.isBlocked': { $ne: true },
        },
      },
      { $sort: { weeklyGain: -1, 'user.followersCount': -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          channelName: '$user.channelName',
          avatar: '$user.avatar',
          isVerified: '$user.isVerified',
          followersCount: '$user.followersCount',
          about: '$user.about',
          weeklyGain: '$weeklyGain',
        },
      },
    ]);

    let topFollowers = [...weeklyFollowersAgg];
    if (topFollowers.length < 10) {
      const existingIds = topFollowers.map((u) => u._id);
      const remainingNeeded = 10 - topFollowers.length;
      const extraCreators = await User.find({
        _id: { $nin: existingIds },
        role: 'user',
        isBlocked: { $ne: true },
      })
        .select('_id name channelName avatar isVerified followersCount about')
        .sort({ followersCount: -1, createdAt: -1 })
        .limit(remainingNeeded)
        .lean();

      for (const u of extraCreators) {
        topFollowers.push({
          _id: u._id,
          name: u.name,
          channelName: u.channelName,
          avatar: u.avatar,
          isVerified: u.isVerified,
          followersCount: u.followersCount || 0,
          about: u.about,
          weeklyGain: 0,
        });
      }
    }

    topFollowers.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));

    const topFollowersResults = topFollowers.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      isFollowing: userFollowings.has(item._id.toString()),
      isCurrentUser: req.user ? req.user.id.toString() === item._id.toString() : false,
    }));

    res.status(200).json({
      success: true,
      timeframe: 'this_week',
      count: results.length,
      topFollowers: topFollowersResults,
      topViews: results,
      data: {
        topFollowers: topFollowersResults,
        topViews: results,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc Get all users
// @route GET /api/users
// @access Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const rawSearch = req.query.search || req.query.q || '';
    const search = rawSearch.trim();

    let query = {};
    if (req.query.role) {
      query.role = req.query.role;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const isObjectId = mongoose.Types.ObjectId.isValid(search);
      const orList = [
        { name: regex },
        { channelName: regex },
        { email: regex },
        { phone: regex },
        { about: regex },
      ];
      if (isObjectId) {
        orList.push({ _id: search });
      }
      query.$or = orList;
    }

    if (req.query.simple === 'true') {
      const simpleUsers = await User.find(query)
        .select('name channelName avatar isVerified email phone role')
        .sort('channelName name')
        .lean();
      return res.status(200).json({ success: true, count: simpleUsers.length, data: simpleUsers });
    }

    const [users, approvedApps] = await Promise.all([
      User.find(query).sort('-createdAt').select('-password -__v').lean(),
      MonetizationApplication.find({ status: 'approved' }).select('user').lean(),
    ]);

    const approvedUserIds = new Set(
      approvedApps
        .filter((a) => a.user)
        .map((a) => a.user.toString())
    );

    const usersWithMonetization = users.map((u) => ({
      ...u,
      isMonetized: approvedUserIds.has(u._id.toString()),
    }));

    res.status(200).json({ success: true, count: usersWithMonetization.length, data: usersWithMonetization });
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
    const isMonetized = await MonetizationApplication.exists({ user: user._id, status: 'approved' });
    const uObj = user.toObject();
    uObj.isMonetized = !!isMonetized;
    res.status(200).json({ success: true, data: uObj });
  } catch (err) {
    next(err);
  }
};

// @desc Update user
// @route PUT /api/users/:id
// @access Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    const update = { ...req.body };

    if (update.name !== undefined) {
      if (typeof update.name === 'string' && update.name.trim()) {
        const trimmedName = update.name.trim();
        const existingName = await User.findOne({
          _id: { $ne: req.params.id },
          name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
        });
        if (existingName) {
          return res.status(400).json({ success: false, message: 'Username is already taken' });
        }
        update.name = trimmedName;
      } else {
        delete update.name;
      }
    }

    // Clean up unique/sparse string fields so empty strings don't trigger E11000 duplicate key error
    if (update.email !== undefined) {
      if (typeof update.email === 'string' && update.email.trim()) {
        const trimmedEmail = update.email.trim().toLowerCase();
        const existingEmail = await User.findOne({
          _id: { $ne: req.params.id },
          email: trimmedEmail,
        });
        if (existingEmail) {
          return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        update.email = trimmedEmail;
      } else {
        delete update.email;
      }
    }

    if (update.phone !== undefined) {
      if (typeof update.phone === 'string' && update.phone.trim()) {
        const trimmedPhone = update.phone.trim();
        const existingPhone = await User.findOne({
          _id: { $ne: req.params.id },
          phone: trimmedPhone,
        });
        if (existingPhone) {
          return res.status(400).json({ success: false, message: 'Phone number already exists' });
        }
        update.phone = trimmedPhone;
      } else {
        delete update.phone;
      }
    }

    if (update.channelName !== undefined) {
      if (typeof update.channelName === 'string' && update.channelName.trim()) {
        const trimmedChannel = update.channelName.trim();
        if (trimmedChannel.length > 25) {
          return res.status(400).json({ success: false, message: 'Channel name cannot exceed 25 characters' });
        }
        const existingChannel = await User.findOne({
          _id: { $ne: req.params.id },
          channelName: { $regex: new RegExp(`^${escapeRegex(trimmedChannel)}$`, 'i') },
        });
        if (existingChannel) {
          return res.status(400).json({ success: false, message: 'Channel name already exists' });
        }
        update.channelName = trimmedChannel;
      } else {
        delete update.channelName;
      }
    }

    if (update.walletBalance !== undefined) {
      const balanceNum = Number(update.walletBalance);
      if (isNaN(balanceNum) || balanceNum < 0) {
        return res.status(400).json({ success: false, message: 'Wallet balance must be a valid non-negative number' });
      }
      update.walletBalance = balanceNum;
    }

    if (update.totalEarnings !== undefined) {
      const earningsNum = Number(update.totalEarnings);
      if (isNaN(earningsNum) || earningsNum < 0) {
        return res.status(400).json({ success: false, message: 'Total earnings must be a valid non-negative number' });
      }
      update.totalEarnings = earningsNum;
    }

    if (update.isVerified !== undefined) {
      update.isVerified = Boolean(update.isVerified);
    }

    // Hash password if admin is resetting/setting a new password for the user
    if (update.password && typeof update.password === 'string' && update.password.trim().length > 0) {
      if (update.password.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password.trim(), salt);
    } else {
      delete update.password;
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user verification badge
// @route   PUT /api/users/:id/verify
// @access  Private/Admin
exports.toggleVerifyUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isVerified = !user.isVerified;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isVerified ? 'Verification badge granted' : 'Verification badge removed',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user blocked status (Admin)
// @route   PUT /api/users/:id/block
// @access  Private/Admin
exports.toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot block an administrator account' });
    }

    const isCurrentlyBlocked = Boolean(user.isBlocked);
    user.isBlocked = !isCurrentlyBlocked;
    user.blockedAt = user.isBlocked ? new Date() : null;
    user.blockReason = user.isBlocked ? (req.body.reason || 'Blocked by administrator') : null;

    await user.save();

    res.status(200).json({
      success: true,
      message: user.isBlocked ? 'User has been blocked successfully' : 'User has been unblocked successfully',
      data: user,
    });
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
    if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ success: false, message: 'Valid videoId is required' });
    }

    const videoObjId = new mongoose.Types.ObjectId(videoId);

    // 1. Atomically remove duplicate if already present in history
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { watchHistory: videoObjId } }
    );

    // 2. Atomically prepend to the beginning ($position: 0) and slice to max 50 items (avoids VersionError)
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          watchHistory: {
            $each: [videoObjId],
            $position: 0,
            $slice: 50,
          },
        },
      },
      { new: true, select: 'watchHistory' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: updatedUser.watchHistory || [] });
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

    res.status(200).json({ success: true, data: user?.watchHistory || [] });
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
    res.status(200).json({ success: true, data: user?.likedVideos || [] });
  } catch (err) {
    next(err);
  }
};

exports.addSearchHistory = async (req, res, next) => {
  try {
    const term = (req.body.term || '').trim();
    if (!term) return res.status(400).json({ success: false, message: 'Search term is required' });

    const searchItem = { term, createdAt: new Date() };
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Atomically remove existing search item matching term case-insensitively
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { searchHistory: { term: new RegExp(`^${escapedTerm}$`, 'i') } } }
    );

    // 2. Atomically prepend new search term and cap at 20 entries (avoids VersionError)
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          searchHistory: {
            $each: [searchItem],
            $position: 0,
            $slice: 20,
          },
        },
      },
      { new: true, select: 'searchHistory' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: updatedUser.searchHistory || [] });
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
    // Delete avatar and cover image from local storage
    if (user.avatar) {
      deleteLocalFile(user.avatar);
    }
    if (user.coverImage) {
      deleteLocalFile(user.coverImage);
    }

    await user.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Get monetization onboarding status and checklist
// @route   GET /api/users/monetization-status
// @access  Private
exports.getMonetizationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Fetch only review statuses that exist
    const reviews = await VideoMonetizationReview.find({ user: userId }).populate('video', 'title thumbnail createdAt');
    
    // 2. Count passed videos
    const passedVideosCount = reviews.filter(r => r.status === 'passed').length;
    const step1Completed = passedVideosCount >= 3;

    // 3. Fetch monetization application
    const application = await MonetizationApplication.findOne({ user: userId });
    const step2Completed = application ? application.status === 'approved' : false;

    // 4. Fetch user document and calculate total views
    const userDoc = await User.findById(userId);
    const userVideos = await Video.find({ owner: userId });
    const totalViews = userVideos.reduce((acc, v) => acc + (v.views || 0), 0);

    const walletBalance = userDoc?.walletBalance || 0;
    const totalEarnings = userDoc?.totalEarnings || 0;

    const defaultRate = Number(process.env.VIEW_REWARD_RATE) || 0.15;
    const longRate = !isNaN(Number(process.env.LONG_VIDEO_REWARD_RATE))
      ? Number(process.env.LONG_VIDEO_REWARD_RATE)
      : defaultRate;
    const shortRate = !isNaN(Number(process.env.SHORT_VIDEO_REWARD_RATE))
      ? Number(process.env.SHORT_VIDEO_REWARD_RATE)
      : 0.05;

    res.status(200).json({
      success: true,
      data: {
        passedVideosCount,
        step1Completed,
        step2Completed,
        reviews,
        application,
        walletBalance: Math.round((walletBalance || 0) * 100) / 100,
        totalEarnings: Math.round((totalEarnings || 0) * 100) / 100,
        totalViews,
        ratePerThousandViews: Math.round(longRate * 1000),
        ratePerView: longRate,
        longVideoRatePerView: longRate,
        longVideoRatePerThousandViews: Math.round(longRate * 1000),
        shortVideoRatePerView: shortRate,
        shortVideoRatePerThousandViews: Math.round(shortRate * 1000),
        minWithdrawal: 1000,
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Request a payout / earnings withdrawal
// @route   POST /api/users/withdraw
// @access  Private
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, payoutMethod, payoutDetails } = req.body;

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹1,000',
      });
    }

    if (!payoutMethod || !['upi', 'bank'].includes(payoutMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a valid payout method (UPI or Bank)',
      });
    }

    const application = await MonetizationApplication.findOne({ user: userId, status: 'approved' });
    if (!application) {
      return res.status(403).json({
        success: false,
        message: 'Monetization approval is required to withdraw earnings',
      });
    }

    // Prepare details with fallback to approved application details
    const finalPayoutDetails = {
      upiId: payoutMethod === 'upi' ? (payoutDetails?.upiId || application.upiId) : null,
      bankName: payoutMethod === 'bank' ? (payoutDetails?.bankName || application.bankDetails?.bankName) : null,
      accountNumber: payoutMethod === 'bank' ? (payoutDetails?.accountNumber || application.bankDetails?.accountNumber) : null,
      ifscCode: payoutMethod === 'bank' ? (payoutDetails?.ifscCode || application.bankDetails?.ifscCode) : null,
      holderName: application.name || req.user.name,
    };

    if (payoutMethod === 'upi' && !finalPayoutDetails.upiId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid UPI ID' });
    }
    if (payoutMethod === 'bank' && (!finalPayoutDetails.accountNumber || !finalPayoutDetails.ifscCode)) {
      return res.status(400).json({ success: false, message: 'Please provide valid Bank Account & IFSC code' });
    }

    // Atomically deduct wallet balance only if sufficient balance is available (prevents race condition / double-spending)
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: withdrawAmount } },
      { $inc: { walletBalance: -withdrawAmount } },
      { new: true }
    );

    if (!updatedUser) {
      const currentUser = await User.findById(userId).select('walletBalance');
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Available: ₹${(currentUser?.walletBalance || 0).toFixed(2)}`,
      });
    }

    let withdrawal;
    try {
      withdrawal = await WithdrawalRequest.create({
        user: userId,
        amount: withdrawAmount,
        payoutMethod,
        payoutDetails: finalPayoutDetails,
        status: 'pending',
      });
    } catch (createErr) {
      // Rollback deducted balance if withdrawal creation fails
      await User.findByIdAndUpdate(userId, { $inc: { walletBalance: withdrawAmount } });
      throw createErr;
    }

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully! Funds will be transferred within 24-48 hours.',
      data: withdrawal,
      walletBalance: updatedUser.walletBalance,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's withdrawal history
// @route   GET /api/users/withdrawals
// @access  Private
exports.getWithdrawalHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const withdrawals = await WithdrawalRequest.find({ user: userId }).sort('-createdAt');
    res.status(200).json({
      success: true,
      count: withdrawals.length,
      data: withdrawals,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit verification details to apply for monetization
// @route   POST /api/users/apply-monetization
// @access  Private
exports.applyMonetization = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, adharNumber, upiId, bankDetails } = req.body;

    // Validation: Require essential fields (adharNumber & upiId are optional)
    if (!name || !phone || !bankDetails || !bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifscCode) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields, including bank details' });
    }

    // Eligibility check: Check if they have at least 3 passed videos
    const passedReviewsCount = await VideoMonetizationReview.countDocuments({ user: userId, status: 'passed' });
    if (passedReviewsCount < 3) {
      return res.status(400).json({ success: false, message: 'You must have at least 3 approved videos to apply for monetization' });
    }

    const cleanAdhar = adharNumber ? String(adharNumber).trim() : '';
    const cleanUpi = upiId ? String(upiId).trim() : '';

    // Insert or update the application
    let application = await MonetizationApplication.findOne({ user: userId });
    if (application) {
      application.name = name;
      application.phone = phone;
      application.adharNumber = cleanAdhar;
      application.upiId = cleanUpi;
      application.bankDetails = bankDetails;
      application.status = 'pending'; // Reset status to pending upon edit/re-submission
      application.reviewMessage = ''; // Clear past rejection messages
      application.updatedAt = Date.now();
      await application.save();
    } else {
      application = await MonetizationApplication.create({
        user: userId,
        name,
        phone,
        adharNumber: cleanAdhar,
        upiId: cleanUpi,
        bankDetails,
        status: 'pending'
      });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
};

// @desc    Schedule profile deletion (5-day grace period)
// @route   POST /api/users/schedule-deletion
// @access  Private
exports.scheduleProfileDeletion = async (req, res, next) => {
  try {
    const { reason, password } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for profile deletion' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify password if user registered via phone/has password set
    if (user.password) {
      if (!password) {
        return res.status(400).json({ success: false, message: 'Please enter your password to confirm deletion' });
      }
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect password' });
      }
    }

    const gracePeriodMs = 5 * 24 * 60 * 60 * 1000; // 5 days
    const scheduledDate = new Date(Date.now() + gracePeriodMs);

    user.deletionScheduled = true;
    user.deletionScheduledAt = new Date();
    user.scheduledDeletionDate = scheduledDate;
    user.deletionReason = reason.trim();
    user.deletionStatus = 'scheduled';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile deletion scheduled successfully. You have 5 days to recover your account.',
      data: {
        deletionScheduled: user.deletionScheduled,
        deletionScheduledAt: user.deletionScheduledAt,
        scheduledDeletionDate: user.scheduledDeletionDate,
        deletionReason: user.deletionReason,
        deletionStatus: user.deletionStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit account recovery request (Pending admin approval)
// @route   POST /api/users/recover-account
// @access  Private
exports.recoverAccount = async (req, res, next) => {
  try {
    const { recoveryReason, recoveryNotes } = req.body;

    if (!recoveryReason || !recoveryReason.trim()) {
      return res.status(400).json({ success: false, message: 'Please select a reason for account recovery' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.deletionScheduled) {
      return res.status(400).json({ success: false, message: 'Account is not currently scheduled for deletion' });
    }

    user.recoveryRequested = true;
    user.recoveryRequestedAt = new Date();
    user.recoveryReason = recoveryReason.trim();
    user.recoveryNotes = recoveryNotes ? recoveryNotes.trim() : '';
    user.deletionStatus = 'recovery_requested';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account recovery request submitted successfully. Waiting for admin approval.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user profile deletion status
// @route   GET /api/users/deletion-status
// @access  Private
exports.getDeletionStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        deletionScheduled: !!user.deletionScheduled,
        deletionScheduledAt: user.deletionScheduledAt,
        scheduledDeletionDate: user.scheduledDeletionDate,
        deletionReason: user.deletionReason,
        deletionStatus: user.deletionStatus || 'none',
        recoveryRequested: !!user.recoveryRequested,
        recoveryRequestedAt: user.recoveryRequestedAt,
        recoveryReason: user.recoveryReason,
        recoveryNotes: user.recoveryNotes,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users scheduled for deletion or requesting recovery
// @route   GET /api/users/scheduled-deletions
// @access  Private/Admin
exports.getScheduledDeletions = async (req, res, next) => {
  try {
    const users = await User.find({ deletionScheduled: true }).sort('-scheduledDeletionDate').select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel profile deletion schedule and restore user (Admin)
// @route   POST /api/users/:id/cancel-deletion
// @access  Private/Admin
exports.cancelDeletionByAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.deletionScheduled = false;
    user.deletionScheduledAt = null;
    user.scheduledDeletionDate = null;
    user.deletionReason = null;
    user.recoveryRequested = false;
    user.recoveryRequestedAt = null;
    user.recoveryReason = null;
    user.recoveryNotes = null;
    user.deletionStatus = 'canceled';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile deletion schedule canceled and account restored by admin',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reject account recovery request (Admin)
// @route   POST /api/users/:id/reject-recovery
// @access  Private/Admin
exports.rejectRecoveryByAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.recoveryRequested = false;
    user.deletionStatus = 'scheduled';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account recovery request rejected. Profile deletion remains scheduled.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit web account deletion request (Public)
// @route   POST /api/users/web-deletion-request
// @access  Public
exports.requestWebDeletion = async (req, res, next) => {
  try {
    const { name, phoneOrEmail, reason, notes } = req.body;

    if (!name || !name.trim() || !phoneOrEmail || !phoneOrEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Name and registered Phone or Email are required' });
    }

    const input = phoneOrEmail.trim();
    // Search user by phone or email
    const user = await User.findOne({
      $or: [{ phone: input }, { email: input.toLowerCase() }],
    });

    if (user) {
      const gracePeriodMs = 5 * 24 * 60 * 60 * 1000; // 5 days
      user.deletionScheduled = true;
      user.deletionScheduledAt = new Date();
      user.scheduledDeletionDate = new Date(Date.now() + gracePeriodMs);
      user.deletionReason = `[Web Request] ${reason || 'Play Store Portal'}${notes ? ` - ${notes}` : ''}`;
      user.deletionStatus = 'scheduled';
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Account deletion request submitted successfully. Account scheduled for permanent deletion within 5 days.',
    });
  } catch (err) {
    next(err);
  }
};

