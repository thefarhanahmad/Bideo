const Comment = require('../models/Comment');
const Video = require('../models/Video');

// @desc    Get comments for a video
// @route   GET /api/comments/:videoId
// @access  Public
exports.getComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({ video: req.params.videoId })
      .populate('user', 'name avatar channelName')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add comment
// @route   POST /api/comments
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    req.body.user = req.user.id;

    const video = await Video.findById(req.body.video);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const comment = await Comment.create(req.body);

    // Increment commentsCount in Video model
    video.commentsCount += 1;
    await video.save();

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Make sure user is comment owner or video owner or admin
    const video = await Video.findById(comment.video);

    if (
      comment.user.toString() !== req.user.id &&
      video.owner.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    await comment.deleteOne();

    // Decrement commentsCount in Video model
    video.commentsCount -= 1;
    await video.save();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};
