const Video = require('../models/Video');
const User = require('../models/User');
const Follower = require('../models/Follower');
const cloudinary = require('cloudinary').v2;

// @desc    Search videos
// @route   GET /api/videos/search
// @access  Public
exports.searchVideos = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const videos = await Video.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ],
      visibility: 'public',
    }).populate('owner', 'name avatar channelName').populate('category', 'name');

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all videos
// @route   GET /api/videos
// @access  Public
exports.getVideos = async (req, res, next) => {
  try {
    const videos = await Video.find().populate('owner', 'name avatar channelName followersCount').populate('category', 'name');
    
    let results = videos.map(v => v.toObject());

    if (req.user) {
      const user = await User.findById(req.user.id);
      results = results.map(v => ({
        ...v,
        isLiked: v.likes.some(id => id.toString() === req.user.id.toString()),
        isDisliked: v.dislikes.some(id => id.toString() === req.user.id.toString()),
        isFollowing: user.followingChannels.some(id => id.toString() === v.owner._id.toString())
      }));
    }

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single video
// @route   GET /api/videos/:id
// @access  Public
exports.getVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id).populate('owner', 'name avatar channelName followersCount').populate('category', 'name');

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Increment views
    video.views += 1;
    await video.save();

    let videoData = video.toObject();
    if (req.user) {
      const user = await User.findById(req.user.id);
      videoData.isLiked = video.likes.some(id => id.toString() === req.user.id.toString());
      videoData.isDisliked = video.dislikes.some(id => id.toString() === req.user.id.toString());
      videoData.isFollowing = user.followingChannels.some(id => id.toString() === video.owner._id.toString());
    }

    res.status(200).json({
      success: true,
      data: videoData,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get videos from followed channels
// @route   GET /api/videos/followed
// @access  Private
exports.getFollowedVideos = async (req, res, next) => {
  try {
    const followings = await Follower.find({ follower: req.user.id });
    const channelIds = followings.map(f => f.channel);

    const videos = await Video.find({ owner: { $in: channelIds }, visibility: 'public' })
      .populate('owner', 'name avatar channelName')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's videos
// @route   GET /api/videos/me
// @access  Private
exports.getMyVideos = async (req, res, next) => {
  try {
    const videos = await Video.find({ owner: req.user.id })
      .populate('owner', 'name avatar channelName')
      .populate('category', 'name')
      .sort('-createdAt');
    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle Like video
// @route   POST /api/videos/:id/like
// @access  Private
exports.toggleLike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (video.likes.includes(req.user.id)) {
      // Unlike
      video.likes = video.likes.filter(id => id.toString() !== req.user.id.toString());
    } else {
      // Like and remove dislike
      video.likes.push(req.user.id);
      video.dislikes = video.dislikes.filter(id => id.toString() !== req.user.id.toString());
    }

    await video.save();

    res.status(200).json({
      success: true,
      likes: video.likes,
      dislikes: video.dislikes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle Dislike video
// @route   POST /api/videos/:id/dislike
// @access  Private
exports.toggleDislike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    if (video.dislikes.includes(req.user.id)) {
      // Undislike
      video.dislikes = video.dislikes.filter(id => id.toString() !== req.user.id.toString());
    } else {
      // Dislike and remove like
      video.dislikes.push(req.user.id);
      video.likes = video.likes.filter(id => id.toString() !== req.user.id.toString());
    }

    await video.save();

    res.status(200).json({
      success: true,
      likes: video.likes,
      dislikes: video.dislikes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload video
// @route   POST /api/videos/upload
// @access  Private
exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.files || !req.files.video || !req.files.thumbnail) {
      return res.status(400).json({ success: false, message: 'Please upload both video and thumbnail' });
    }

    // Upload video to Cloudinary
    const videoResult = await cloudinary.uploader.upload(req.files.video[0].path, {
      resource_type: 'video',
      folder: 'indiatube/videos',
    });

    // Upload thumbnail to Cloudinary
    const thumbnailResult = await cloudinary.uploader.upload(req.files.thumbnail[0].path, {
      folder: 'indiatube/thumbnails',
    });

    const durationSec = videoResult.duration || 0;

    const video = await Video.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      tags: req.body.tags,
      videoUrl: videoResult.secure_url,
      thumbnail: thumbnailResult.secure_url,
      duration: durationSec,
      isShort: durationSec > 0 && durationSec <= 60,
      owner: req.user.id,
      visibility: req.body.visibility || 'public',
    });

    res.status(201).json({
      success: true,
      data: video,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update video
// @route   PUT /api/videos/:id
// @access  Private
exports.updateVideo = async (req, res, next) => {
  try {
    let video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Make sure user is video owner
    if (video.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to update this video' });
    }

    const { title, description, category, tags, visibility } = req.body;
    
    video = await Video.findByIdAndUpdate(req.params.id, {
      title, description, category, tags, visibility
    }, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete video
// @route   DELETE /api/videos/:id
// @access  Private
exports.deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Make sure user is video owner
    if (video.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this video' });
    }

    await video.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};
