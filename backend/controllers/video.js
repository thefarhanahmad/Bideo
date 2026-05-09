const Video = require('../models/Video');
const cloudinary = require('cloudinary').v2;

// @desc    Get all videos
// @route   GET /api/videos
// @access  Public
exports.getVideos = async (req, res, next) => {
  try {
    const videos = await Video.find().populate('owner', 'name avatar');
    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
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
    const video = await Video.findById(req.params.id).populate('owner', 'name avatar subscribersCount');

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Increment views
    video.views += 1;
    await video.save();

    res.status(200).json({
      success: true,
      data: video,
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

    const video = await Video.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      videoUrl: videoResult.secure_url,
      thumbnail: thumbnailResult.secure_url,
      duration: videoResult.duration,
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

    video = await Video.findByIdAndUpdate(req.params.id, req.body, {
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
