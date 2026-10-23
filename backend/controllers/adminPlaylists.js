const mongoose = require('mongoose');
const Playlist = require('../models/Playlist');
const User = require('../models/User');

// Admin playlist management (all routes sit behind protect + authorize('admin')).

const PLAYLIST_NAME_MAX = 100;
const OWNER_FIELDS = 'name channelName avatar email isVerified isBlocked';
const FILTERS = new Set(['all', 'public', 'private', 'empty']);
const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  most_videos: { videoCount: -1, createdAt: -1 },
  name: { name: 1 },
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const notFound = (res) => res.status(404).json({ success: false, message: 'Playlist not found' });

const filterMatch = (filter) => {
  if (filter === 'public') return { isPrivate: { $ne: true } };
  if (filter === 'private') return { isPrivate: true };
  if (filter === 'empty') return { 'videos.0': { $exists: false } };
  return {};
};

// @desc    List playlists with search, filters, sorting and totals
// @route   GET /api/admin/playlists
// @access  Private/Admin
exports.getAdminPlaylists = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const filter = FILTERS.has(req.query.filter) ? req.query.filter : 'all';
    const sort = SORTS[req.query.sort] ? req.query.sort : 'newest';
    const search = String(req.query.search || '').trim();

    const match = filterMatch(filter);
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const owners = await User.find({ $or: [{ name: regex }, { channelName: regex }, { email: regex }] })
        .select('_id')
        .limit(500)
        .lean();
      const or = [{ name: regex }, { owner: { $in: owners.map((u) => u._id) } }];
      if (isValidId(search)) or.push({ _id: new mongoose.Types.ObjectId(search) });
      match.$or = or;
    }

    const [result, totalsAgg] = await Promise.all([
      Playlist.aggregate([
        { $match: match },
        { $addFields: { videoCount: { $size: { $ifNull: ['$videos', []] } }, coverVideo: { $arrayElemAt: ['$videos', -1] } } },
        { $sort: SORTS[sort] },
        {
          $facet: {
            rows: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner', pipeline: [{ $project: { name: 1, channelName: 1, avatar: 1, email: 1, isVerified: 1, isBlocked: 1 } }] } },
              { $lookup: { from: 'videos', localField: 'coverVideo', foreignField: '_id', as: 'cover', pipeline: [{ $project: { thumbnail: 1 } }] } },
              {
                $project: {
                  name: 1,
                  isPrivate: { $eq: ['$isPrivate', true] },
                  createdAt: 1,
                  videoCount: 1,
                  owner: { $arrayElemAt: ['$owner', 0] },
                  thumbnail: { $arrayElemAt: ['$cover.thumbnail', 0] },
                },
              },
            ],
            total: [{ $count: 'n' }],
          },
        },
      ]),
      Playlist.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            private: { $sum: { $cond: [{ $eq: ['$isPrivate', true] }, 1, 0] } },
            empty: { $sum: { $cond: [{ $eq: [{ $size: { $ifNull: ['$videos', []] } }, 0] }, 1, 0] } },
            videos: { $sum: { $size: { $ifNull: ['$videos', []] } } },
            creators: { $addToSet: '$owner' },
          },
        },
      ]),
    ]);

    const rows = result[0]?.rows || [];
    const total = result[0]?.total[0]?.n || 0;
    const t = totalsAgg[0] || { total: 0, private: 0, empty: 0, videos: 0, creators: [] };

    res.status(200).json({
      success: true,
      data: rows,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total: t.total,
        public: t.total - t.private,
        private: t.private,
        empty: t.empty,
        creators: (t.creators || []).length,
        savedVideos: t.videos,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    One playlist with all its videos (including private ones, for review)
// @route   GET /api/admin/playlists/:id
// @access  Private/Admin
exports.getAdminPlaylist = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return notFound(res);
    const playlist = await Playlist.findById(req.params.id)
      .populate('owner', OWNER_FIELDS)
      .populate({
        path: 'videos',
        select: 'title thumbnail duration views visibility isShort createdAt owner',
        populate: { path: 'owner', select: 'name channelName isBlocked' },
      })
      .lean();
    if (!playlist) return notFound(res);

    const savedIds = (playlist.videos || []).filter(Boolean).map((v) => String(v._id));
    res.status(200).json({
      success: true,
      data: {
        ...playlist,
        isPrivate: Boolean(playlist.isPrivate),
        videos: (playlist.videos || []).filter(Boolean),
        videoCount: savedIds.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Rename a playlist and/or change Public/Private
// @route   PUT /api/admin/playlists/:id
// @access  Private/Admin
exports.updateAdminPlaylist = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return notFound(res);
    const { name, isPrivate } = req.body;
    const updates = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > PLAYLIST_NAME_MAX) {
        return res.status(400).json({ success: false, message: `Playlist name must be 1 to ${PLAYLIST_NAME_MAX} characters` });
      }
      updates.name = cleanName;
    }
    if (isPrivate !== undefined) {
      if (typeof isPrivate !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isPrivate must be true or false' });
      }
      updates.isPrivate = isPrivate;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const playlist = await Playlist.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!playlist) return notFound(res);
    res.status(200).json({ success: true, data: { _id: playlist._id, name: playlist.name, isPrivate: Boolean(playlist.isPrivate) } });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a playlist (the videos themselves are not touched)
// @route   DELETE /api/admin/playlists/:id
// @access  Private/Admin
exports.deleteAdminPlaylist = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return notFound(res);
    const deleted = await Playlist.findByIdAndDelete(req.params.id);
    if (!deleted) return notFound(res);
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove one video from a playlist
// @route   DELETE /api/admin/playlists/:id/videos/:videoId
// @access  Private/Admin
exports.removeAdminPlaylistVideo = async (req, res, next) => {
  try {
    const { id, videoId } = req.params;
    if (!isValidId(id) || !isValidId(videoId)) return notFound(res);
    const updated = await Playlist.findOneAndUpdate(
      { _id: id, videos: videoId },
      { $pull: { videos: videoId } },
      { new: true }
    );
    if (!updated) {
      const exists = await Playlist.exists({ _id: id });
      return exists
        ? res.status(404).json({ success: false, message: 'Video is not in this playlist' })
        : notFound(res);
    }
    res.status(200).json({ success: true, data: { _id: updated._id, videoCount: updated.videos.length } });
  } catch (err) {
    next(err);
  }
};
