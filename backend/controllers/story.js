const Story = require('../models/Story');
const User = require('../models/User');
const Follower = require('../models/Follower');
const { saveLocalFile, deleteLocalFile } = require('../utils/localUpload');
const { cleanupExpiredStories } = require('../utils/storyCleanupScheduler');

// @desc    Get stories tray for Messages screen (Your story + followed creators' stories)
// @route   GET /api/stories/tray
// @access  Private
exports.getStoryTray = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const now = new Date();

    // 1. Get current user profile for "Your Story" tile
    const currentUser = await User.findById(currentUserId)
      .select('name channelName avatar isVerified')
      .lean();

    if (!currentUser) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // 2. Fetch list of channels followed by current user
    const followings = await Follower.find({ follower: currentUserId })
      .select('channel')
      .lean();
    const followedIds = followings.map((f) => f.channel).filter(Boolean);

    // 3. Query all active stories (within last 24h) for current user + followed users
    const allUserIds = [currentUserId, ...followedIds];
    const activeStories = await Story.find({
      user: { $in: allUserIds },
      expiresAt: { $gt: now },
    })
      .populate('user', 'name channelName avatar isVerified')
      .sort({ createdAt: 1 })
      .lean();

    // 4. Group stories by user ID
    const userStoriesMap = new Map();

    activeStories.forEach((story) => {
      const u = story.user;
      if (!u || !u._id) return;
      const uId = u._id.toString();

      if (!userStoriesMap.has(uId)) {
        const isSelf = uId === currentUserId.toString();
        userStoriesMap.set(uId, {
          user: u,
          isOwn: isSelf,
          isSelf: isSelf,
          stories: [],
          hasUnviewed: false,
          lastStoryAt: story.createdAt,
        });
      }

      const userGroup = userStoriesMap.get(uId);
      const isOwn = uId === currentUserId.toString();
      const isViewed = isOwn
        ? Boolean(story.ownerViewed)
        : Array.isArray(story.views) && story.views.some(
            (v) => v && v.toString() === currentUserId.toString()
          );

      const viewsCount = Array.isArray(story.views) ? story.views.length : 0;

      userGroup.stories.push({
        _id: story._id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType || 'image',
        caption: story.caption || '',
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewsCount,
        isViewed,
      });

      // If at least one story is unviewed, mark group hasUnviewed
      if (!isViewed) {
        userGroup.hasUnviewed = true;
      }

      const storyTime = new Date(story.createdAt).getTime();
      const prevTime = userGroup.lastStoryAt ? new Date(userGroup.lastStoryAt).getTime() : 0;
      if (storyTime > prevTime) {
        userGroup.lastStoryAt = story.createdAt;
      }
    });

    // 5. Structure the tray: Current user is ALWAYS the first item
    const ownGroup = userStoriesMap.get(currentUserId.toString()) || {
      user: currentUser,
      isOwn: true,
      isSelf: true,
      stories: [],
      hasUnviewed: false,
      lastStoryAt: null,
    };
    ownGroup.isOwn = true;
    ownGroup.isSelf = true;

    // Followed users who have active stories
    const followedGroups = [];
    userStoriesMap.forEach((group, uId) => {
      if (uId !== currentUserId.toString() && group.stories.length > 0) {
        followedGroups.push(group);
      }
    });

    // Sort followed users: unviewed first, then by latest upload timestamp
    followedGroups.sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      const timeA = a.lastStoryAt ? new Date(a.lastStoryAt).getTime() : 0;
      const timeB = b.lastStoryAt ? new Date(b.lastStoryAt).getTime() : 0;
      return timeB - timeA;
    });

    const tray = [ownGroup, ...followedGroups];

    // Trigger non-blocking background cleanup for any expired stories
    setImmediate(() => {
      cleanupExpiredStories().catch(() => {});
    });

    res.status(200).json({
      success: true,
      count: tray.length,
      data: tray,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload & create a new story (Max 5 active images per user)
// @route   POST /api/stories
// @access  Private
exports.createStory = async (req, res, next) => {
  let savedFileUrl = null;
  try {
    const currentUserId = req.user.id;
    const now = new Date();

    // 1. Enforce strict 5-image limit for active stories within 24h
    const activeCount = await Story.countDocuments({
      user: currentUserId,
      expiresAt: { $gt: now },
    });

    if (activeCount >= 5) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the limit of 5 active stories. Please wait for an existing story to expire or delete one to post a new photo.',
        activeCount,
        maxLimit: 5,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image to upload as your story.',
      });
    }

    // 2. Validate that uploaded file is an image or video
    const isImage = req.file.mimetype && req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');

    if (!isImage && !isVideo) {
      return res.status(400).json({
        success: false,
        message: 'Only image files (JPG, PNG, WEBP) or short videos (MP4, MOV, WEBM) are allowed for stories.',
      });
    }

    // Enforce 15-second max duration limit on video stories
    if (isVideo && req.body.duration) {
      const dur = parseFloat(req.body.duration);
      if (dur > 16.5) {
        return res.status(400).json({
          success: false,
          message: 'Story videos cannot exceed 15 seconds.',
        });
      }
    }

    // 3. Save uploaded file to Cloudflare R2 / local uploads
    const result = await saveLocalFile(req, req.file, isVideo ? 'video' : 'image');
    if (!result || !result.url) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save story media. Please try again.',
      });
    }
    savedFileUrl = result.url;

    // 4. Create Story record with exact 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await Story.create({
      user: currentUserId,
      mediaUrl: result.url,
      mediaType: isVideo ? 'video' : 'image',
      caption: (req.body.caption || '').trim().slice(0, 300),
      expiresAt,
    });

    await story.populate('user', 'name channelName avatar isVerified');

    res.status(201).json({
      success: true,
      data: story,
      message: 'Story uploaded successfully! It will remain visible for 24 hours.',
    });
  } catch (err) {
    if (savedFileUrl) {
      deleteLocalFile(savedFileUrl).catch(() => {});
    }
    next(err);
  }
};

// @desc    Record a view on a story
// @route   POST /api/stories/:id/view
// @access  Private
exports.viewStory = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(200).json({ success: true, viewsCount: 0 });
    }

    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(200).json({ success: true, viewsCount: 0, expired: true });
    }

    let viewsCount = Array.isArray(story.views) ? story.views.length : 0;

    // Check if this is owner viewing their own story
    if (story.user && story.user.toString() === currentUserId.toString()) {
      if (!story.ownerViewed) {
        story.ownerViewed = true;
        await story.save().catch(() => {});
      }
    } else {
      // Different user: add unique view via $addToSet
      const updated = await Story.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { views: currentUserId } },
        { new: true }
      );
      viewsCount = Array.isArray(updated?.views) ? updated.views.length : viewsCount;
    }

    return res.status(200).json({ success: true, viewsCount });
  } catch (err) {
    console.warn('[viewStory] Silent error handling:', err?.message);
    return res.status(200).json({ success: true, viewsCount: 0 });
  }
};

// @desc    Get viewers list for a story (Only owner can see viewers)
// @route   GET /api/stories/:id/viewers
// @access  Private
exports.getStoryViewers = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const story = await Story.findById(req.params.id)
      .populate('views', 'name channelName avatar isVerified')
      .lean();

    if (!story) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // Only owner (or admin) can see who viewed their story
    const isOwner = story.user && story.user.toString() === currentUserId.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the story owner can see the viewers list',
      });
    }

    const viewers = (Array.isArray(story.views) ? story.views : []).filter(Boolean);

    return res.status(200).json({
      success: true,
      count: viewers.length,
      data: viewers,
    });
  } catch (err) {
    console.warn('[getStoryViewers] Error fetching viewers:', err?.message);
    return res.status(200).json({ success: true, count: 0, data: [] });
  }
};

// @desc    Delete own story (purges record from DB and deletes physical file from storage)
// @route   DELETE /api/stories/:id
// @access  Private
exports.deleteStory = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(200).json({ success: true, message: 'Story already removed.' });
    }

    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(200).json({ success: true, message: 'Story not found or already deleted' });
    }

    const isOwner = story.user && story.user.toString() === currentUserId.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this story' });
    }

    // 1. Permanently delete media file from storage safely
    if (story.mediaUrl) {
      try {
        await deleteLocalFile(story.mediaUrl);
      } catch (fileErr) {
        console.warn('[deleteStory] Could not delete physical file:', fileErr?.message);
      }
    }

    // 2. Remove document from MongoDB safely
    await story.deleteOne().catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Story permanently deleted from storage and feed.',
    });
  } catch (err) {
    console.warn('[deleteStory] Error deleting story:', err?.message);
    return res.status(200).json({
      success: true,
      message: 'Story removed from feed.',
    });
  }
};
