const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Follower = require('../models/Follower');
const { deleteLocalFile } = require('../utils/localUpload');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');

// @desc Create user
// @route POST /api/users
// @access Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, avatar, role } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required' });

    let existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'User with this email already exists' });

    const user = await User.create({ name, email, avatar: avatar || '', role: role || 'user' });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Update user channel info
// @route PUT /api/users/channel
// @access Private
exports.updateChannel = async (req, res, next) => {
  try {
    const { channelName, about, avatar, coverImage } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { channelName, about, avatar, coverImage },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

exports.getChannelProfile = async (req, res, next) => {
  try {
    const channelObj = await User.findById(req.params.id).select('name avatar coverImage channelName about followersCount createdAt');
    if (!channelObj) return res.status(404).json({ success: false, message: 'Channel not found' });

    const channel = channelObj.toObject();
    if (req.user) {
      const isFollowing = await Follower.findOne({
        follower: req.user.id,
        channel: req.params.id,
      });
      channel.isFollowing = !!isFollowing;
    } else {
      channel.isFollowing = false;
    }

    const filter = (req.query.filter || 'videos').toLowerCase();
    const sort = (req.query.sort || 'latest').toLowerCase();
    const isOwner = req.user && req.user.id.toString() === channel._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';
    const visibilityQuery = isOwner || isAdmin
      ? {}
      : { $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] };
    const videoQuery = { owner: channel._id, ...visibilityQuery };
    const postQuery = { owner: channel._id, ...visibilityQuery };

    let sortQuery = { createdAt: -1 };
    if (sort === 'popular') sortQuery = { views: -1, createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };

    let videos = [];
    let posts = [];

    if (filter === 'posts') {
      posts = await Post.find(postQuery)
        .populate('owner', 'name avatar channelName')
        .sort(sortQuery);
    } else {
      if (filter === 'shorts') {
        videoQuery.isShort = true;
      } else {
        videoQuery.isShort = { $ne: true };
      }

      videos = await Video.find(videoQuery)
        .populate('owner', 'name avatar channelName followersCount')
        .populate('category', 'name')
        .sort(sortQuery);
    }

    res.status(200).json({ success: true, data: { channel, videos, posts } });
  } catch (err) {
    next(err);
  }
};

// @desc Get all users
// @route GET /api/users
// @access Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort('-createdAt').select('-__v');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

// @desc Get single user
// @route GET /api/users/:id
// @access Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Update user
// @route PUT /api/users/:id
// @access Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    const update = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Add video to watch history
// @route   POST /api/users/history
// @access  Private
exports.addToHistory = async (req, res, next) => {
  try {
    const { videoId } = req.body;
    const user = await User.findById(req.user.id);

    // Remove if already exists to move to top
    user.watchHistory = (user.watchHistory || []).filter(id => id.toString() !== videoId);
    user.watchHistory.unshift(videoId);
    
    // Keep only last 50
    if (user.watchHistory.length > 50) {
      user.watchHistory = user.watchHistory.slice(0, 50);
    }

    await user.save();
    res.status(200).json({ success: true, data: user.watchHistory });
  } catch (err) {
    next(err);
  }
};

// @desc    Get watch history
// @route   GET /api/users/history
// @access  Private
exports.getHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'watchHistory',
      populate: { path: 'owner', select: 'name channelName avatar' }
    });

    res.status(200).json({ success: true, data: user.watchHistory || [] });
  } catch (err) {
    next(err);
  }
};

exports.getLikedVideos = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'likedVideos',
      populate: [
        { path: 'owner', select: 'name channelName avatar' },
        { path: 'category', select: 'name' },
      ],
    });
    res.status(200).json({ success: true, data: user.likedVideos || [] });
  } catch (err) {
    next(err);
  }
};

exports.addSearchHistory = async (req, res, next) => {
  try {
    const term = (req.body.term || '').trim();
    if (!term) return res.status(400).json({ success: false, message: 'Search term is required' });
    const user = await User.findById(req.user.id);
    user.searchHistory = (user.searchHistory || []).filter((item) => item.term.toLowerCase() !== term.toLowerCase());
    user.searchHistory.unshift({ term, createdAt: new Date() });
    user.searchHistory = user.searchHistory.slice(0, 20);
    await user.save();
    res.status(200).json({ success: true, data: user.searchHistory });
  } catch (err) {
    next(err);
  }
};

exports.getSearchHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('searchHistory');
    res.status(200).json({ success: true, data: user.searchHistory || [] });
  } catch (err) {
    next(err);
  }
};

exports.clearSearchHistory = async (req, res, next) => {
  try {
    const term = req.query.term;
    const update = term
      ? { $pull: { searchHistory: { term } } }
      : { $set: { searchHistory: [] } };
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('searchHistory');
    res.status(200).json({ success: true, data: user.searchHistory || [] });
  } catch (err) {
    next(err);
  }
};

// @desc Delete user
// @route DELETE /api/users/:id
// @access Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Delete avatar and cover image from local storage
    if (user.avatar) {
      deleteLocalFile(user.avatar);
    }
    if (user.coverImage) {
      deleteLocalFile(user.coverImage);
    }

    await user.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// @desc    Get monetization onboarding status and checklist
// @route   GET /api/users/monetization-status
// @access  Private
exports.getMonetizationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Fetch only review statuses that exist (no auto-backfill for old videos)
    const reviews = await VideoMonetizationReview.find({ user: userId }).populate('video', 'title thumbnail createdAt');
    
    // 2. Count passed videos
    const passedVideosCount = reviews.filter(r => r.status === 'passed').length;
    const step1Completed = passedVideosCount >= 3;

    // 3. Fetch monetization application
    const application = await MonetizationApplication.findOne({ user: userId });
    const step2Completed = application ? application.status === 'approved' : false;

    res.status(200).json({
      success: true,
      data: {
        passedVideosCount,
        step1Completed,
        step2Completed,
        reviews,
        application
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit verification details to apply for monetization
// @route   POST /api/users/apply-monetization
// @access  Private
exports.applyMonetization = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, adharNumber, upiId, bankDetails } = req.body;

    // Validation: Require all fields
    if (!name || !phone || !adharNumber || !upiId || !bankDetails || !bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifscCode) {
      return res.status(400).json({ success: false, message: 'Please fill all fields, including bank details' });
    }

    // Eligibility check: Check if they have at least 3 passed videos
    const passedReviewsCount = await VideoMonetizationReview.countDocuments({ user: userId, status: 'passed' });
    if (passedReviewsCount < 3) {
      return res.status(400).json({ success: false, message: 'You must have at least 3 approved videos to apply for monetization' });
    }

    // Insert or update the application
    let application = await MonetizationApplication.findOne({ user: userId });
    if (application) {
      application.name = name;
      application.phone = phone;
      application.adharNumber = adharNumber;
      application.upiId = upiId;
      application.bankDetails = bankDetails;
      application.status = 'pending'; // Reset status to pending upon edit/re-submission
      application.reviewMessage = ''; // Clear past rejection messages
      application.updatedAt = Date.now();
      await application.save();
    } else {
      application = await MonetizationApplication.create({
        user: userId,
        name,
        phone,
        adharNumber,
        upiId,
        bankDetails,
        status: 'pending'
      });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
};

// @desc    Schedule profile deletion (5-day grace period)
// @route   POST /api/users/schedule-deletion
// @access  Private
exports.scheduleProfileDeletion = async (req, res, next) => {
  try {
    const { reason, password } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for profile deletion' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify password if user registered via phone/has password set
    if (user.password) {
      if (!password) {
        return res.status(400).json({ success: false, message: 'Please enter your password to confirm deletion' });
      }
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect password' });
      }
    }

    const gracePeriodMs = 5 * 24 * 60 * 60 * 1000; // 5 days
    const scheduledDate = new Date(Date.now() + gracePeriodMs);

    user.deletionScheduled = true;
    user.deletionScheduledAt = new Date();
    user.scheduledDeletionDate = scheduledDate;
    user.deletionReason = reason.trim();
    user.deletionStatus = 'scheduled';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile deletion scheduled successfully. You have 5 days to recover your account.',
      data: {
        deletionScheduled: user.deletionScheduled,
        deletionScheduledAt: user.deletionScheduledAt,
        scheduledDeletionDate: user.scheduledDeletionDate,
        deletionReason: user.deletionReason,
        deletionStatus: user.deletionStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit account recovery request (Pending admin approval)
// @route   POST /api/users/recover-account
// @access  Private
exports.recoverAccount = async (req, res, next) => {
  try {
    const { recoveryReason, recoveryNotes } = req.body;

    if (!recoveryReason || !recoveryReason.trim()) {
      return res.status(400).json({ success: false, message: 'Please select a reason for account recovery' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.deletionScheduled) {
      return res.status(400).json({ success: false, message: 'Account is not currently scheduled for deletion' });
    }

    user.recoveryRequested = true;
    user.recoveryRequestedAt = new Date();
    user.recoveryReason = recoveryReason.trim();
    user.recoveryNotes = recoveryNotes ? recoveryNotes.trim() : '';
    user.deletionStatus = 'recovery_requested';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account recovery request submitted successfully. Waiting for admin approval.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user profile deletion status
// @route   GET /api/users/deletion-status
// @access  Private
exports.getDeletionStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        deletionScheduled: !!user.deletionScheduled,
        deletionScheduledAt: user.deletionScheduledAt,
        scheduledDeletionDate: user.scheduledDeletionDate,
        deletionReason: user.deletionReason,
        deletionStatus: user.deletionStatus || 'none',
        recoveryRequested: !!user.recoveryRequested,
        recoveryRequestedAt: user.recoveryRequestedAt,
        recoveryReason: user.recoveryReason,
        recoveryNotes: user.recoveryNotes,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users scheduled for deletion or requesting recovery
// @route   GET /api/users/scheduled-deletions
// @access  Private/Admin
exports.getScheduledDeletions = async (req, res, next) => {
  try {
    const users = await User.find({ deletionScheduled: true }).sort('-scheduledDeletionDate').select('-password');
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel profile deletion schedule and restore user (Admin)
// @route   POST /api/users/:id/cancel-deletion
// @access  Private/Admin
exports.cancelDeletionByAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.deletionScheduled = false;
    user.deletionScheduledAt = null;
    user.scheduledDeletionDate = null;
    user.deletionReason = null;
    user.recoveryRequested = false;
    user.recoveryRequestedAt = null;
    user.recoveryReason = null;
    user.recoveryNotes = null;
    user.deletionStatus = 'canceled';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile deletion schedule canceled and account restored by admin',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reject account recovery request (Admin)
// @route   POST /api/users/:id/reject-recovery
// @access  Private/Admin
exports.rejectRecoveryByAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.recoveryRequested = false;
    user.deletionStatus = 'scheduled';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account recovery request rejected. Profile deletion remains scheduled.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit web account deletion request (Public)
// @route   POST /api/users/web-deletion-request
// @access  Public
exports.requestWebDeletion = async (req, res, next) => {
  try {
    const { name, phoneOrEmail, reason, notes } = req.body;

    if (!name || !name.trim() || !phoneOrEmail || !phoneOrEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Name and registered Phone or Email are required' });
    }

    const input = phoneOrEmail.trim();
    // Search user by phone or email
    const user = await User.findOne({
      $or: [{ phone: input }, { email: input.toLowerCase() }],
    });

    if (user) {
      const gracePeriodMs = 5 * 24 * 60 * 60 * 1000; // 5 days
      user.deletionScheduled = true;
      user.deletionScheduledAt = new Date();
      user.scheduledDeletionDate = new Date(Date.now() + gracePeriodMs);
      user.deletionReason = `[Web Request] ${reason || 'Play Store Portal'}${notes ? ` - ${notes}` : ''}`;
      user.deletionStatus = 'scheduled';
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Account deletion request submitted successfully. Account scheduled for permanent deletion within 5 days.',
    });
  } catch (err) {
    next(err);
  }
};

