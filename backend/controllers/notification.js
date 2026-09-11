const Notification = require('../models/Notification');
const User = require('../models/User');

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('actor', 'name avatar channelName')
      .populate('video', 'title thumbnail')
      .populate('comment', 'text')
      .sort('-createdAt')
      .limit(100);

    // Update lastNotificationViewedAt checkpoint when user loads notifications
    User.findByIdAndUpdate(req.user.id, { lastNotificationViewedAt: new Date() }).exec().catch(() => {});

    res.status(200).json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    next(err);
  }
};

// @desc    Get count of new/unviewed notifications
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadNotificationCount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('lastNotificationViewedAt').lean();
    const query = { recipient: req.user.id };

    if (user && user.lastNotificationViewedAt) {
      query.createdAt = { $gt: user.lastNotificationViewedAt };
    } else {
      query.read = false;
    }

    const unreadCount = await Notification.countDocuments(query);
    res.status(200).json({ success: true, count: unreadCount });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark notifications page as viewed (resets badge count)
// @route   PUT /api/notifications/viewed
// @access  Private
exports.markNotificationsViewed = async (req, res, next) => {
  try {
    const now = new Date();
    await User.findByIdAndUpdate(req.user.id, { lastNotificationViewedAt: now });
    res.status(200).json({ success: true, viewedAt: now, count: 0 });
  } catch (err) {
    next(err);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true });
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};
