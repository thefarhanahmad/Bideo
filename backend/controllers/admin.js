const User = require('../models/User');
const VideoReport = require('../models/VideoReport');
const Video = require('../models/Video');
const Category = require('../models/Category');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const ErrorLog = require('../models/ErrorLog');

// Helper to calculate daily, weekly, and monthly trends for Users & Videos
const calculateAnalyticsTrends = async () => {
  const now = new Date();

  // 1. Daily (Last 14 days)
  const dailyLabels = [];
  const dailyDateMap = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    dailyLabels.push({ dateStr, label });
    dailyDateMap[dateStr] = { label, users: 0, longVideos: 0, shorts: 0, views: 0 };
  }

  // 2. Weekly (Last 8 weeks)
  const weeklyDateMap = {};
  const weeklyLabels = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (i * 7 + 6));
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - (i * 7));
    end.setHours(23, 59, 59, 999);
    const label = `Wk ${8 - i}`;
    const key = `week_${i}`;
    weeklyLabels.push({ key, label, start, end });
    weeklyDateMap[key] = { label, users: 0, longVideos: 0, shorts: 0, views: 0 };
  }

  // 3. Monthly (Last 6 months)
  const monthlyDateMap = {};
  const monthlyLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    monthlyLabels.push({ yearMonth, label });
    monthlyDateMap[yearMonth] = { label, users: 0, longVideos: 0, shorts: 0, views: 0 };
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  // Aggregate user signups with indexed date match
  const userSignups = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    {
      $project: {
        createdAt: 1,
        dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        yearMonth: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
      }
    }
  ]);

  userSignups.forEach((u) => {
    if (dailyDateMap[u.dateStr]) dailyDateMap[u.dateStr].users += 1;
    if (monthlyDateMap[u.yearMonth]) monthlyDateMap[u.yearMonth].users += 1;
    const uTime = new Date(u.createdAt).getTime();
    weeklyLabels.forEach((w) => {
      if (uTime >= w.start.getTime() && uTime <= w.end.getTime()) {
        weeklyDateMap[w.key].users += 1;
      }
    });
  });

  // Aggregate video uploads with indexed date match
  const videoUploads = await Video.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    {
      $project: {
        createdAt: 1,
        isShort: { $ifNull: ["$isShort", false] },
        views: { $ifNull: ["$views", 0] },
        dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        yearMonth: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
      }
    }
  ]);

  videoUploads.forEach((v) => {
    if (dailyDateMap[v.dateStr]) {
      if (v.isShort) dailyDateMap[v.dateStr].shorts += 1;
      else dailyDateMap[v.dateStr].longVideos += 1;
      dailyDateMap[v.dateStr].views += (v.views || 0);
    }
    if (monthlyDateMap[v.yearMonth]) {
      if (v.isShort) monthlyDateMap[v.yearMonth].shorts += 1;
      else monthlyDateMap[v.yearMonth].longVideos += 1;
      monthlyDateMap[v.yearMonth].views += (v.views || 0);
    }
    const vTime = new Date(v.createdAt).getTime();
    weeklyLabels.forEach((w) => {
      if (vTime >= w.start.getTime() && vTime <= w.end.getTime()) {
        if (v.isShort) weeklyDateMap[w.key].shorts += 1;
        else weeklyDateMap[w.key].longVideos += 1;
        weeklyDateMap[w.key].views += (v.views || 0);
      }
    });
  });

  return {
    userTrends: {
      daily: dailyLabels.map((d) => ({ label: d.label, date: d.dateStr, count: dailyDateMap[d.dateStr].users })),
      weekly: weeklyLabels.map((w) => ({ label: w.label, count: weeklyDateMap[w.key].users })),
      monthly: monthlyLabels.map((m) => ({ label: m.label, count: monthlyDateMap[m.yearMonth].users }))
    },
    videoTrends: {
      daily: dailyLabels.map((d) => ({
        label: d.label,
        date: d.dateStr,
        longVideos: dailyDateMap[d.dateStr].longVideos,
        shorts: dailyDateMap[d.dateStr].shorts,
        total: dailyDateMap[d.dateStr].longVideos + dailyDateMap[d.dateStr].shorts,
        views: dailyDateMap[d.dateStr].views
      })),
      weekly: weeklyLabels.map((w) => ({
        label: w.label,
        longVideos: weeklyDateMap[w.key].longVideos,
        shorts: weeklyDateMap[w.key].shorts,
        total: weeklyDateMap[w.key].longVideos + weeklyDateMap[w.key].shorts,
        views: weeklyDateMap[w.key].views
      })),
      monthly: monthlyLabels.map((m) => ({
        label: m.label,
        longVideos: monthlyDateMap[m.yearMonth].longVideos,
        shorts: monthlyDateMap[m.yearMonth].shorts,
        total: monthlyDateMap[m.yearMonth].longVideos + monthlyDateMap[m.yearMonth].shorts,
        views: monthlyDateMap[m.yearMonth].views
      }))
    }
  };
};

// @desc    Aggregated stats for the admin dashboard overview
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res, next) => {
  try {
    const [
      usersTotal,
      adminsTotal,
      monetizedTotal,
      scheduledDeletionsTotal,
      videosTotal,
      shortsTotal,
      categoriesTotal,
      reportsTotal,
      reportsOpen,
      visibilityAgg,
      viewsAgg,
      recentVideos,
      recentUsers,
      trends,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      MonetizationApplication.countDocuments({ status: 'approved' }),
      User.countDocuments({ deletionScheduled: true }),
      Video.countDocuments(),
      Video.countDocuments({ isShort: true }),
      Category.countDocuments(),
      VideoReport.countDocuments(),
      VideoReport.countDocuments({ status: 'open' }),
      Video.aggregate([{ $group: { _id: '$visibility', count: { $sum: 1 } } }]),
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Video.find()
        .sort('-createdAt')
        .limit(5)
        .populate('owner', 'name channelName avatar')
        .select('title thumbnail views visibility createdAt owner'),
      User.find().sort('-createdAt').limit(5).select('name email phone avatar role createdAt'),
      calculateAnalyticsTrends(),
    ]);

    const visibility = { public: 0, unlisted: 0, private: 0 };
    visibilityAgg.forEach((row) => {
      if (row._id) visibility[row._id] = row.count;
    });

    const totalViews = viewsAgg[0] ? viewsAgg[0].total : 0;
    const longVideosTotal = Math.max(0, videosTotal - shortsTotal);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: usersTotal,
          admins: adminsTotal,
          monetized: monetizedTotal,
          scheduledDeletions: scheduledDeletionsTotal,
          regular: Math.max(0, usersTotal - adminsTotal - monetizedTotal)
        },
        videos: {
          total: videosTotal,
          longVideos: longVideosTotal,
          shorts: shortsTotal,
          ...visibility
        },
        categories: { total: categoriesTotal },
        reports: { total: reportsTotal, open: reportsOpen },
        totalViews,
        avgViewsPerVideo: videosTotal > 0 ? Math.round(totalViews / videosTotal) : 0,
        userTrends: trends.userTrends,
        videoTrends: trends.videoTrends,
        recentVideos,
        recentUsers,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin login using database credentials
// @route   POST /api/admin/login
// @access  Public
exports.loginAdmin = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password required' });
    }
    const user = await User.findOne({ phone }).select('+password');
    if (!user || user.role !== 'admin' || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    // Create token
    const token = user.getSignedJwtToken();

    const options = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true,
    };

    if (process.env.NODE_ENV === 'production') {
      options.secure = true;
    }

    res.status(200).cookie('token', token, options).json({ success: true, token, user: { _id: user._id, id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.getVideoReports = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    const reports = await VideoReport.find(query)
      .populate({
        path: 'video',
        select: 'title thumbnail videoUrl views visibility owner',
        populate: { path: 'owner', select: 'name channelName avatar' },
      })
      .populate('reporter', 'name channelName avatar phone email')
      .sort('-createdAt')
      .lean();
    res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (err) {
    next(err);
  }
};

exports.updateVideoReport = async (req, res, next) => {
  try {
    const allowed = ['open', 'reviewed', 'dismissed', 'actioned'];
    const update = {};
    if (req.body.status) {
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid report status' });
      }
      update.status = req.body.status;
    }
    if (req.body.adminNote !== undefined) update.adminNote = req.body.adminNote;
    update.updatedAt = Date.now();

    const report = await VideoReport.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all pending video reviews for monetization eligibility (grouped userwise)
// @route   GET /api/admin/videos/pending-reviews
// @access  Private/Admin
exports.getPendingVideoReviews = async (req, res, next) => {
  try {
    const reviews = await VideoMonetizationReview.find({ status: 'pending' })
      .populate('video', 'title thumbnail videoUrl views duration isShort createdAt')
      .populate('user', 'name channelName avatar email phone')
      .sort('-createdAt')
      .lean();

    // Group reviews by user ID
    const userGroupsMap = {};
    for (const r of reviews) {
      if (!r.user) continue;
      const userId = (r.user._id || r.user.id || r.user).toString();
      if (!userGroupsMap[userId]) {
        userGroupsMap[userId] = {
          user: r.user,
          reviews: []
        };
      }
      userGroupsMap[userId].reviews.push(r);
    }

    const groupedData = Object.values(userGroupsMap);
    res.status(200).json({ success: true, count: groupedData.length, data: groupedData });
  } catch (err) {
    next(err);
  }
};

// @desc    Review a video's monetization status (pass or fail)
// @route   PUT /api/admin/videos/:id/review
// @access  Private/Admin
exports.reviewVideoMonetization = async (req, res, next) => {
  try {
    const { status, reviewMessage } = req.body;
    if (!status || !['passed', 'failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status: passed or failed' });
    }

    const review = await VideoMonetizationReview.findByIdAndUpdate(
      req.params.id,
      { status, reviewMessage: reviewMessage || '', updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.status(200).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all monetization applications (pending / approved / rejected)
// @route   GET /api/admin/monetization-applications
// @access  Private/Admin
exports.getMonetizationApplications = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const query = status === 'all' ? {} : { status };
    const applications = await MonetizationApplication.find(query)
      .populate('user', 'name channelName avatar email phone followersCount createdAt')
      .sort(status === 'approved' ? '-updatedAt' : '-createdAt')
      .lean();
    res.status(200).json({ success: true, count: applications.length, data: applications });
  } catch (err) {
    next(err);
  }
};

// @desc    Review a user's monetization application (approve or reject)
// @route   PUT /api/admin/users/:userId/review-monetization
// @access  Private/Admin
exports.reviewMonetizationApplication = async (req, res, next) => {
  try {
    const { status, reviewMessage } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status: approved or rejected' });
    }

    const application = await MonetizationApplication.findOneAndUpdate(
      { user: req.params.userId },
      { status, reviewMessage: reviewMessage || '', updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!application) return res.status(404).json({ success: false, message: 'Application not found for this user' });
    res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all creator withdrawal requests
// @route   GET /api/admin/withdrawals
// @access  Private/Admin
exports.getWithdrawals = async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const query = status === 'all' ? {} : { status };
    const withdrawals = await WithdrawalRequest.find(query)
      .populate('user', 'name channelName avatar email phone walletBalance')
      .sort('-createdAt')
      .lean();
    res.status(200).json({ success: true, count: withdrawals.length, data: withdrawals });
  } catch (err) {
    next(err);
  }
};

// @desc    Process a withdrawal request (approve with transactionId, or reject with refund)
// @route   PUT /api/admin/withdrawals/:id
// @access  Private/Admin
exports.processWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, transactionId, adminNote } = req.body;

    const withdrawal = await WithdrawalRequest.findById(id).populate('user');
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${withdrawal.status}` });
    }

    if (action === 'approve') {
      withdrawal.status = 'approved';
      withdrawal.transactionId = transactionId || 'PAID-' + Date.now();
      withdrawal.adminNote = adminNote || 'Payment transferred successfully';
      withdrawal.processedAt = Date.now();
      await withdrawal.save();
    } else if (action === 'reject') {
      withdrawal.status = 'rejected';
      withdrawal.adminNote = adminNote || 'Withdrawal rejected by admin';
      withdrawal.processedAt = Date.now();
      await withdrawal.save();

      // Refund the amount back to user's wallet
      if (withdrawal.user) {
        await User.findByIdAndUpdate(withdrawal.user._id, {
          $inc: { walletBalance: withdrawal.amount },
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject' });
    }

    res.status(200).json({ success: true, message: `Withdrawal ${action}d successfully`, data: withdrawal });
  } catch (err) {
    next(err);
  }
};

// @desc    Boost views (100-300) and likes (~7% ratio) for videos, with ₹0.10 wallet reward for monetized creators
// @route   POST /api/admin/videos/boost-engagement
// @access  Private/Admin
exports.boostVideoEngagement = async (req, res, next) => {
  try {
    const {
      videoId,
      minViews = 100,
      maxViews = 300,
      likeRatio = 7,
      rewardAmount = 0.10,
      rewardMode = 'once_per_creator', // 'once_per_creator', 'per_video', 'none'
    } = req.body;

    const parsedMinViews = Math.max(1, parseInt(minViews) || 100);
    const parsedMaxViews = Math.max(parsedMinViews, parseInt(maxViews) || 300);
    const parsedLikeRatio = Math.max(1, Math.min(100, parseFloat(likeRatio) || 7));
    const parsedReward = Math.max(0, parseFloat(rewardAmount) || 0);

    const filter = videoId ? { _id: videoId } : {};

    const [videos, users, monetizedApps] = await Promise.all([
      Video.find(filter),
      User.find().select('_id'),
      MonetizationApplication.find({ status: 'approved' }).select('user'),
    ]);

    if (!videos.length) {
      return res.status(404).json({ success: false, message: 'No videos found to boost' });
    }

    const monetizedUserSet = new Set(monetizedApps.map((a) => a.user.toString()));
    const userIds = users.map((u) => u._id);
    const creditedCreatorsSet = new Set();

    let totalViewsAdded = 0;
    let totalLikesAdded = 0;
    let totalEarningsCredited = 0;
    let monetizedCreatorsRewarded = 0;

    for (const video of videos) {
      // 1. Random views between minViews and maxViews
      const addedViews =
        Math.floor(Math.random() * (parsedMaxViews - parsedMinViews + 1)) + parsedMinViews;

      // 2. Custom like ratio (default ~7%, with subtle ±0.8% natural jitter)
      const baseRatio = parsedLikeRatio / 100;
      const ratio = baseRatio + (Math.random() * 0.016 - 0.008);
      const targetLikesCount = Math.max(1, Math.round(addedViews * ratio));

      // 3. Populate likes with unique ObjectIds
      const existingLikesSet = new Set((video.likes || []).map((id) => id.toString()));
      let likesAddedThisVideo = 0;

      const shuffledUserIds = [...userIds].sort(() => 0.5 - Math.random());
      for (const uid of shuffledUserIds) {
        if (likesAddedThisVideo >= targetLikesCount) break;
        if (!existingLikesSet.has(uid.toString())) {
          video.likes.push(uid);
          existingLikesSet.add(uid.toString());
          likesAddedThisVideo += 1;
        }
      }

      const mongoose = require('mongoose');
      while (likesAddedThisVideo < targetLikesCount) {
        const syntheticId = new mongoose.Types.ObjectId();
        video.likes.push(syntheticId);
        likesAddedThisVideo += 1;
      }

      video.views = (video.views || 0) + addedViews;
      await video.save({ validateBeforeSave: false });

      totalViewsAdded += addedViews;
      totalLikesAdded += likesAddedThisVideo;

      // 4. Credit wallet reward to monetized creator
      if (video.owner && monetizedUserSet.has(video.owner.toString()) && parsedReward > 0) {
        const ownerIdStr = video.owner.toString();
        if (rewardMode === 'once_per_creator') {
          if (!creditedCreatorsSet.has(ownerIdStr)) {
            creditedCreatorsSet.add(ownerIdStr);
            await User.findByIdAndUpdate(video.owner, {
              $inc: { walletBalance: parsedReward, totalEarnings: parsedReward },
            });
            totalEarningsCredited += parsedReward;
            monetizedCreatorsRewarded += 1;
          }
        } else if (rewardMode === 'per_video') {
          await User.findByIdAndUpdate(video.owner, {
            $inc: { walletBalance: parsedReward, totalEarnings: parsedReward },
          });
          totalEarningsCredited += parsedReward;
          monetizedCreatorsRewarded += 1;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully boosted ${videos.length} video(s)!`,
      data: {
        videosCount: videos.length,
        totalViewsAdded,
        totalLikesAdded,
        monetizedCreatorsRewarded,
        totalEarningsCredited: Number(totalEarningsCredited.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get paginated server error logs
// @route   GET /api/admin/error-logs
// @access  Private/Admin
exports.getErrorLogs = async (req, res, next) => {
  try {
    const status = req.query.status || 'unresolved';
    const search = req.query.search ? req.query.search.trim() : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const query = {};
    if (status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { endpoint: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total, unresolvedCount, resolvedCount] = await Promise.all([
      ErrorLog.find(query)
        .sort('-lastSeenAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      ErrorLog.countDocuments(query),
      ErrorLog.countDocuments({ status: 'unresolved' }),
      ErrorLog.countDocuments({ status: 'resolved' }),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: {
        unresolved: unresolvedCount,
        resolved: resolvedCount,
        all: unresolvedCount + resolvedCount,
      },
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update error log status or note
// @route   PUT /api/admin/error-logs/:id
// @access  Private/Admin
exports.updateErrorLog = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const update = {};
    if (status && ['unresolved', 'resolved'].includes(status)) {
      update.status = status;
      if (status === 'resolved') {
        update.resolvedAt = new Date();
      }
    }
    if (adminNote !== undefined) {
      update.adminNote = adminNote;
    }

    const log = await ErrorLog.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!log) return res.status(404).json({ success: false, message: 'Error log not found' });
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete single error log
// @route   DELETE /api/admin/error-logs/:id
// @access  Private/Admin
exports.deleteErrorLog = async (req, res, next) => {
  try {
    const log = await ErrorLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Error log not found' });
    res.status(200).json({ success: true, message: 'Error log deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Clear all resolved error logs
// @route   DELETE /api/admin/error-logs/clear-resolved
// @access  Private/Admin
exports.clearResolvedErrorLogs = async (req, res, next) => {
  try {
    const result = await ErrorLog.deleteMany({ status: 'resolved' });
    res.status(200).json({ success: true, message: `Cleared ${result.deletedCount} resolved error logs` });
  } catch (err) {
    next(err);
  }
};

