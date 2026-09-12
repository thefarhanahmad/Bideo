const cron = require('node-cron');
const Video = require('../models/Video');
const VideoBoost = require('../models/VideoBoost');
const Notification = require('../models/Notification');
const { sendPushForEvent } = require('./pushNotification');

/**
 * Evaluates and rotates the pinned video boost queue:
 * 1. Completes expired active boosts and unpins their videos.
 * 2. Promotes the next queued boost to active status, pinning the video.
 * 3. Recalculates queue positions and estimated start times for all queued items.
 */
const processBoostQueue = async () => {
  try {
    const now = new Date();

    // 1. Expire finished active boosts
    const expiredBoosts = await VideoBoost.find({
      status: 'active',
      expiresAt: { $lte: now },
    });

    for (const boost of expiredBoosts) {
      boost.status = 'completed';
      await boost.save();

      await Video.findByIdAndUpdate(boost.video, {
        isPinned: false,
        boostExpiresAt: null,
        boostType: 'none',
      });
    }

    // 2. Check if there is an active boost running
    let activeBoost = await VideoBoost.findOne({
      status: 'active',
      expiresAt: { $gt: now },
    }).populate('video', 'title');

    // If no active boost is running, activate the oldest queued boost
    if (!activeBoost) {
      const nextBoost = await VideoBoost.findOne({
        status: 'queued',
      })
        .sort({ createdAt: 1 })
        .populate('video', 'title');

      if (nextBoost) {
        nextBoost.status = 'active';
        nextBoost.startedAt = now;
        nextBoost.expiresAt = new Date(now.getTime() + nextBoost.durationHours * 3600 * 1000);
        nextBoost.queuePosition = 0;
        nextBoost.estimatedStartTime = now;
        await nextBoost.save();

        await Video.findByIdAndUpdate(nextBoost.video._id || nextBoost.video, {
          isPinned: true,
          boostExpiresAt: nextBoost.expiresAt,
          boostType: 'user',
        });

        activeBoost = nextBoost;

        // Send notification to the creator
        try {
          const videoTitle = nextBoost.video?.title || 'Your video';
          const message = `🚀 "${videoTitle}" is now pinned at the top of the Home Feed for ${nextBoost.durationHours} hours!`;
          await Notification.create({
            recipient: nextBoost.user,
            actor: nextBoost.user,
            type: 'system',
            video: nextBoost.video?._id || nextBoost.video,
            message,
          });
          sendPushForEvent({
            recipient: nextBoost.user,
            actor: nextBoost.user,
            type: 'system',
            video: nextBoost.video?._id || nextBoost.video,
            message,
          }).catch(() => {});
        } catch (notifErr) {
          console.error('Failed to notify user for activated boost:', notifErr);
        }
      }
    }

    // 3. Recalculate queue positions and estimated start times for all remaining queued boosts
    const queuedBoosts = await VideoBoost.find({
      status: 'queued',
    }).sort({ createdAt: 1 });

    let cursorTime = activeBoost && activeBoost.expiresAt
      ? new Date(activeBoost.expiresAt.getTime())
      : new Date(now.getTime());

    for (let i = 0; i < queuedBoosts.length; i++) {
      const qBoost = queuedBoosts[i];
      qBoost.queuePosition = i + 1;
      qBoost.estimatedStartTime = new Date(cursorTime.getTime());
      await qBoost.save();

      cursorTime = new Date(cursorTime.getTime() + qBoost.durationHours * 3600 * 1000);
    }
  } catch (err) {
    console.error('Error processing video boost queue:', err);
  }
};

/**
 * Initializes the background queue processor running every 1 minute.
 */
const initBoostQueueScheduler = () => {
  // Run on startup
  processBoostQueue();

  // Run every 1 minute
  cron.schedule('*/1 * * * *', () => {
    processBoostQueue();
  });

  console.log('✅ Video Boost Queue Scheduler initialized (checking every 1 min).');
};

module.exports = {
  processBoostQueue,
  initBoostQueueScheduler,
};
