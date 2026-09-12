const mongoose = require('mongoose');
const User = require('../models/User');
const VideoReport = require('../models/VideoReport');
const Video = require('../models/Video');
const Category = require('../models/Category');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const ErrorLog = require('../models/ErrorLog');
const Ad = require('../models/Ad');
const Post = require('../models/Post');
const WalletCredit = require('../models/WalletCredit');
const VideoBoost = require('../models/VideoBoost');
const CoinTransaction = require('../models/CoinTransaction');
const { processPendingWalletCredits } = require('../services/walletSettlementService');
const { processBoostQueue } = require('../utils/boostQueueScheduler');

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

let cachedStats = null;
let cachedStatsTime = 0;
const STATS_CACHE_TTL_MS = 60 * 1000; // 60s cache

// @desc    Aggregated stats for the admin dashboard overview
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    if (!forceRefresh && cachedStats && Date.now() - cachedStatsTime < STATS_CACHE_TTL_MS) {
      return res.status(200).json({
        success: true,
        cached: true,
        data: cachedStats,
      });
    }

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
      userEarningsAgg,
      withdrawalsAgg,
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
      User.aggregate([
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$totalEarnings' },
            walletBalance: { $sum: '$walletBalance' },
            earningUsersCount: {
              $sum: {
                $cond: [{ $or: [{ $gt: ['$totalEarnings', 0] }, { $gt: ['$walletBalance', 0] }] }, 1, 0],
              },
            },
          },
        },
      ]),
      WithdrawalRequest.aggregate([
        {
          $group: {
            _id: '$status',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const visibility = { public: 0, unlisted: 0, private: 0 };
    visibilityAgg.forEach((row) => {
      if (row._id) visibility[row._id] = row.count;
    });

    const totalViews = viewsAgg[0] ? viewsAgg[0].total : 0;
    const longVideosTotal = Math.max(0, videosTotal - shortsTotal);

    const totalEarnings = Math.round((userEarningsAgg[0]?.totalEarnings || 0) * 100) / 100;
    const totalWalletBalance = Math.round((userEarningsAgg[0]?.walletBalance || 0) * 100) / 100;
    const earningUsersCount = userEarningsAgg[0]?.earningUsersCount || 0;

    let totalPaidOut = 0;
    let paidWithdrawalsCount = 0;
    let totalPendingWithdrawals = 0;
    let pendingWithdrawalsCount = 0;
    (withdrawalsAgg || []).forEach((w) => {
      if (w._id === 'approved') {
        totalPaidOut = Math.round(w.total * 100) / 100;
        paidWithdrawalsCount = w.count;
      } else if (w._id === 'pending') {
        totalPendingWithdrawals = Math.round(w.total * 100) / 100;
        pendingWithdrawalsCount = w.count;
      }
    });

    const totalUnpaid = Math.round((totalWalletBalance + totalPendingWithdrawals) * 100) / 100;

    const statsPayload = {
      users: {
        total: usersTotal,
        admins: adminsTotal,
        monetized: monetizedTotal,
        scheduledDeletions: scheduledDeletionsTotal,
        regular: Math.max(0, usersTotal - adminsTotal - monetizedTotal),
      },
      videos: {
        total: videosTotal,
        longVideos: longVideosTotal,
        shorts: shortsTotal,
        ...visibility,
      },
      earnings: {
        totalEarnings,
        walletBalance: totalWalletBalance,
        unpaidBalance: totalUnpaid,
        pendingPayouts: totalPendingWithdrawals,
        pendingPayoutsCount: pendingWithdrawalsCount,
        earningUsers: earningUsersCount,
        paidOut: totalPaidOut,
        paidCount: paidWithdrawalsCount,
      },
      categories: { total: categoriesTotal },
      reports: { total: reportsTotal, open: reportsOpen },
      totalViews,
      avgViewsPerVideo: videosTotal > 0 ? Math.round(totalViews / videosTotal) : 0,
      userTrends: trends.userTrends,
      videoTrends: trends.videoTrends,
      recentVideos,
      recentUsers,
    };

    cachedStats = statsPayload;
    cachedStatsTime = Date.now();

    res.status(200).json({
      success: true,
      data: statsPayload,
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
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    const search = (req.query.search || '').trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const [matchingVideos, matchingUsers] = await Promise.all([
        Video.find({ title: regex }).select('_id').limit(50),
        User.find({
          $or: [{ name: regex }, { channelName: regex }, { phone: regex }, { email: regex }],
        })
          .select('_id')
          .limit(50),
      ]);

      query.$or = [
        { reason: regex },
        { adminNote: regex },
        { video: { $in: matchingVideos.map((v) => v._id) } },
        { reporter: { $in: matchingUsers.map((u) => u._id) } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const fetchAll = req.query.all === 'true';
    const limit = fetchAll ? 10000 : Math.max(1, Math.min(parseInt(req.query.limit, 10) || 10, 100));
    const skip = (page - 1) * limit;

    const [reports, total, countsAgg] = await Promise.all([
      VideoReport.find(query)
        .populate({
          path: 'video',
          select: 'title thumbnail videoUrl views visibility owner',
          populate: { path: 'owner', select: 'name channelName avatar' },
        })
        .populate('reporter', 'name channelName avatar phone email')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      VideoReport.countDocuments(query),
      Promise.all([
        VideoReport.countDocuments({}),
        VideoReport.countDocuments({ status: 'open' }),
        VideoReport.countDocuments({ status: 'reviewed' }),
        VideoReport.countDocuments({ status: 'actioned' }),
        VideoReport.countDocuments({ status: 'dismissed' }),
      ]),
    ]);

    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      filterCounts: {
        all: countsAgg[0],
        open: countsAgg[1],
        reviewed: countsAgg[2],
        actioned: countsAgg[3],
        dismissed: countsAgg[4],
      },
      data: reports,
    });
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
    const search = (req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 10, 50));
    const skip = (page - 1) * limit;

    // 1. Fetch count stats and distinct pending user IDs in parallel using indexes
    const [pendingReviewsCount, pendingUserIds, pendingAppsCount, approvedMonetizedCount] = await Promise.all([
      VideoMonetizationReview.countDocuments({ status: 'pending' }),
      VideoMonetizationReview.distinct('user', { status: 'pending' }),
      MonetizationApplication.countDocuments({ status: 'pending' }),
      MonetizationApplication.countDocuments({ status: 'approved' }),
    ]);

    if (!pendingUserIds || pendingUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        page,
        pages: 1,
        data: [],
        counts: {
          videos: pendingReviewsCount,
          applications: pendingAppsCount,
          monetized: approvedMonetizedCount,
        },
      });
    }

    // 2. Count passed reviews for each of these users
    const passedCountsByUser = await VideoMonetizationReview.aggregate([
      {
        $match: {
          user: { $in: pendingUserIds },
          status: 'passed',
        },
      },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
        },
      },
    ]);

    const passedMap = new Map();
    passedCountsByUser.forEach((item) => {
      passedMap.set(item._id.toString(), item.count);
    });

    // 3. Filter out creators who already have 3 or more passed videos (Step 1 complete)
    let activeUserIds = pendingUserIds.filter((uid) => {
      const passed = passedMap.get(uid.toString()) || 0;
      return passed < 3;
    });

    if (activeUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        page,
        pages: 1,
        data: [],
        counts: {
          videos: pendingReviewsCount,
          applications: pendingAppsCount,
          monetized: approvedMonetizedCount,
        },
      });
    }

    // If search is provided, filter creators by creator name/channel/phone/email or video title
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const [matchingVideos, matchingUsers] = await Promise.all([
        Video.find({
          owner: { $in: activeUserIds },
          title: regex,
        })
          .select('_id owner')
          .lean(),
        User.find({
          _id: { $in: activeUserIds },
          $or: [{ name: regex }, { channelName: regex }, { phone: regex }, { email: regex }],
        })
          .select('_id')
          .lean(),
      ]);

      const matchingUserSet = new Set(matchingUsers.map((u) => u._id.toString()));
      matchingVideos.forEach((v) => {
        if (v.owner) matchingUserSet.add(v.owner.toString());
      });

      activeUserIds = activeUserIds.filter((uid) => matchingUserSet.has(uid.toString()));
    }

    const totalCreators = activeUserIds.length;
    const totalPages = Math.ceil(totalCreators / limit) || 1;

    // Paginate creators for the requested page
    const pagedUserIds = activeUserIds.slice(skip, skip + limit);

    if (pagedUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: totalCreators,
        page,
        pages: totalPages,
        data: [],
        counts: {
          videos: pendingReviewsCount,
          applications: pendingAppsCount,
          monetized: approvedMonetizedCount,
        },
      });
    }

    // 4. Query reviews ONLY for creators on the current page
    const reviews = await VideoMonetizationReview.find({
      user: { $in: pagedUserIds },
      status: { $in: ['pending', 'passed'] },
    })
      .populate('video', 'title thumbnail videoUrl views duration isShort createdAt')
      .populate('user', 'name channelName avatar email phone')
      .lean();

    // 5. Group reviews by user ID
    const userGroupsMap = {};
    for (const uid of pagedUserIds) {
      userGroupsMap[uid.toString()] = {
        user: null,
        passedCount: passedMap.get(uid.toString()) || 0,
        pendingCount: 0,
        reviews: [],
      };
    }

    const orphanReviewIds = [];
    for (const r of reviews) {
      if (!r.user) continue;
      if (!r.video) {
        orphanReviewIds.push(r._id);
        continue;
      }
      const userId = (r.user._id || r.user.id || r.user).toString();
      if (!userGroupsMap[userId]) {
        userGroupsMap[userId] = {
          user: r.user,
          passedCount: 0,
          pendingCount: 0,
          reviews: [],
        };
      }
      if (!userGroupsMap[userId].user) {
        userGroupsMap[userId].user = r.user;
      }
      if (r.status === 'pending') {
        userGroupsMap[userId].pendingCount += 1;
      }
      userGroupsMap[userId].reviews.push(r);
    }

    // Async batch cleanup for orphans without blocking response
    if (orphanReviewIds.length > 0) {
      VideoMonetizationReview.deleteMany({ _id: { $in: orphanReviewIds } }).exec().catch(() => {});
    }

    // Fill missing user info if any creator had no reviews matching criteria
    const missingUserIds = Object.keys(userGroupsMap).filter((id) => !userGroupsMap[id].user);
    if (missingUserIds.length > 0) {
      const fetchedUsers = await User.find({ _id: { $in: missingUserIds } })
        .select('name channelName avatar email phone')
        .lean();
      fetchedUsers.forEach((u) => {
        if (userGroupsMap[u._id.toString()]) {
          userGroupsMap[u._id.toString()].user = u;
        }
      });
    }

    // 6. Sort reviews for each user: 'passed' ON TOP, then 'pending', then newest first
    const statusRank = { passed: 0, pending: 1 };
    for (const userId in userGroupsMap) {
      userGroupsMap[userId].reviews.sort((a, b) => {
        const rankA = statusRank[a.status] !== undefined ? statusRank[a.status] : 2;
        const rankB = statusRank[b.status] !== undefined ? statusRank[b.status] : 2;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    const groupedData = Object.values(userGroupsMap).filter((g) => g.user && g.reviews.length > 0);

    res.status(200).json({
      success: true,
      count: groupedData.length,
      total: totalCreators,
      page,
      pages: totalPages,
      data: groupedData,
      counts: {
        videos: pendingReviewsCount,
        applications: pendingAppsCount,
        monetized: approvedMonetizedCount,
      },
    });
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
      {
        status,
        reviewMessage: reviewMessage || '',
        passedVia: status === 'passed' ? 'admin' : null,
        passedAt: status === 'passed' ? Date.now() : null,
        updatedAt: Date.now(),
      },
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

    const search = (req.query.search || '').trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const matchingUsers = await User.find({
        $or: [{ name: regex }, { channelName: regex }, { email: regex }, { phone: regex }],
      })
        .select('_id')
        .limit(100);

      query.$or = [
        { user: { $in: matchingUsers.map((u) => u._id) } },
        { name: regex },
        { phone: regex },
        { upiId: regex },
        { adharNumber: regex },
        { 'bankDetails.bankName': regex },
        { 'bankDetails.accountNumber': regex },
        { 'bankDetails.ifscCode': regex },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const fetchAll = req.query.all === 'true';
    const limit = fetchAll ? 10000 : Math.max(1, Math.min(parseInt(req.query.limit, 10) || 10, 100));
    const skip = (page - 1) * limit;

    const hasSearch = !!search;
    const isPending = status === 'pending';
    const isApproved = status === 'approved';

    const tasks = [
      MonetizationApplication.find(query)
        .populate('user', 'name channelName avatar email phone followersCount createdAt')
        .sort(status === 'approved' ? '-updatedAt' : '-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      MonetizationApplication.countDocuments({ status: 'pending' }),
      MonetizationApplication.countDocuments({ status: 'approved' }),
      VideoMonetizationReview.countDocuments({ status: 'pending' }),
    ];

    if (hasSearch || (!isPending && !isApproved)) {
      tasks.push(MonetizationApplication.countDocuments(query));
    }

    const results = await Promise.all(tasks);
    const applications = results[0];
    const pendingAppsCount = results[1];
    const approvedMonetizedCount = results[2];
    const pendingReviewsCount = results[3];
    const total = hasSearch || (!isPending && !isApproved)
      ? results[4]
      : (isPending ? pendingAppsCount : approvedMonetizedCount);

    res.status(200).json({
      success: true,
      count: applications.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      counts: {
        videos: pendingReviewsCount,
        applications: pendingAppsCount,
        monetized: approvedMonetizedCount,
      },
      data: applications,
    });
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

    const search = (req.query.search || '').trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const matchingUsers = await User.find({
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
          { channelName: regex },
        ],
      })
        .select('_id')
        .limit(100);

      const userIds = matchingUsers.map((u) => u._id);
      query.$or = [
        { user: { $in: userIds } },
        { 'payoutDetails.holderName': regex },
        { 'payoutDetails.upiId': regex },
        { 'payoutDetails.bankName': regex },
        { 'payoutDetails.accountNumber': regex },
        { transactionId: regex },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const fetchAll = req.query.all === 'true';
    const limit = fetchAll ? 10000 : Math.max(1, Math.min(parseInt(req.query.limit, 10) || 10, 100));
    const skip = (page - 1) * limit;

    const [withdrawals, total, countsAgg, amountAgg] = await Promise.all([
      WithdrawalRequest.find(query)
        .populate('user', 'name channelName avatar email phone walletBalance')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      WithdrawalRequest.countDocuments(query),
      Promise.all([
        WithdrawalRequest.countDocuments({}),
        WithdrawalRequest.countDocuments({ status: 'pending' }),
        WithdrawalRequest.countDocuments({ status: 'approved' }),
        WithdrawalRequest.countDocuments({ status: 'rejected' }),
      ]),
      WithdrawalRequest.aggregate([
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    let totalPendingAmount = 0;
    let totalPaidAmount = 0;
    amountAgg.forEach((a) => {
      if (a._id === 'pending') totalPendingAmount = a.totalAmount;
      if (a._id === 'approved') totalPaidAmount = a.totalAmount;
    });

    res.status(200).json({
      success: true,
      count: withdrawals.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      filterCounts: {
        all: countsAgg[0],
        pending: countsAgg[1],
        approved: countsAgg[2],
        rejected: countsAgg[3],
      },
      meta: {
        totalPendingAmount,
        totalPaidAmount,
      },
      data: withdrawals,
    });
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
            await WalletCredit.create({
              user: video.owner,
              video: video._id,
              amount: parsedReward,
              source: 'admin_boost',
              status: 'credited',
              isCredited: true,
              availableAt: new Date(),
              creditedAt: new Date(),
            }).catch(() => {});
            totalEarningsCredited += parsedReward;
            monetizedCreatorsRewarded += 1;
          }
        } else if (rewardMode === 'per_video') {
          await User.findByIdAndUpdate(video.owner, {
            $inc: { walletBalance: parsedReward, totalEarnings: parsedReward },
          });
          await WalletCredit.create({
            user: video.owner,
            video: video._id,
            amount: parsedReward,
            source: 'admin_boost',
            status: 'credited',
            isCredited: true,
            availableAt: new Date(),
            creditedAt: new Date(),
          }).catch(() => {});
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
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const isObjectId = mongoose.Types.ObjectId.isValid(search);
      const orConditions = [
        { message: regex },
        { endpoint: regex },
        { errorType: regex },
        { method: regex },
        { stack: regex },
        { adminNote: regex },
      ];
      if (isObjectId) {
        orConditions.push({ _id: search });
      }
      query.$or = orConditions;
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

// Helper for escaping regex strings
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to tokenize query into individual keywords and clean phrases
const parseSearchKeywords = (rawQuery) => {
  const clean = (rawQuery || '').trim();
  if (!clean) return { phrase: '', terms: [], regexes: [], phraseRegex: null };

  const phrase = clean.replace(/^[#@]+/, '').trim();
  const phraseRegex = new RegExp(escapeRegex(phrase), 'i');

  // Split on whitespace, commas, pluses, slashes, hashtags
  const rawTerms = clean
    .split(/[\s,+#|/]+/)
    .map((t) => t.trim().replace(/^[#@]+/, ''))
    .filter((t) => t.length > 0);

  const terms = Array.from(new Set(rawTerms));
  const regexes = terms.map((t) => new RegExp(escapeRegex(t), 'i'));

  return { phrase, terms, regexes, phraseRegex };
};

// Relevance scorer for videos
const scoreVideoRelevance = (v, { phrase, terms }) => {
  let score = 0;
  const title = (v.title || '').toLowerCase();
  const desc = (v.description || '').toLowerCase();
  const channel = (v.owner?.channelName || '').toLowerCase();
  const ownerName = (v.owner?.name || '').toLowerCase();
  const catName = (v.category?.name || '').toLowerCase();
  const idStr = (v._id ? v._id.toString() : '').toLowerCase();

  const rawTags = Array.isArray(v.tags) ? v.tags : (v.tags || '').split(',');
  const tags = rawTags.map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : '')).filter(Boolean);
  const tagsStr = tags.join(' ');

  const phraseLower = phrase.toLowerCase();

  // 1. Exact Video ID Match
  if (idStr && idStr === phraseLower) return 10000;

  // 2. Title scoring
  if (title === phraseLower) score += 3000;
  else if (title.startsWith(phraseLower)) score += 1500;
  else if (title.includes(phraseLower)) score += 800;

  // 3. Tag scoring
  if (tags.includes(phraseLower)) score += 1200;
  else if (tagsStr.includes(phraseLower)) score += 600;

  // 4. Channel / Owner scoring
  if (channel === phraseLower || ownerName === phraseLower) score += 1000;
  else if (channel.includes(phraseLower) || ownerName.includes(phraseLower)) score += 500;

  // 5. Description scoring
  if (desc.includes(phraseLower)) score += 200;

  // 6. Category scoring
  if (catName.includes(phraseLower)) score += 150;

  // 7. Individual keyword terms scoring
  let matchedTermsCount = 0;
  for (const term of terms) {
    const tLower = term.toLowerCase();
    let termMatched = false;

    if (title.includes(tLower)) {
      score += 250;
      termMatched = true;
    }
    if (tags.some((tag) => tag.includes(tLower) || tLower.includes(tag))) {
      score += 200;
      termMatched = true;
    }
    if (channel.includes(tLower) || ownerName.includes(tLower)) {
      score += 180;
      termMatched = true;
    }
    if (desc.includes(tLower)) {
      score += 50;
      termMatched = true;
    }
    if (catName.includes(tLower)) {
      score += 40;
      termMatched = true;
    }

    if (termMatched) matchedTermsCount++;
  }

  // Bonus if all terms matched
  if (terms.length > 1 && matchedTermsCount === terms.length) {
    score += 500;
  }

  // Engagement tie-breaker (views)
  score += Math.min(20, Math.log10((v.views || 0) + 1) * 3);

  return score;
};

// Relevance scorer for users
const scoreUserRelevance = (u, { phrase, terms }) => {
  let score = 0;
  const channel = (u.channelName || '').toLowerCase();
  const name = (u.name || '').toLowerCase();
  const email = (u.email || '').toLowerCase();
  const phone = (u.phone || '').toLowerCase();
  const about = (u.about || '').toLowerCase();
  const idStr = (u._id ? u._id.toString() : '').toLowerCase();
  const phraseLower = phrase.toLowerCase();

  if (idStr && idStr === phraseLower) return 10000;

  if (channel === phraseLower || name === phraseLower) score += 3000;
  else if (channel.startsWith(phraseLower) || name.startsWith(phraseLower)) score += 1500;
  else if (channel.includes(phraseLower) || name.includes(phraseLower)) score += 800;

  if (email.includes(phraseLower) || phone.includes(phraseLower)) score += 700;
  if (about.includes(phraseLower)) score += 150;

  let matchedTermsCount = 0;
  for (const term of terms) {
    const tLower = term.toLowerCase();
    let termMatched = false;
    if (channel.includes(tLower)) {
      score += 300;
      termMatched = true;
    }
    if (name.includes(tLower)) {
      score += 250;
      termMatched = true;
    }
    if (email.includes(tLower) || phone.includes(tLower)) {
      score += 200;
      termMatched = true;
    }
    if (about.includes(tLower)) {
      score += 50;
      termMatched = true;
    }
    if (termMatched) matchedTermsCount++;
  }

  if (terms.length > 1 && matchedTermsCount === terms.length) score += 500;
  if (u.isVerified) score += 50;
  if (u.isMonetized) score += 30;

  return score;
};

// @desc    Global multi-entity search across all admin dashboard resources
// @route   GET /api/admin/search
// @access  Private/Admin
exports.globalAdminSearch = async (req, res, next) => {
  try {
    const rawQuery = req.query.q || req.query.search || '';
    const q = rawQuery.trim();

    if (!q) {
      return res.status(200).json({
        success: true,
        data: {
          videos: [],
          users: [],
          categories: [],
          reports: [],
          monetization: [],
          payouts: [],
          ads: [],
        },
        counts: {
          videos: 0,
          users: 0,
          categories: 0,
          reports: 0,
          monetization: 0,
          payouts: 0,
          ads: 0,
          total: 0,
        },
      });
    }

    const { phrase, terms, regexes, phraseRegex } = parseSearchKeywords(q);
    const isObjectId = mongoose.Types.ObjectId.isValid(q);

    // Build user search clauses
    const userOrClauses = [];
    if (phraseRegex) {
      userOrClauses.push({ name: phraseRegex });
      userOrClauses.push({ channelName: phraseRegex });
      userOrClauses.push({ email: phraseRegex });
      userOrClauses.push({ phone: phraseRegex });
      userOrClauses.push({ about: phraseRegex });
    }
    regexes.forEach((tRegex) => {
      userOrClauses.push({ name: tRegex });
      userOrClauses.push({ channelName: tRegex });
      userOrClauses.push({ email: tRegex });
      userOrClauses.push({ phone: tRegex });
    });
    if (isObjectId) {
      userOrClauses.push({ _id: q });
    }

    // 1. First find matching user IDs for creator/channel linkage
    const matchingUsers = await User.find({ $or: userOrClauses })
      .select('name channelName avatar email phone role isVerified totalEarnings walletBalance followersCount createdAt')
      .limit(30)
      .lean();

    const matchingUserIds = matchingUsers.map((u) => u._id);

    // Build video search clauses (matching title, description, tags, creator, or exact ID)
    const videoOrClauses = [];
    if (phraseRegex) {
      videoOrClauses.push({ title: phraseRegex });
      videoOrClauses.push({ description: phraseRegex });
      videoOrClauses.push({ tags: phraseRegex });
      videoOrClauses.push({ tags: { $in: [phraseRegex] } });
    }
    regexes.forEach((tRegex) => {
      videoOrClauses.push({ title: tRegex });
      videoOrClauses.push({ description: tRegex });
      videoOrClauses.push({ tags: tRegex });
      videoOrClauses.push({ tags: { $in: [tRegex] } });
    });
    if (matchingUserIds.length > 0) {
      videoOrClauses.push({ owner: { $in: matchingUserIds } });
    }
    if (isObjectId) {
      videoOrClauses.push({ _id: q });
    }

    // 2. Parallel search across other collections
    const [
      videos,
      categories,
      reports,
      monetizationApps,
      payouts,
      ads,
      approvedMonetizationApps,
    ] = await Promise.all([
      // Videos: Title, description, tags, matching owners, or exact ID
      Video.find({ $or: videoOrClauses })
        .populate('owner', 'name channelName avatar isVerified email phone')
        .populate('category', 'name')
        .limit(60)
        .lean(),

      // Categories: Name, slug, description
      Category.find({
        $or: [
          ...(phraseRegex ? [{ name: phraseRegex }, { slug: phraseRegex }, { description: phraseRegex }] : []),
          ...regexes.map((r) => ({ name: r })),
          ...(isObjectId ? [{ _id: q }] : []),
        ],
      })
        .limit(15)
        .lean(),

      // Reports: Reason, adminNote, status, or matching video / reporter
      VideoReport.find({
        $or: [
          ...(phraseRegex ? [{ reason: phraseRegex }, { adminNote: phraseRegex }, { status: phraseRegex }] : []),
          ...regexes.map((r) => ({ reason: r })),
          ...(matchingUserIds.length > 0 ? [{ reporter: { $in: matchingUserIds } }] : []),
          ...(isObjectId ? [{ _id: q }] : []),
        ],
      })
        .populate({
          path: 'video',
          select: 'title thumbnail owner visibility views isShort tags',
          populate: { path: 'owner', select: 'name channelName avatar' },
        })
        .populate('reporter', 'name channelName avatar email phone')
        .limit(20)
        .lean(),

      // Monetization Applications
      MonetizationApplication.find({
        $or: [
          ...(phraseRegex
            ? [
                { name: phraseRegex },
                { phone: phraseRegex },
                { upiId: phraseRegex },
                { adharNumber: phraseRegex },
                { status: phraseRegex },
                { reviewMessage: phraseRegex },
              ]
            : []),
          ...regexes.map((r) => ({ name: r })),
          ...regexes.map((r) => ({ upiId: r })),
          ...(matchingUserIds.length > 0 ? [{ user: { $in: matchingUserIds } }] : []),
          ...(isObjectId ? [{ _id: q }] : []),
        ],
      })
        .populate('user', 'name channelName avatar email phone followersCount')
        .limit(15)
        .lean(),

      // Payouts (Withdrawals)
      WithdrawalRequest.find({
        $or: [
          ...(phraseRegex
            ? [
                { transactionId: phraseRegex },
                { adminNote: phraseRegex },
                { status: phraseRegex },
                { 'payoutDetails.holderName': phraseRegex },
                { 'payoutDetails.bankName': phraseRegex },
                { 'payoutDetails.accountNumber': phraseRegex },
                { 'payoutDetails.ifscCode': phraseRegex },
                { 'payoutDetails.upiId': phraseRegex },
              ]
            : []),
          ...regexes.map((r) => ({ transactionId: r })),
          ...regexes.map((r) => ({ 'payoutDetails.holderName': r })),
          ...(matchingUserIds.length > 0 ? [{ user: { $in: matchingUserIds } }] : []),
          ...(isObjectId ? [{ _id: q }] : []),
        ],
      })
        .populate('user', 'name channelName avatar email phone walletBalance')
        .limit(15)
        .lean(),

      // Ads
      Ad.find({
        $or: [
          ...(phraseRegex ? [{ title: phraseRegex }, { link: phraseRegex }, { type: phraseRegex }] : []),
          ...regexes.map((r) => ({ title: r })),
          ...(isObjectId ? [{ _id: q }] : []),
        ],
      })
        .limit(10)
        .lean(),

      // Monetization status check for users
      MonetizationApplication.find({ status: 'approved' }).select('user').lean(),
    ]);

    const approvedUserIdSet = new Set(
      approvedMonetizationApps.filter((a) => a.user).map((a) => a.user.toString())
    );

    // Rank and score videos
    const scoredVideos = videos
      .map((v) => ({ ...v, _score: scoreVideoRelevance(v, { phrase, terms }) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);

    // Rank and score users
    const scoredUsers = matchingUsers
      .map((u) => ({
        ...u,
        isMonetized: approvedUserIdSet.has(u._id.toString()),
        _score: scoreUserRelevance(u, { phrase, terms }),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    const totalCount =
      scoredVideos.length +
      scoredUsers.length +
      categories.length +
      reports.length +
      monetizationApps.length +
      payouts.length +
      ads.length;

    res.status(200).json({
      success: true,
      data: {
        videos: scoredVideos,
        users: scoredUsers,
        categories,
        reports,
        monetization: monetizationApps,
        payouts,
        ads,
      },
      counts: {
        videos: scoredVideos.length,
        users: scoredUsers.length,
        categories: categories.length,
        reports: reports.length,
        monetization: monetizationApps.length,
        payouts: payouts.length,
        ads: ads.length,
        total: totalCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get users earning statistics and list of user earnings (highest to lowest)
// @route   GET /api/admin/earnings
// @access  Private/Admin
exports.getUserEarnings = async (req, res, next) => {
  try {
    // 1. Process mature credits first
    await processPendingWalletCredits().catch(() => {});

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const sortBy = req.query.sort || 'lifetime_desc';
    const filter = req.query.filter || 'all';

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 2. Global KPI Calculations
    const [userTotalsAgg, todayTotalsAgg, pendingTotalsAgg, monetizedApps] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$totalEarnings' },
            totalWalletBalance: { $sum: '$walletBalance' },
            totalPendingBalance: { $sum: '$pendingBalance' },
            totalCreators: { $sum: 1 },
            activeEarners: {
              $sum: {
                $cond: [{ $or: [{ $gt: ['$totalEarnings', 0] }, { $gt: ['$walletBalance', 0] }] }, 1, 0],
              },
            },
          },
        },
      ]),
      WalletCredit.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfToday },
            status: { $in: ['pending', 'credited'] },
          },
        },
        {
          $group: {
            _id: null,
            todayTotal: { $sum: '$amount' },
            todayCreditsCount: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' },
          },
        },
      ]),
      WalletCredit.aggregate([
        {
          $match: {
            status: 'pending',
            isCredited: false,
          },
        },
        {
          $group: {
            _id: null,
            pendingTotal: { $sum: '$amount' },
            pendingCount: { $sum: 1 },
          },
        },
      ]),
      MonetizationApplication.find({ status: 'approved' }).select('user').lean(),
    ]);

    const approvedMonetizedUserIds = new Set(monetizedApps.map((a) => (a.user ? a.user.toString() : '')));

    const kpi = {
      totalLifetimeEarnings: Math.round((userTotalsAgg[0]?.totalEarnings || 0) * 100) / 100,
      totalWalletBalance: Math.round((userTotalsAgg[0]?.totalWalletBalance || 0) * 100) / 100,
      todayTotalEarnings: Math.round((todayTotalsAgg[0]?.todayTotal || 0) * 100) / 100,
      todayActiveEarners: todayTotalsAgg[0]?.uniqueUsers?.length || 0,
      totalPendingSettlement: Math.round((pendingTotalsAgg[0]?.pendingTotal || 0) * 100) / 100,
      totalPendingCount: pendingTotalsAgg[0]?.pendingCount || 0,
      totalMonetizedCreators: approvedMonetizedUserIds.size,
      totalActiveEarners: userTotalsAgg[0]?.activeEarners || 0,
    };

    // 3. User filter query
    const userQuery = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      userQuery.$or = [
        { name: regex },
        { channelName: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    if (filter === 'monetized') {
      const monetizedList = Array.from(approvedMonetizedUserIds).filter(Boolean);
      userQuery._id = { $in: monetizedList.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    // 4. Fetch today's earnings grouped by user
    const userTodayEarningsAgg = await WalletCredit.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfToday },
          status: { $in: ['pending', 'credited'] },
        },
      },
      {
        $group: {
          _id: '$user',
          todayAmount: { $sum: '$amount' },
        },
      },
    ]);

    const userTodayMap = new Map();
    userTodayEarningsAgg.forEach((r) => {
      if (r._id) userTodayMap.set(r._id.toString(), Math.round(r.todayAmount * 100) / 100);
    });

    if (filter === 'today') {
      const todayUserIds = Array.from(userTodayMap.keys());
      userQuery._id = { $in: todayUserIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    // 5. Fetch all matching users
    const allMatchingUsers = await User.find(userQuery)
      .select('name channelName avatar email phone role isVerified walletBalance pendingBalance totalEarnings createdAt')
      .lean();

    // Attach stats to every user
    const usersWithStats = allMatchingUsers.map((u) => {
      const uidStr = u._id.toString();
      const todayEarned = userTodayMap.get(uidStr) || 0;
      return {
        ...u,
        todayEarnings: todayEarned,
        totalEarnings: Math.round((u.totalEarnings || 0) * 100) / 100,
        walletBalance: Math.round((u.walletBalance || 0) * 100) / 100,
        pendingBalance: Math.round((u.pendingBalance || 0) * 100) / 100,
        isMonetized: approvedMonetizedUserIds.has(uidStr),
      };
    });

    // 6. Sort users (highest to lowest default)
    usersWithStats.sort((a, b) => {
      if (sortBy === 'today_desc') return b.todayEarnings - a.todayEarnings || b.totalEarnings - a.totalEarnings;
      if (sortBy === 'today_asc') return a.todayEarnings - b.todayEarnings;
      if (sortBy === 'wallet_desc') return b.walletBalance - a.walletBalance;
      if (sortBy === 'lifetime_asc') return a.totalEarnings - b.totalEarnings;
      // default: lifetime_desc
      return b.totalEarnings - a.totalEarnings || b.todayEarnings - a.todayEarnings;
    });

    const totalUsers = usersWithStats.length;
    const paginatedUsers = usersWithStats.slice(skip, skip + limit);
    const pages = Math.ceil(totalUsers / limit) || 1;

    res.status(200).json({
      success: true,
      kpi,
      total: totalUsers,
      pages,
      page,
      limit,
      data: paginatedUsers,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get paginated community posts for admin with search and filter
// @route   GET /api/admin/posts
// @access  Private/Admin
exports.getAdminPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const visibility = req.query.visibility || 'all';
    const ownerId = req.query.owner;

    const query = {};

    if (visibility && visibility !== 'all') {
      query.visibility = visibility;
    }

    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      query.owner = ownerId;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchedUsers = await User.find({
        $or: [{ name: regex }, { channelName: regex }],
      }).select('_id');
      const matchedUserIds = matchedUsers.map((u) => u._id);

      query.$or = [
        { text: regex },
        ...(matchedUserIds.length > 0 ? [{ owner: { $in: matchedUserIds } }] : []),
      ];
    }

    const [total, posts, filterCountsAgg] = await Promise.all([
      Post.countDocuments(query),
      Post.find(query)
        .populate('owner', 'name avatar channelName isVerified email phone')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.aggregate([
        {
          $group: {
            _id: '$visibility',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const filterCounts = { all: 0, public: 0, private: 0 };
    let totalAllPosts = 0;
    (filterCountsAgg || []).forEach((row) => {
      if (row._id === 'public') filterCounts.public = row.count;
      else if (row._id === 'private') filterCounts.private = row.count;
      totalAllPosts += row.count;
    });
    filterCounts.all = totalAllPosts;

    const formattedPosts = posts.map((p) => ({
      ...p,
      likesCount: Array.isArray(p.likes) ? p.likes.length : 0,
      commentsCount: Number(p.commentsCount) || 0,
    }));

    res.status(200).json({
      success: true,
      total,
      pages: Math.ceil(total / limit) || 1,
      page,
      limit,
      filterCounts,
      data: formattedPosts,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Channel Boost analytics, users with coins, active & queued highlights
// @route   GET /api/admin/boost
// @access  Private/Admin
exports.getAdminBoostData = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const filter = req.query.filter || 'all'; // all, active, queued, ads_today, high_coins, has_boosted
    const sortBy = req.query.sort || 'coins_desc';

    // 1. Process boost queue to ensure expired boosts are rotated and queue positions are accurate
    if (typeof processBoostQueue === 'function') {
      try {
        await processBoostQueue();
      } catch (queueErr) {
        console.error('Admin Boost: Error processing boost queue:', queueErr);
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 2. Fetch Active, Queued, and All-time boost stats
    const [
      userCoinsAgg,
      totalBoostsCount,
      coinsSpentAgg,
      todayAdsAgg,
      usersWithCoinsCount,
      usersReadyCount,
      allActiveBoosts,
      allQueuedBoosts,
      boostCountsByUser,
    ] = await Promise.all([
      User.aggregate([
        { $match: { coins: { $gt: 0 } } },
        { $group: { _id: null, totalCoins: { $sum: '$coins' } } },
      ]),
      VideoBoost.countDocuments(),
      VideoBoost.aggregate([
        { $group: { _id: null, totalCoinsSpent: { $sum: '$coinsSpent' } } },
      ]),
      CoinTransaction.aggregate([
        {
          $match: {
            type: 'ad_reward',
            createdAt: { $gte: startOfToday },
          },
        },
        {
          $group: {
            _id: null,
            todayAdsCount: { $sum: 1 },
            todayCoinsAwarded: { $sum: '$amount' },
            uniqueViewers: { $addToSet: '$user' },
          },
        },
      ]),
      User.countDocuments({ coins: { $gt: 0 } }),
      User.countDocuments({ coins: { $gte: 100 } }),
      VideoBoost.find({ status: 'active', expiresAt: { $gt: now } })
        .populate('video', 'title thumbnail views duration')
        .lean(),
      VideoBoost.find({ status: 'queued' })
        .sort({ queuePosition: 1, createdAt: 1 })
        .populate('video', 'title thumbnail views duration')
        .lean(),
      VideoBoost.aggregate([
        {
          $group: {
            _id: '$user',
            totalBoosts: { $sum: 1 },
            totalSpent: { $sum: '$coinsSpent' },
            lastBoostAt: { $max: '$createdAt' },
          },
        },
      ]),
    ]);

    const activeMap = new Map();
    allActiveBoosts.forEach((b) => {
      if (b.user) activeMap.set(b.user.toString(), b);
    });

    const queuedMap = new Map();
    allQueuedBoosts.forEach((b) => {
      if (b.user) {
        const uStr = b.user.toString();
        if (!queuedMap.has(uStr)) queuedMap.set(uStr, []);
        queuedMap.get(uStr).push(b);
      }
    });

    const userBoostStatsMap = new Map();
    boostCountsByUser.forEach((b) => {
      if (b._id) userBoostStatsMap.set(b._id.toString(), b);
    });

    const activeUserIds = Array.from(activeMap.keys());
    const queuedUserIds = Array.from(queuedMap.keys());
    const boostedUserIds = Array.from(userBoostStatsMap.keys());

    // 3. Tab counts (exact counts for all 6 tabs)
    const [todayAdsUsersCount, highCoinsUsersCount, totalAllUsersCount] = await Promise.all([
      User.countDocuments({
        'adRewards.dailyDate': todayStr,
        'adRewards.dailyCount': { $gt: 0 },
      }),
      User.countDocuments({ coins: { $gte: 100 } }),
      User.countDocuments({
        $or: [
          { coins: { $gt: 0 } },
          { _id: { $in: boostedUserIds.map((id) => new mongoose.Types.ObjectId(id)) } },
          { 'adRewards.dailyDate': todayStr, 'adRewards.dailyCount': { $gt: 0 } },
        ],
      }),
    ]);

    const tabCounts = {
      all: totalAllUsersCount,
      active: activeUserIds.length,
      queued: queuedUserIds.length,
      ads_today: todayAdsUsersCount,
      high_coins: highCoinsUsersCount,
      has_boosted: boostedUserIds.length,
    };

    const kpi = {
      totalCirculatingCoins: userCoinsAgg[0]?.totalCoins || 0,
      usersWithCoins: usersWithCoinsCount,
      usersReadyToBoost: usersReadyCount,
      activeHighlights: allActiveBoosts.length,
      queuedHighlights: allQueuedBoosts.length,
      totalBoostsAllTime: totalBoostsCount,
      totalCoinsSpent: coinsSpentAgg[0]?.totalCoinsSpent || 0,
      todayAdsWatched: todayAdsAgg[0]?.todayAdsCount || 0,
      todayCoinsAwarded: todayAdsAgg[0]?.todayCoinsAwarded || 0,
      todayActiveViewers: todayAdsAgg[0]?.uniqueViewers?.length || 0,
    };

    // 4. Construct user query based on filter
    let userFilterClause = {};

    if (filter === 'active') {
      userFilterClause = {
        _id: { $in: activeUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
      };
    } else if (filter === 'queued') {
      userFilterClause = {
        _id: { $in: queuedUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
      };
    } else if (filter === 'ads_today') {
      userFilterClause = {
        'adRewards.dailyDate': todayStr,
        'adRewards.dailyCount': { $gt: 0 },
      };
    } else if (filter === 'high_coins') {
      userFilterClause = {
        coins: { $gte: 100 },
      };
    } else if (filter === 'has_boosted') {
      userFilterClause = {
        _id: { $in: boostedUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
      };
    } else {
      // Default: 'all'
      userFilterClause = {
        $or: [
          { coins: { $gt: 0 } },
          { _id: { $in: boostedUserIds.map((id) => new mongoose.Types.ObjectId(id)) } },
          { 'adRewards.dailyDate': todayStr, 'adRewards.dailyCount': { $gt: 0 } },
        ],
      };
    }

    let finalQuery = userFilterClause;

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { name: regex },
        { channelName: regex },
        { email: regex },
      ];
      finalQuery = {
        $and: [
          userFilterClause,
          { $or: searchConditions },
        ],
      };
    }

    const matchingUsers = await User.find(finalQuery)
      .select('name channelName avatar email phone coins adRewards createdAt isVerified')
      .lean();

    // Attach enriched boost information to each user
    const usersWithBoostInfo = matchingUsers.map((u) => {
      const uIdStr = u._id.toString();
      const active = activeMap.get(uIdStr) || null;
      const queued = queuedMap.get(uIdStr) || [];
      const stats = userBoostStatsMap.get(uIdStr) || { totalBoosts: 0, totalSpent: 0, lastBoostAt: null };

      // Normalise daily ads for today
      let dailyAdsCount = u.adRewards?.dailyDate === todayStr ? (u.adRewards?.dailyCount || 0) : 0;

      // Lowest queue position for user
      const minQueuePos = queued.length > 0
        ? Math.min(...queued.map((q) => (typeof q.queuePosition === 'number' ? q.queuePosition : 999)))
        : 999;

      // Status computation
      let status = 'idle';
      if (active && queued.length > 0) {
        status = 'live_and_queued';
      } else if (active) {
        status = 'live';
      } else if (queued.length > 0) {
        status = 'queued';
      } else if ((u.coins || 0) >= 100) {
        status = 'ready';
      } else if (dailyAdsCount > 0) {
        status = 'active_viewer';
      }

      return {
        ...u,
        coins: u.coins || 0,
        dailyAdsCount,
        sessionCount: u.adRewards?.sessionCount || 0,
        lastAdWatchedAt: u.adRewards?.lastAdWatchedAt || null,
        activeBoost: active
          ? {
              _id: active._id,
              durationHours: active.durationHours,
              coinsSpent: active.coinsSpent,
              startedAt: active.startedAt,
              expiresAt: active.expiresAt,
              remainingSeconds: Math.max(0, Math.ceil((new Date(active.expiresAt).getTime() - now.getTime()) / 1000)),
              video: active.video,
            }
          : null,
        queuedBoosts: queued.map((q) => ({
          _id: q._id,
          durationHours: q.durationHours,
          coinsSpent: q.coinsSpent,
          queuePosition: q.queuePosition,
          estimatedStartTime: q.estimatedStartTime,
          video: q.video,
        })),
        minQueuePos,
        totalBoosts: stats.totalBoosts,
        totalCoinsSpent: stats.totalSpent,
        lastBoostAt: stats.lastBoostAt,
        status,
      };
    });

    // 5. Sorting
    usersWithBoostInfo.sort((a, b) => {
      if (filter === 'queued') {
        // Queued tab: Sort by queue position (lowest position #1 first)
        return a.minQueuePos - b.minQueuePos;
      }
      if (filter === 'active') {
        // Active tab: Sort by remaining live time
        return (b.activeBoost?.remainingSeconds || 0) - (a.activeBoost?.remainingSeconds || 0);
      }
      if (filter === 'ads_today' || sortBy === 'ads_desc') {
        return b.dailyAdsCount - a.dailyAdsCount || b.coins - a.coins;
      }
      if (filter === 'has_boosted' || sortBy === 'boosts_desc') {
        return b.totalBoosts - a.totalBoosts || b.coins - a.coins;
      }
      if (sortBy === 'coins_asc') return a.coins - b.coins;
      if (sortBy === 'latest') {
        return (
          new Date(b.lastAdWatchedAt || b.lastBoostAt || b.createdAt) -
          new Date(a.lastAdWatchedAt || a.lastBoostAt || a.createdAt)
        );
      }
      // default: coins_desc
      return b.coins - a.coins || b.totalBoosts - a.totalBoosts;
    });

    const total = usersWithBoostInfo.length;
    const pages = Math.ceil(total / limit) || 1;
    const paginated = usersWithBoostInfo.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      kpi,
      tabCounts,
      total,
      pages,
      page,
      limit,
      data: paginated,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get detailed boost and coin transaction history for a specific user
// @route   GET /api/admin/boost/user/:userId
// @access  Private/Admin
exports.getAdminUserBoostDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('name channelName avatar email phone coins adRewards createdAt isVerified')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [boosts, transactions] = await Promise.all([
      VideoBoost.find({ user: userId })
        .sort({ createdAt: -1 })
        .populate('video', 'title thumbnail views duration')
        .lean(),
      CoinTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        boosts,
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
};



