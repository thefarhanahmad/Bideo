const User = require('../models/User');
const Video = require('../models/Video');
const Notification = require('../models/Notification');
const { sendPushForEvent } = require('./pushNotification');

const MILESTONE_VIEWS_FOR_VERIFICATION = 100000; // 1 Lac (100,000) views

/**
 * Check if a channel has reached 1 lac total views across videos and auto-verify permanently
 * @param {string|import('mongoose').Types.ObjectId} channelId
 * @returns {Promise<boolean>} returns true if channel is verified
 */
async function checkAndApplyChannelVerification(channelId) {
  if (!channelId) return false;

  try {
    const user = await User.findById(channelId).select('name channelName isVerified verifiedSource verifiedUntil verifiedAt');
    if (!user) return false;

    // If already verified permanently (admin or views_milestone), nothing to update
    if (user.isVerified && (user.verifiedSource === 'admin' || user.verifiedSource === 'views_milestone')) {
      return true;
    }

    // Calculate total views across public videos (both long videos and shorts)
    const viewsAgg = await Video.aggregate([
      { $match: { owner: user._id, $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);

    const totalViews = viewsAgg && viewsAgg.length > 0 && viewsAgg[0].totalViews ? viewsAgg[0].totalViews : 0;

    if (totalViews >= MILESTONE_VIEWS_FOR_VERIFICATION) {
      // Auto-verify channel permanently
      user.isVerified = true;
      user.verifiedSource = 'views_milestone';
      user.verifiedAt = user.verifiedAt || new Date();
      user.verifiedUntil = null; // Permanent: never expires
      await user.save();

      // Send milestone notification to creator
      try {
        const notifPayload = {
          recipient: user._id,
          actor: null,
          type: 'milestone',
          message: `🎉 Congratulations! Your channel has reached 100,000 views and earned an official permanent Verified Creator badge (Blue Tick)!`,
        };
        await Notification.create(notifPayload);
        sendPushForEvent(notifPayload).catch(() => {});
      } catch (notifErr) {
        console.warn('Failed to send 1 lac view verification milestone notification:', notifErr.message);
      }

      return true;
    }

    return false;
  } catch (err) {
    console.error('Error in checkAndApplyChannelVerification:', err);
    return false;
  }
}

module.exports = {
  MILESTONE_VIEWS_FOR_VERIFICATION,
  checkAndApplyChannelVerification,
};
