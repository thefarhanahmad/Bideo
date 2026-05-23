const Playlist = require('../models/Playlist');

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
