const mongoose = require('mongoose');
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Story = require('../models/Story');
const Follower = require('../models/Follower');
const Comment = require('../models/Comment');
const VideoReport = require('../models/VideoReport');
const WalletCredit = require('../models/WalletCredit');
const CoinTransaction = require('../models/CoinTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const VideoBoost = require('../models/VideoBoost');
const Playlist = require('../models/Playlist');
const Conversation = require('../models/Conversation');
// Registered here so populate('category') never depends on load order.
require('../models/Category');

// Read-only endpoints behind the admin user profile page.
// Every list is paginated and filtered on indexed fields only.

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 12;
const CHAT_MEMBERS_PREVIEW = 5;
const USER_CARD = 'name channelName avatar isVerified followersCount';
const VIDEO_CARD = 'title thumbnail videoUrl duration views commentsCount visibility isShort createdAt owner';

// likes / views / replies are arrays of user ids: return their sizes, not the arrays.
const sizeOf = (field) => ({ $size: { $ifNull: [`$${field}`, []] } });
const withCounts = (fields, counts) => ({
  ...Object.fromEntries(fields.split(' ').map((f) => [f, 1])),
  ...Object.fromEntries(Object.entries(counts).map(([name, field]) => [name, sizeOf(field)])),
});

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePaging = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
};

const searchRegex = (query) => {
  const raw = String(query.search || '').trim();
  return raw ? new RegExp(escapeRegex(raw.slice(0, 100)), 'i') : null;
};

const sortFor = (sort, popularField = 'views') => {
  if (sort === 'popular') return { [popularField]: -1, createdAt: -1 };
  if (sort === 'oldest') return { createdAt: 1 };
  return { createdAt: -1 };
};

const paged = async (model, filter, { page, limit, skip }, buildQuery) => {
  const [rows, total] = await Promise.all([
    buildQuery(model.find(filter).skip(skip).limit(limit)).lean(),
    model.countDocuments(filter),
  ]);
  return { data: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
};

// Paginates an array of ObjectIds stored on the user document (watch history, liked videos).
const pagedVideoIdList = async (userId, field, paging) => {
  const [doc] = await User.aggregate([
    { $match: { _id: userId } },
    {
      $project: {
        total: { $size: { $ifNull: [`$${field}`, []] } },
        ids: { $slice: [{ $reverseArray: { $ifNull: [`$${field}`, []] } }, paging.skip, paging.limit] },
      },
    },
  ]);
  const ids = (doc && doc.ids) || [];
  const videos = await Video.find({ _id: { $in: ids } })
    .select(VIDEO_CARD)
    .populate('owner', USER_CARD)
    .lean();
  const byId = new Map(videos.map((v) => [String(v._id), v]));
  const total = (doc && doc.total) || 0;
  return {
    data: ids.map((id) => byId.get(String(id)) || { _id: id, deleted: true }),
    total,
    page: paging.page,
    pages: Math.max(1, Math.ceil(total / paging.limit)),
  };
};

const tabHandlers = {
  videos: (userId, q, paging) => videoTab(userId, q, paging, false),
  shorts: (userId, q, paging) => videoTab(userId, q, paging, true),

  posts: (userId, q, paging) => {
    const filter = { owner: userId };
    if (['public', 'private', 'unlisted'].includes(q.filter)) filter.visibility = q.filter;
    const rx = searchRegex(q);
    if (rx) filter.text = rx;
    return paged(Post, filter, paging, (query) =>
      query
        .sort(sortFor(q.sort, 'commentsCount'))
        .select(withCounts('text imageUrl previewMedia visibility commentsCount createdAt', { likesCount: 'likes' })));
  },

  stories: (userId, q, paging) => {
    const filter = { user: userId };
    if (q.filter === 'active') filter.expiresAt = { $gt: new Date() };
    if (q.filter === 'expired') filter.expiresAt = { $lte: new Date() };
    return paged(Story, filter, paging, (query) =>
      query
        .sort({ createdAt: -1 })
        .select(withCounts('mediaUrl mediaType caption createdAt expiresAt', { viewsCount: 'views' })));
  },

  followers: (userId, q, paging) =>
    paged(Follower, { channel: userId }, paging, (query) =>
      query.sort({ createdAt: -1 }).populate('follower', USER_CARD)),

  following: (userId, q, paging) =>
    paged(Follower, { follower: userId }, paging, (query) =>
      query.sort({ createdAt: -1 }).populate('channel', USER_CARD)),

  comments: (userId, q, paging) => {
    const filter = { user: userId };
    const rx = searchRegex(q);
    if (rx) filter.text = rx;
    return paged(Comment, filter, paging, (query) =>
      query
        .sort({ createdAt: -1 })
        .select(withCounts('text video post isPinned isLoved createdAt', { likesCount: 'likes', repliesCount: 'replies' }))
        .populate('video', 'title thumbnail videoUrl isShort')
        .populate('post', 'text imageUrl'));
  },

  reports: async (userId, q, paging) => {
    let filter;
    if (q.filter === 'filed') {
      filter = { reporter: userId };
    } else {
      const videoIds = await Video.find({ owner: userId }).distinct('_id');
      filter = { video: { $in: videoIds } };
    }
    if (['open', 'reviewed', 'dismissed', 'actioned'].includes(q.status)) filter.status = q.status;
    return paged(VideoReport, filter, paging, (query) =>
      query
        .sort({ createdAt: -1 })
        .populate({ path: 'video', select: VIDEO_CARD, populate: { path: 'owner', select: USER_CARD } })
        .populate('reporter', USER_CARD));
  },

  earnings: (userId, q, paging) => {
    if (q.filter === 'coins') {
      return paged(CoinTransaction, { user: userId }, paging, (query) => query.sort({ createdAt: -1 }));
    }
    if (q.filter === 'withdrawals') {
      return paged(WithdrawalRequest, { user: userId }, paging, (query) =>
        query.sort({ createdAt: -1 }).select('-payoutDetails'));
    }
    if (q.filter === 'reviews') {
      return paged(VideoMonetizationReview, { user: userId }, paging, (query) =>
        query.sort({ createdAt: -1 }).select('-adWatchHistory').populate('video', 'title thumbnail videoUrl isShort'));
    }
    const filter = { user: userId };
    if (['pending', 'credited', 'cancelled'].includes(q.status)) filter.status = q.status;
    return paged(WalletCredit, filter, paging, (query) =>
      query.sort({ createdAt: -1 }).populate('video', 'title thumbnail videoUrl isShort'));
  },

  boosts: (userId, q, paging) => {
    const filter = { user: userId };
    if (['queued', 'active', 'completed', 'cancelled'].includes(q.filter)) filter.status = q.filter;
    return paged(VideoBoost, filter, paging, (query) =>
      query.sort({ createdAt: -1 }).populate('video', 'title thumbnail videoUrl isShort views'));
  },

  activity: (userId, q, paging) => {
    if (q.filter === 'liked') return pagedVideoIdList(userId, 'likedVideos', paging);
    if (q.filter === 'playlists') {
      return paged(Playlist, { owner: userId }, paging, (query) =>
        query.sort({ createdAt: -1 }).populate({ path: 'videos', select: 'title thumbnail', options: { limit: 4 } }));
    }
    return pagedVideoIdList(userId, 'watchHistory', paging);
  },

  chats: (userId, q, paging) =>
    paged(Conversation, { participants: userId }, paging, (query) =>
      query
        .sort({ updatedAt: -1 })
        .select({
          ...withCounts('isGroup groupName groupAvatar status lastMessage updatedAt createdAt', { participantCount: 'participants' }),
          participants: { $slice: CHAT_MEMBERS_PREVIEW },
        })
        .populate('participants', 'name channelName avatar isVerified')),
};

const videoTab = (userId, q, paging, isShort) => {
  const filter = { owner: userId, isShort: isShort ? true : { $ne: true } };
  if (['public', 'private', 'unlisted'].includes(q.filter)) filter.visibility = q.filter;
  const rx = searchRegex(q);
  if (rx) filter.title = rx;
  return paged(Video, filter, paging, (query) =>
    query
      .sort(sortFor(q.sort))
      .select(withCounts(`${VIDEO_CARD} category`, { likesCount: 'likes' }))
      .populate('category', 'name'));
};

const resolveUserId = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

// @desc    Profile header + stat cards for one user
// @route   GET /api/admin/users/:id/overview
// @access  Admin
exports.getUserOverview = async (req, res, next) => {
  try {
    const userId = resolveUserId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Invalid user id' });

    const user = await User.findById(userId)
      .select('-password -searchHistory -watchHistory -watchProgress -likedVideos -followingChannels -pushToken -pushTokens')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const now = new Date();
    const [
      [listSizes],
      videos, shorts, viewsAgg, posts, stories, activeStories,
      followers, following, comments, reportsFiled, videoIds,
      boosts, withdrawals, playlists, chats, monetization,
    ] = await Promise.all([
      User.aggregate([
        { $match: { _id: userId } },
        {
          $project: {
            watchHistory: { $size: { $ifNull: ['$watchHistory', []] } },
            likedVideos: { $size: { $ifNull: ['$likedVideos', []] } },
            devices: { $size: { $ifNull: ['$pushTokens', []] } },
          },
        },
      ]),
      Video.countDocuments({ owner: userId, isShort: { $ne: true } }),
      Video.countDocuments({ owner: userId, isShort: true }),
      Video.aggregate([
        { $match: { owner: userId } },
        { $group: { _id: null, views: { $sum: '$views' }, likes: { $sum: sizeOf('likes') } } },
      ]),
      Post.countDocuments({ owner: userId }),
      Story.countDocuments({ user: userId }),
      Story.countDocuments({ user: userId, expiresAt: { $gt: now } }),
      Follower.countDocuments({ channel: userId }),
      Follower.countDocuments({ follower: userId }),
      Comment.countDocuments({ user: userId }),
      VideoReport.countDocuments({ reporter: userId }),
      Video.find({ owner: userId }).distinct('_id'),
      VideoBoost.countDocuments({ user: userId }),
      WithdrawalRequest.countDocuments({ user: userId }),
      Playlist.countDocuments({ owner: userId }),
      Conversation.countDocuments({ participants: userId }),
      MonetizationApplication.findOne({ user: userId })
        .sort({ createdAt: -1 })
        .select('status reviewMessage createdAt updatedAt')
        .lean(),
    ]);
    const reportsOnVideos = videoIds.length
      ? await VideoReport.countDocuments({ video: { $in: videoIds } })
      : 0;

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...user,
          // Same rule as the Users list
          isMonetized: (monetization && monetization.status === 'approved') || (user.totalEarnings || 0) > 0,
        },
        monetization: monetization || null,
        stats: {
          videos,
          shorts,
          totalViews: (viewsAgg[0] && viewsAgg[0].views) || 0,
          totalLikes: (viewsAgg[0] && viewsAgg[0].likes) || 0,
          posts,
          stories,
          activeStories,
          followers,
          following,
          comments,
          reportsOnVideos,
          reportsFiled,
          boosts,
          withdrawals,
          playlists,
          chats,
          watchHistory: (listSizes && listSizes.watchHistory) || 0,
          likedVideos: (listSizes && listSizes.likedVideos) || 0,
          devices: (listSizes && listSizes.devices) || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    One paginated tab of the user profile
// @route   GET /api/admin/users/:id/tab/:tab
// @access  Admin
exports.getUserProfileTab = async (req, res, next) => {
  try {
    const userId = resolveUserId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'Invalid user id' });
    const handler = tabHandlers[req.params.tab];
    if (!handler) return res.status(400).json({ success: false, message: 'Unknown tab' });

    const exists = await User.exists({ _id: userId });
    if (!exists) return res.status(404).json({ success: false, message: 'User not found' });

    const result = await handler(userId, req.query, parsePaging(req.query));
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
