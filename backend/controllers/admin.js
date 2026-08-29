const User = require('../models/User');
const VideoReport = require('../models/VideoReport');
const Video = require('../models/Video');
const Category = require('../models/Category');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const WithdrawalRequest = require('../models/WithdrawalRequest');

// @desc    Aggregated stats for the admin dashboard overview
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res, next) => {
  try {
    const [
      usersTotal,
      adminsTotal,
      videosTotal,
      categoriesTotal,
      reportsTotal,
      reportsOpen,
      visibilityAgg,
      viewsAgg,
      recentVideos,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      Video.countDocuments(),
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
    ]);

    const visibility = { public: 0, unlisted: 0, private: 0 };
    visibilityAgg.forEach((row) => {
      if (row._id) visibility[row._id] = row.count;
    });

    res.status(200).json({
      success: true,
      data: {
        users: { total: usersTotal, admins: adminsTotal },
        videos: { total: videosTotal, ...visibility },
        categories: { total: categoriesTotal },
        reports: { total: reportsTotal, open: reportsOpen },
        totalViews: viewsAgg[0] ? viewsAgg[0].total : 0,
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
      .sort('-createdAt');
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
      .sort('-createdAt');

    // Group reviews by user ID
    const userGroupsMap = {};
    for (const r of reviews) {
      if (!r.user) continue;
      const userId = r.user._id.toString();
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
      .sort(status === 'approved' ? '-updatedAt' : '-createdAt');
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
      .sort('-createdAt');
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
