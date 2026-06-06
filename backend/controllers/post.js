const Post = require('../models/Post');
const Follower = require('../models/Follower');
const Notification = require('../models/Notification');
const cloudinary = require('cloudinary').v2;
const { deleteFromCloudinary } = require('../utils/cloudinary');

const createNotification = async ({ recipient, actor, type, video, post, comment, message }) => {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;
  await Notification.create({ recipient, actor, type, video, post, comment, message });
};

exports.createPost = async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    let imageUrl = req.body.imageUrl;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'tubeindia/posts',
      });
      imageUrl = result.secure_url;
    }
    if (!text && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Post text or image is required' });
    }
    const post = await Post.create({
      owner: req.user.id,
      text,
      imageUrl,
      visibility: req.body.visibility || 'public',
    });
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Not authorized to update this post' });
    }

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : post.text;
    let imageUrl = post.imageUrl;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'tubeindia/posts',
      });
      imageUrl = result.secure_url;
      if (post.imageUrl) await deleteFromCloudinary(post.imageUrl, 'image');
    } else if (req.body.removeImage === 'true') {
      if (post.imageUrl) await deleteFromCloudinary(post.imageUrl, 'image');
      imageUrl = '';
    }

    if (!text && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Post text or image is required' });
    }

    post.text = text;
    post.imageUrl = imageUrl;
    if (req.body.visibility) post.visibility = req.body.visibility;
    await post.save();

    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

exports.getPosts = async (req, res, next) => {
  try {
    const query = { visibility: 'public' };
    if (req.query.owner) query.owner = req.query.owner;
    const posts = await Post.find(query).populate('owner', 'name avatar channelName').sort('-createdAt');
    res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('owner', 'name avatar channelName');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

exports.getFollowedPosts = async (req, res, next) => {
  try {
    const followings = await Follower.find({ follower: req.user.id });
    const channelIds = followings.map((f) => f.channel);
    const posts = await Post.find({ owner: { $in: channelIds }, visibility: 'public' })
      .populate('owner', 'name avatar channelName')
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

    const userId = req.user.id.toString();
    const alreadyLiked = post.likes.some((id) => id.toString() === userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.addToSet(req.user.id);
      await createNotification({
        recipient: post.owner,
        actor: req.user.id,
        type: 'post_like',
        post: post._id,
        message: `${req.user.channelName || req.user.name} liked your post`,
      });
    }

    await post.save();
    res.status(200).json({ success: true, likes: post.likes, isLiked: !alreadyLiked });
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

    if (post.imageUrl) await deleteFromCloudinary(post.imageUrl, 'image');
    await post.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
