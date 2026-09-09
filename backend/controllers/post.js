const Post = require('../models/Post');
const User = require('../models/User');
const Follower = require('../models/Follower');
const Notification = require('../models/Notification');
const Comment = require('../models/Comment');
const { saveLocalFile, deleteLocalFile } = require('../utils/localUpload');
const { getUserInterestProfile, rankAndShufflePosts } = require('../utils/recommendation');
const { sendPushForEvent } = require('../utils/pushNotification');
const { schedulePostModeration } = require('../services/moderationService');

const createNotification = async ({ recipient, actor, type, video, post, comment, message }) => {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;
  try {
    await Notification.create({ recipient, actor, type, video, post, comment, message });
    sendPushForEvent({ recipient, actor, type, video, post, comment, message }).catch(() => {});
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
};

exports.createPost = async (req, res, next) => {
  let savedImageUrl = null;

  try {
    const text = (req.body.text || '').trim();
    let imageUrl = req.body.imageUrl;
    if (req.file) {
      const result = await saveLocalFile(req, req.file, 'image');
      imageUrl = result.url;
      savedImageUrl = result.url;
    }
    if (!text && !imageUrl) {
      if (savedImageUrl) await deleteLocalFile(savedImageUrl);
      return res.status(400).json({ success: false, message: 'Post text or image is required' });
    }
    const originalImageSize = Number(req.body.originalImageSize || 0);
    const compressedImageSize = req.file ? req.file.size : 0;

    const post = await Post.create({
      owner: req.user.id,
      text,
      imageUrl,
      visibility: req.body.visibility || 'public',
      originalImageSize,
      compressedImageSize,
    });

    // Schedule 10-second automated adult content audit
    schedulePostModeration(post, 10000);

    res.status(201).json({ success: true, data: post });
  } catch (err) {
    if (savedImageUrl) {
      await deleteLocalFile(savedImageUrl);
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  let savedImageUrl = null;
  let oldImageToDelete = null;

  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to update this post' });
    }

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : post.text;
    let imageUrl = post.imageUrl;

    if (req.file) {
      post.originalImageSize = Number(req.body.originalImageSize || 0);
      post.compressedImageSize = req.file.size || 0;

      const result = await saveLocalFile(req, req.file, 'image');
      imageUrl = result.url;
      savedImageUrl = result.url;
      if (post.imageUrl) {
        oldImageToDelete = post.imageUrl;
      }
    } else if (req.body.removeImage === 'true') {
      if (post.imageUrl) {
        oldImageToDelete = post.imageUrl;
      }
      imageUrl = '';
      post.originalImageSize = 0;
      post.compressedImageSize = 0;
    }

    if (!text && !imageUrl) {
      if (savedImageUrl) await deleteLocalFile(savedImageUrl);
      return res.status(400).json({ success: false, message: 'Post text or image is required' });
    }

    post.text = text;
    post.imageUrl = imageUrl;
    if (req.body.visibility) post.visibility = req.body.visibility;
    await post.save();

    if (oldImageToDelete) {
      await deleteLocalFile(oldImageToDelete);
    }

    // Schedule 10-second automated adult content audit
    schedulePostModeration(post, 10000);

    res.status(200).json({ success: true, data: post });
  } catch (err) {
    if (savedImageUrl) {
      await deleteLocalFile(savedImageUrl);
    }
    next(err);
  }
};

exports.getPosts = async (req, res, next) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const query = { visibility: 'public' };
    if (req.query.owner) query.owner = req.query.owner;

    if (req.query.exclude) {
      const rawExclude = Array.isArray(req.query.exclude)
        ? req.query.exclude
        : String(req.query.exclude).split(',').map((s) => s.trim()).filter(Boolean);
      const validExcludeIds = rawExclude.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validExcludeIds.length > 0) {
        query._id = { ...(query._id || {}), $nin: validExcludeIds };
      }
    }

    if (!isAdmin) {
      const blockedUsers = await User.find({ isBlocked: true }).select('_id').lean();
      const blockedIds = blockedUsers.map((u) => u._id);
      if (blockedIds.length > 0) {
        if (query.owner) {
          if (blockedIds.some((bId) => bId.toString() === query.owner.toString())) {
            return res.status(200).json({ success: true, count: 0, data: [] });
          }
        } else {
          query.owner = { $nin: blockedIds };
        }
      }
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    if (!req.query.owner && !isAdmin) {
      // Randomized posts feed: sample across public posts rather than only newest 30
      const allPosts = await Post.find(query)
        .populate('owner', 'name avatar channelName isVerified')
        .lean();

      const shuffled = rankAndShufflePosts(allPosts);
      const results = shuffled.slice(0, limit);
      return res.status(200).json({ success: true, count: results.length, data: results });
    }

    const posts = await Post.find(query)
      .populate('owner', 'name avatar channelName isVerified')
      .sort('-createdAt')
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('owner', 'name avatar channelName isVerified isBlocked');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.owner?.isBlocked && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

exports.getFollowedPosts = async (req, res, next) => {
  try {
    const followings = await Follower.find({ follower: req.user.id });
    const channelIds = followings.map((f) => f.channel);

    const blockedUsers = await User.find({ isBlocked: true }).select('_id').lean();
    const blockedIds = new Set(blockedUsers.map((u) => u._id.toString()));
    const validChannelIds = channelIds.filter((cId) => !blockedIds.has(cId.toString()));

    const posts = await Post.find({ owner: { $in: validChannelIds }, visibility: 'public' })
      .populate('owner', 'name avatar channelName isVerified')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    next(err);
  }
};

exports.togglePostLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const userId = req.user.id;
    const userIdStr = userId.toString();
    const alreadyLiked = (post.likes || []).some((id) => id.toString() === userIdStr);

    let updatedPost;
    if (alreadyLiked) {
      updatedPost = await Post.findByIdAndUpdate(
        post._id,
        { $pull: { likes: userId } },
        { new: true }
      );
    } else {
      updatedPost = await Post.findByIdAndUpdate(
        post._id,
        { $addToSet: { likes: userId } },
        { new: true }
      );
      await createNotification({
        recipient: post.owner,
        actor: req.user.id,
        type: 'post_like',
        post: post._id,
        message: `${req.user.channelName || req.user.name} liked your post`,
      });
    }

    res.status(200).json({
      success: true,
      likes: updatedPost ? updatedPost.likes : [],
      isLiked: !alreadyLiked,
    });
  } catch (err) {
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this post' });
    }

    if (post.imageUrl) await deleteLocalFile(post.imageUrl);
    await post.deleteOne();
    await Promise.all([
      Comment.deleteMany({ post: post._id }),
      Notification.deleteMany({ post: post._id }),
    ]);

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
