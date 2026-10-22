const mongoose = require('mongoose');
const Playlist = require('../models/Playlist');
const User = require('../models/User');

// @desc    Create a playlist
// @route   POST /api/playlists
// @access  Private
exports.createPlaylist = async (req, res, next) => {
  try {
    const { name, isPrivate, videoId } = req.body;
    const playlist = await Playlist.create({
      name,
      isPrivate,
      owner: req.user.id,
      videos: videoId ? [videoId] : [],
    });

    res.status(201).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's playlists
// @route   GET /api/playlists
// @access  Private
exports.getPlaylists = async (req, res, next) => {
  try {
    const playlists = await Playlist.find({ owner: req.user.id }).populate('videos');
    res.status(200).json({ success: true, count: playlists.length, data: playlists });
  } catch (err) {
    next(err);
  }
};

// @desc    Add video to playlist
// @route   PUT /api/playlists/:id/add
// @access  Private
exports.addVideoToPlaylist = async (req, res, next) => {
  try {
    const { videoId } = req.body;
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    if (playlist.owner.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (playlist.videos.includes(videoId)) {
      return res.status(400).json({ success: false, message: 'Video already in playlist' });
    }

    playlist.videos.push(videoId);
    await playlist.save();

    res.status(200).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Viewing and managing playlists (public playlists can be opened by anyone;
// private ones only by their owner).
// ---------------------------------------------------------------------------

const PLAYLIST_NAME_MAX = 100;
const CHANNEL_PLAYLISTS_LIMIT = 100;
const VIDEO_FIELDS = 'title thumbnail duration views createdAt isShort owner visibility';
const OWNER_FIELDS = 'name channelName avatar isVerified isBlocked';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const viewerId = (req) => (req.user ? req.user.id : null);
const ownerIdOf = (playlist) => String(playlist.owner?._id || playlist.owner);

// Other people only see public videos from channels that are not blocked
const visibleVideosFor = (videos, isOwner) =>
  (videos || []).filter(
    (v) => v && (isOwner || (v.visibility === 'public' && !(v.owner && v.owner.isBlocked)))
  );

const findOwnedPlaylist = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return null;
  }
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) {
    res.status(404).json({ success: false, message: 'Playlist not found' });
    return null;
  }
  if (playlist.owner.toString() !== req.user.id) {
    res.status(401).json({ success: false, message: 'Not authorized' });
    return null;
  }
  return playlist;
};

// @desc    Get one playlist with its videos
// @route   GET /api/playlists/:id
// @access  Public for public playlists, owner only for private ones
exports.getPlaylist = async (req, res, next) => {
  try {
    const notFound = () => res.status(404).json({ success: false, message: 'Playlist not found' });
    if (!isValidId(req.params.id)) return notFound();

    const playlist = await Playlist.findById(req.params.id)
      .populate('owner', OWNER_FIELDS)
      .populate({ path: 'videos', select: VIDEO_FIELDS, populate: { path: 'owner', select: OWNER_FIELDS } })
      .lean();
    if (!playlist || !playlist.owner) return notFound();

    const isOwner = viewerId(req) === ownerIdOf(playlist);
    if (!isOwner && (playlist.isPrivate || playlist.owner.isBlocked)) return notFound();

    const videos = visibleVideosFor(playlist.videos, isOwner);
    res.status(200).json({
      success: true,
      data: {
        _id: playlist._id,
        name: playlist.name,
        isPrivate: Boolean(playlist.isPrivate),
        createdAt: playlist.createdAt,
        owner: {
          _id: playlist.owner._id,
          name: playlist.owner.name,
          channelName: playlist.owner.channelName,
          avatar: playlist.owner.avatar,
          isVerified: playlist.owner.isVerified,
        },
        isOwner,
        videoCount: videos.length,
        videos,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Playlists shown on a channel page
// @route   GET /api/playlists/channel/:userId
// @access  Public (owner also sees private and empty playlists)
exports.getChannelPlaylists = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) return res.status(200).json({ success: true, count: 0, data: [] });

    const isOwner = viewerId(req) === String(userId);
    if (!isOwner) {
      const channel = await User.findById(userId).select('isBlocked').lean();
      if (!channel || channel.isBlocked) return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const query = { owner: userId };
    if (!isOwner) query.isPrivate = { $ne: true };

    const playlists = await Playlist.find(query)
      .sort({ createdAt: -1 })
      .limit(CHANNEL_PLAYLISTS_LIMIT)
      .populate({ path: 'videos', select: 'thumbnail visibility owner', populate: { path: 'owner', select: 'isBlocked' } })
      .lean();

    const data = playlists
      .map((p) => {
        const videos = visibleVideosFor(p.videos, isOwner);
        const cover = videos.length ? videos[videos.length - 1] : null;
        return {
          _id: p._id,
          name: p.name,
          isPrivate: Boolean(p.isPrivate),
          createdAt: p.createdAt,
          videoCount: videos.length,
          thumbnail: cover ? cover.thumbnail : null,
        };
      })
      // Like YouTube, other viewers do not see empty playlists
      .filter((p) => isOwner || p.videoCount > 0);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// @desc    Rename a playlist and/or change Public/Private
// @route   PUT /api/playlists/:id
// @access  Private (owner)
exports.updatePlaylist = async (req, res, next) => {
  try {
    const { name, isPrivate } = req.body;
    const updates = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > PLAYLIST_NAME_MAX) {
        return res.status(400).json({
          success: false,
          message: `Playlist name must be 1 to ${PLAYLIST_NAME_MAX} characters`,
        });
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

    const playlist = await findOwnedPlaylist(req, res);
    if (!playlist) return;

    Object.assign(playlist, updates);
    await playlist.save();
    res.status(200).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a playlist (videos themselves are not touched)
// @route   DELETE /api/playlists/:id
// @access  Private (owner)
exports.deletePlaylist = async (req, res, next) => {
  try {
    const playlist = await findOwnedPlaylist(req, res);
    if (!playlist) return;

    await playlist.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove one video from a playlist
// @route   DELETE /api/playlists/:id/videos/:videoId
// @access  Private (owner)
exports.removeVideoFromPlaylist = async (req, res, next) => {
  try {
    const playlist = await findOwnedPlaylist(req, res);
    if (!playlist) return;

    const { videoId } = req.params;
    const before = playlist.videos.length;
    playlist.videos = playlist.videos.filter((v) => v.toString() !== videoId);
    if (playlist.videos.length === before) {
      return res.status(404).json({ success: false, message: 'Video is not in this playlist' });
    }
    await playlist.save();
    res.status(200).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};
