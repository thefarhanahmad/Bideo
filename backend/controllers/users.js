const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Follower = require('../models/Follower');
const { deleteLocalFile } = require('../utils/localUpload');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const WithdrawalRequest = require('../models/WithdrawalRequest');

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
    const channelObj = await User.findById(req.params.id).select('name avatar coverImage channelName about followersCount isVerified createdAt');
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
        .populate('owner', 'name avatar channelName isVerified')
        .sort(sortQuery);
    } else {
      if (filter === 'shorts') {
        videoQuery.isShort = true;
      } else {
        videoQuery.isShort = { $ne: true };
      }

      videos = await Video.find(videoQuery)
        .populate('owner', 'name avatar channelName followersCount isVerified')
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
    const update = { ...req.body };

    // Clean up unique/sparse string fields so empty strings don't trigger E11000 duplicate key error
    if (update.email !== undefined) {
      if (typeof update.email === 'string' && update.email.trim()) {
        update.email = update.email.trim();
      } else {
        delete update.email;
      }
    }

    if (update.phone !== undefined) {
      if (typeof update.phone === 'string' && update.phone.trim()) {
        update.phone = update.phone.trim();
      } else {
        delete update.phone;
      }
    }

    if (update.channelName !== undefined) {
      if (typeof update.channelName === 'string' && update.channelName.trim()) {
        update.channelName = update.channelName.trim();
      } else {
        delete update.channelName;
      }
    }

    if (update.walletBalance !== undefined) {
      const balanceNum = Number(update.walletBalance);
      if (isNaN(balanceNum) || balanceNum < 0) {
        return res.status(400).json({ success: false, message: 'Wallet balance must be a valid non-negative number' });
      }
      update.walletBalance = balanceNum;
    }

    if (update.totalEarnings !== undefined) {
      const earningsNum = Number(update.totalEarnings);
      if (isNaN(earningsNum) || earningsNum < 0) {
        return res.status(400).json({ success: false, message: 'Total earnings must be a valid non-negative number' });
      }
      update.totalEarnings = earningsNum;
    }

    if (update.isVerified !== undefined) {
      update.isVerified = Boolean(update.isVerified);
    }

    // Hash password if admin is resetting/setting a new password for the user
    if (update.password && typeof update.password === 'string' && update.password.trim().length > 0) {
      if (update.password.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password.trim(), salt);
    } else {
      delete update.password;
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user verification badge
// @route   PUT /api/users/:id/verify
// @access  Private/Admin
exports.toggleVerifyUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isVerified = !user.isVerified;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isVerified ? 'Verification badge granted' : 'Verification badge removed',
      data: user,
    });
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

    // 1. Fetch only review statuses that exist
    const reviews = await VideoMonetizationReview.find({ user: userId }).populate('video', 'title thumbnail createdAt');
    
    // 2. Count passed videos
    const passedVideosCount = reviews.filter(r => r.status === 'passed').length;
    const step1Completed = passedVideosCount >= 3;

    // 3. Fetch monetization application
    const application = await MonetizationApplication.findOne({ user: userId });
    const step2Completed = application ? application.status === 'approved' : false;

    // 4. Fetch user document and calculate total views
    const userDoc = await User.findById(userId);
    const userVideos = await Video.find({ owner: userId });
    const totalViews = userVideos.reduce((acc, v) => acc + (v.views || 0), 0);

    const walletBalance = userDoc?.walletBalance || 0;
    const totalEarnings = userDoc?.totalEarnings || 0;

    res.status(200).json({
      success: true,
      data: {
        passedVideosCount,
        step1Completed,
        step2Completed,
        reviews,
        application,
        walletBalance: Math.round((walletBalance || 0) * 100) / 100,
        totalEarnings: Math.round((totalEarnings || 0) * 100) / 100,
        totalViews,
        ratePerThousandViews: 30,
        ratePerView: 0.03,
        minWithdrawal: 1000,
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Request a payout / earnings withdrawal
// @route   POST /api/users/withdraw
// @access  Private
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, payoutMethod, payoutDetails } = req.body;

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹1,000',
      });
    }

    if (!payoutMethod || !['upi', 'bank'].includes(payoutMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a valid payout method (UPI or Bank)',
      });
    }

    const application = await MonetizationApplication.findOne({ user: userId, status: 'approved' });
    if (!application) {
      return res.status(403).json({
        success: false,
        message: 'Monetization approval is required to withdraw earnings',
      });
    }

    const user = await User.findById(userId);
    if (!user || (user.walletBalance || 0) < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Available: ₹${(user?.walletBalance || 0).toFixed(2)}`,
      });
    }

    // Prepare details with fallback to approved application details
    const finalPayoutDetails = {
      upiId: payoutMethod === 'upi' ? (payoutDetails?.upiId || application.upiId) : null,
      bankName: payoutMethod === 'bank' ? (payoutDetails?.bankName || application.bankDetails?.bankName) : null,
      accountNumber: payoutMethod === 'bank' ? (payoutDetails?.accountNumber || application.bankDetails?.accountNumber) : null,
      ifscCode: payoutMethod === 'bank' ? (payoutDetails?.ifscCode || application.bankDetails?.ifscCode) : null,
      holderName: application.name || user.name,
    };

    if (payoutMethod === 'upi' && !finalPayoutDetails.upiId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid UPI ID' });
    }
    if (payoutMethod === 'bank' && (!finalPayoutDetails.accountNumber || !finalPayoutDetails.ifscCode)) {
      return res.status(400).json({ success: false, message: 'Please provide valid Bank Account & IFSC code' });
    }

    // Deduct balance and create withdrawal request
    user.walletBalance = Math.max(0, (user.walletBalance || 0) - withdrawAmount);
    await user.save();

    const withdrawal = await WithdrawalRequest.create({
      user: userId,
      amount: withdrawAmount,
      payoutMethod,
      payoutDetails: finalPayoutDetails,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully! Funds will be transferred within 24-48 hours.',
      data: withdrawal,
      walletBalance: user.walletBalance,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's withdrawal history
// @route   GET /api/users/withdrawals
// @access  Private
exports.getWithdrawalHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const withdrawals = await WithdrawalRequest.find({ user: userId }).sort('-createdAt');
    res.status(200).json({
      success: true,
      count: withdrawals.length,
      data: withdrawals,
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

