const User = require('../models/User');
const VideoReport = require('../models/VideoReport');
const Video = require('../models/Video');
const Category = require('../models/Category');

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
