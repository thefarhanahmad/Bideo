const Subscription = require('../models/Subscription');
const User = require('../models/User');

// @desc    Subscribe to a channel
// @route   POST /api/subscriptions/:channelId
// @access  Private
exports.subscribe = async (req, res, next) => {
  try {
    const channelId = req.params.channelId;
    const subscriberId = req.user.id;

    if (channelId === subscriberId) {
      return res.status(400).json({ success: false, message: 'You cannot subscribe to yourself' });
    }

    const channel = await User.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    let subscription = await Subscription.findOne({
      subscriber: subscriberId,
      channel: channelId,
    });

    if (subscription) {
      // Unsubscribe
      await subscription.deleteOne();
      channel.subscribersCount -= 1;
      await channel.save();

      return res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
    }

    // Subscribe
    subscription = await Subscription.create({
      subscriber: subscriberId,
      channel: channelId,
    });

    channel.subscribersCount += 1;
    await channel.save();

    res.status(201).json({
      success: true,
      data: subscription,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user's subscriptions
// @route   GET /api/subscriptions/me
// @access  Private
exports.getSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({ subscriber: req.user.id }).populate('channel', 'name avatar subscribersCount');

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
    });
  } catch (err) {
    next(err);
  }
};
