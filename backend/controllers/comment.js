const Comment = require('../models/Comment');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { sendPushForEvent } = require('../utils/pushNotification');

const createNotification = async ({ recipient, actor, type, video, post, comment, message }) => {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;
  try {
    await Notification.create({ recipient, actor, type, video, post, comment, message });
    sendPushForEvent({ recipient, actor, type, video, post, comment, message }).catch(() => {});
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
};

// @desc    Get comments for a video or post
// @route   GET /api/comments/:id
// @access  Public
exports.getComments = async (req, res, next) => {
  try {
    const { videoId, postId, sort } = req.query;
    const query = {};
    if (videoId) query.video = videoId;
    else if (postId) query.post = postId;
    else query.video = req.params.videoId; // fallback for old route

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    // Sort order: oldest -> '-isPinned createdAt', newest / all -> '-isPinned -createdAt'
    const sortOrder = sort === 'oldest' ? '-isPinned createdAt' : '-isPinned -createdAt';

    const comments = await Comment.find(query)
      .populate('user', 'name avatar channelName isVerified')
      .populate('pinnedBy', 'name avatar channelName isVerified')
      .populate('lovedBy', 'name avatar channelName isVerified')
      .populate('replies.user', 'name avatar channelName isVerified')
      .populate('replies.lovedBy', 'name avatar channelName isVerified')
      .sort(sortOrder)
      .limit(limit)
      .lean();

    // Deduplicate comments: if duplicate comments exist (same user + identical text), hide duplicates, show only first comment
    const seenComments = new Set();
    const chronoSorted = [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const firstCommentIds = new Set();

    for (const c of chronoSorted) {
      const userId = (c.user?._id || c.user)?.toString();
      const textKey = (c.text || '').trim().toLowerCase();
      const key = `${userId}___${textKey}`;
      if (!seenComments.has(key)) {
        seenComments.add(key);
        firstCommentIds.add(c._id.toString());
      }
    }

    let uniqueComments = comments.filter((c) => firstCommentIds.has(c._id.toString()));

    // Also deduplicate replies inside each comment
    uniqueComments = uniqueComments.map((c) => {
      if (Array.isArray(c.replies) && c.replies.length > 1) {
        const seenReplies = new Set();
        const chronoReplies = [...c.replies].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const firstReplyIds = new Set();
        for (const r of chronoReplies) {
          const rUserId = (r.user?._id || r.user)?.toString();
          const rTextKey = (r.text || '').trim().toLowerCase();
          const rKey = `${rUserId}___${rTextKey}`;
          if (!seenReplies.has(rKey)) {
            seenReplies.add(rKey);
            firstReplyIds.add(r._id ? r._id.toString() : rKey);
          }
        }
        c.replies = c.replies.filter((r) =>
          firstReplyIds.has(r._id ? r._id.toString() : `${(r.user?._id || r.user)?.toString()}___${(r.text || '').trim().toLowerCase()}`)
        );
      }
      return c;
    });

    res.status(200).json({
      success: true,
      count: uniqueComments.length,
      data: uniqueComments,
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
    const cleanText = (req.body.text || '').trim();
    if (!cleanText) {
      return res.status(400).json({ success: false, message: 'Please add some text' });
    }
    req.body.text = cleanText;

    let parent;
    let type;
    let message;

    if (req.body.video) {
      parent = await Video.findById(req.body.video);
      type = 'video_comment';
      message = `${req.user.channelName || req.user.name} commented on your video`;
    } else if (req.body.post) {
      parent = await Post.findById(req.body.post);
      type = 'post_comment';
      message = `${req.user.channelName || req.user.name} commented on your post`;
    }

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Video or Post not found' });
    }

    // Check if an identical duplicate comment already exists by this user
    const existingDuplicate = await Comment.findOne({
      user: req.user.id,
      ...(req.body.video ? { video: req.body.video } : { post: req.body.post }),
      text: cleanText,
    }).populate('user', 'name avatar channelName isVerified');

    if (existingDuplicate) {
      // Duplicate identified - return existing first comment
      return res.status(200).json({
        success: true,
        data: existingDuplicate,
        isDuplicate: true,
      });
    }

    const comment = await Comment.create(req.body);
    await comment.populate('user', 'name avatar channelName isVerified');

    parent.commentsCount += 1;
    await parent.save();

    await createNotification({
      recipient: parent.owner,
      actor: req.user.id,
      type,
      video: req.body.video,
      post: req.body.post,
      comment: comment._id,
      message,
    });

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle like on comment
// @route   POST /api/comments/:id/like
// @access  Private
exports.toggleCommentLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const userId = req.user.id.toString();
    const alreadyLiked = comment.likes.some((id) => id.toString() === userId);
    if (alreadyLiked) {
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
    } else {
      comment.likes.addToSet(req.user.id);
      await createNotification({
        recipient: comment.user,
        actor: req.user.id,
        type: 'comment_like',
        video: comment.video,
        post: comment.post,
        comment: comment._id,
        message: `${req.user.channelName || req.user.name} liked your comment`,
      });
    }
    await comment.save();
    res.status(200).json({ success: true, likes: comment.likes, isLiked: !alreadyLiked });
  } catch (err) {
    next(err);
  }
};

// @desc    Reply to comment
// @route   POST /api/comments/:id/replies
// @access  Private
exports.addReply = async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Reply text is required' });

    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    // Check if duplicate reply exists
    const existingReply = comment.replies.find(
      (r) => r.user?.toString() === req.user.id.toString() && r.text?.trim().toLowerCase() === text.toLowerCase()
    );
    if (existingReply) {
      await comment.populate('replies.user', 'name avatar channelName isVerified');
      const populatedReply = comment.replies.id(existingReply._id);
      return res.status(200).json({ success: true, data: populatedReply, isDuplicate: true });
    }

    comment.replies.push({ user: req.user.id, text });
    await comment.save();
    await comment.populate('replies.user', 'name avatar channelName isVerified');
    const reply = comment.replies[comment.replies.length - 1];

    await createNotification({
      recipient: comment.user,
      actor: req.user.id,
      type: 'comment_reply',
      video: comment.video,
      post: comment.post,
      comment: comment._id,
      message: `${req.user.channelName || req.user.name} replied to your comment`,
    });

    res.status(201).json({ success: true, data: reply });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle like on reply
// @route   POST /api/comments/:id/replies/:replyId/like
// @access  Private
exports.toggleReplyLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

    const userId = req.user.id.toString();
    const alreadyLiked = reply.likes.some((id) => id.toString() === userId);
    if (alreadyLiked) {
      reply.likes = reply.likes.filter((id) => id.toString() !== userId);
    } else {
      reply.likes.addToSet(req.user.id);
      await createNotification({
        recipient: reply.user,
        actor: req.user.id,
        type: 'comment_like',
        video: comment.video,
        post: comment.post,
        comment: comment._id,
        message: `${req.user.channelName || req.user.name} liked your reply`,
      });
    }
    await comment.save();
    res.status(200).json({ success: true, likes: reply.likes, isLiked: !alreadyLiked });
  } catch (err) {
    next(err);
  }
};

// @desc    Update reply
// @route   PUT /api/comments/:id/replies/:replyId
// @access  Private
exports.updateReply = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

    if (reply.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to update this reply' });
    }

    reply.text = req.body.text;
    await comment.save();

    res.status(200).json({ success: true, data: reply });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete reply
// @route   DELETE /api/comments/:id/replies/:replyId
// @access  Private
exports.deleteReply = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ success: false, message: 'Reply not found' });

    let parent;
    if (comment.video) parent = await Video.findById(comment.video);
    else if (comment.post) parent = await Post.findById(comment.post);

    const isReplyAuthor = reply.user.toString() === req.user.id.toString();
    const isContentOwner = parent && parent.owner.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReplyAuthor && !isContentOwner && !isAdmin) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this reply' });
    }

    reply.remove ? reply.remove() : comment.replies.pull(req.params.replyId);
    await comment.save();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to update this comment' });
    }

    comment = await Comment.findByIdAndUpdate(req.params.id, { text: req.body.text }, {
      new: true,
      runValidators: true
    }).populate('user', 'name avatar channelName isVerified');

    res.status(200).json({
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

    let parent;
    if (comment.video) parent = await Video.findById(comment.video);
    else if (comment.post) parent = await Post.findById(comment.post);

    if (
      comment.user.toString() !== req.user.id &&
      (!parent || parent.owner.toString() !== req.user.id) &&
      req.user.role !== 'admin'
    ) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    await comment.deleteOne();

    if (parent) {
      parent.commentsCount = Math.max(0, parent.commentsCount - 1);
      await parent.save();
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Pin or unpin comment (by video/post creator or admin)
// @route   PUT /api/comments/:id/pin
// @access  Private
exports.togglePinComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    let parent;
    if (comment.video) parent = await Video.findById(comment.video);
    else if (comment.post) parent = await Post.findById(comment.post);

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent video or post not found' });
    }

    const isCreator = parent.owner.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator of this content or an administrator can pin comments',
      });
    }

    const isCurrentlyPinned = Boolean(comment.isPinned);

    if (isCurrentlyPinned) {
      comment.isPinned = false;
      comment.pinnedAt = null;
      comment.pinnedBy = null;
      await comment.save();
    } else {
      const filter = comment.video ? { video: comment.video } : { post: comment.post };
      await Comment.updateMany(filter, { isPinned: false, pinnedAt: null, pinnedBy: null });

      comment.isPinned = true;
      comment.pinnedAt = new Date();
      comment.pinnedBy = req.user.id;
      await comment.save();
    }

    await comment.populate('user', 'name avatar channelName isVerified');
    await comment.populate('pinnedBy', 'name avatar channelName isVerified');

    res.status(200).json({
      success: true,
      message: comment.isPinned ? 'Comment pinned successfully' : 'Comment unpinned successfully',
      data: comment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle creator love/heart on comment (by video/post creator or admin)
// @route   POST /api/comments/:id/love
// @access  Private
exports.toggleCommentLove = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    let parent;
    if (comment.video) parent = await Video.findById(comment.video);
    else if (comment.post) parent = await Post.findById(comment.post);

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent video or post not found' });
    }

    const isCreator = parent.owner.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator of this video can heart comments',
      });
    }

    const isCurrentlyLoved = Boolean(comment.isLoved);

    if (isCurrentlyLoved) {
      comment.isLoved = false;
      comment.lovedBy = null;
      comment.lovedAt = null;
    } else {
      comment.isLoved = true;
      comment.lovedBy = req.user.id;
      comment.lovedAt = new Date();

      await createNotification({
        recipient: comment.user,
        actor: req.user.id,
        type: 'comment_heart',
        video: comment.video,
        post: comment.post,
        comment: comment._id,
        message: `${req.user.channelName || req.user.name} loved your comment ❤️`,
      });
    }

    await comment.save();
    await comment.populate('lovedBy', 'name avatar channelName isVerified');

    res.status(200).json({
      success: true,
      isLoved: comment.isLoved,
      lovedBy: comment.lovedBy,
      data: comment,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle creator love/heart on reply (by video/post creator or admin)
// @route   POST /api/comments/:id/replies/:replyId/love
// @access  Private
exports.toggleReplyLove = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    let parent;
    if (comment.video) parent = await Video.findById(comment.video);
    else if (comment.post) parent = await Post.findById(comment.post);

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent video or post not found' });
    }

    const isCreator = parent.owner.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator of this video can heart replies',
      });
    }

    const isCurrentlyLoved = Boolean(reply.isLoved);

    if (isCurrentlyLoved) {
      reply.isLoved = false;
      reply.lovedBy = null;
      reply.lovedAt = null;
    } else {
      reply.isLoved = true;
      reply.lovedBy = req.user.id;
      reply.lovedAt = new Date();

      await createNotification({
        recipient: reply.user,
        actor: req.user.id,
        type: 'comment_heart',
        video: comment.video,
        post: comment.post,
        comment: comment._id,
        message: `${req.user.channelName || req.user.name} loved your reply ❤️`,
      });
    }

    await comment.save();
    await comment.populate('replies.lovedBy', 'name avatar channelName isVerified');

    res.status(200).json({
      success: true,
      isLoved: reply.isLoved,
      lovedBy: reply.lovedBy,
      data: reply,
    });
  } catch (err) {
    next(err);
  }
};
