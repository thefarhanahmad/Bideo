const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushForEvent } = require('./pushNotification');

/**
 * Production-grade scheduler to audit and expire purchased verified badges.
 * Admin-granted verifications (verifiedSource !== 'coin_purchase') are permanently preserved.
 */
const processExpiredBadges = async () => {
  try {
    const now = new Date();

    // Query strictly for users with coin_purchase whose badge expiration date has passed
    const expiredUsers = await User.find({
      isVerified: true,
      verifiedSource: 'coin_purchase',
      verifiedUntil: { $lte: now, $ne: null },
    })
      .select('_id name channelName pushToken pushTokens')
      .limit(500);

    if (!expiredUsers || expiredUsers.length === 0) {
      return;
    }

    const expiredIds = expiredUsers.map((u) => u._id);

    // Atomically reset verified status for all identified expired users
    await User.updateMany(
      {
        _id: { $in: expiredIds },
        isVerified: true,
        verifiedSource: 'coin_purchase',
        verifiedUntil: { $lte: now },
      },
      {
        $set: {
          isVerified: false,
          verifiedUntil: null,
          verifiedSource: null,
        },
      }
    );

    console.log(`[VerifiedBadgeScheduler] Successfully expired ${expiredIds.length} badge(s) at ${now.toISOString()}`);

    // Send notifications asynchronously without blocking the scheduler
    for (const user of expiredUsers) {
      const message = 'ℹ️ Your 1-Month Verified Badge has ended. You can renew it anytime from the Boost screen!';
      Notification.create({
        recipient: user._id,
        actor: user._id,
        type: 'system',
        message,
      }).catch((err) => {
        console.error(`Failed to create expiration notification for user ${user._id}:`, err?.message);
      });

      sendPushForEvent({
        recipient: user._id,
        actor: user._id,
        type: 'system',
        message,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[VerifiedBadgeScheduler] Error processing expired badges:', err);
  }
};

/**
 * Initializes the background verified badge expiration scheduler running every 10 minutes.
 */
const initVerifiedBadgeScheduler = () => {
  // Run on startup
  processExpiredBadges();

  // Run every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    processExpiredBadges();
  });

  console.log('✅ Verified Badge Expiration Scheduler initialized (running every 10 min).');
};

module.exports = {
  processExpiredBadges,
  initVerifiedBadgeScheduler,
};
