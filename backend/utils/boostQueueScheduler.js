const cron = require('node-cron');
const Video = require('../models/Video');
const VideoBoost = require('../models/VideoBoost');
const Notification = require('../models/Notification');
const { sendPushForEvent } = require('./pushNotification');

const MAX_ACTIVE_BOOSTS = 4;

/**
 * Evaluates and rotates the pinned video boost queue:
 * 1. Completes expired active boosts and unpins their videos.
 * 2. Promotes the next queued boosts to active status (up to 4 concurrent active slots).
 * 3. Recalculates queue positions and estimated start times across all 4 slots for queued items.
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

    // 2. Fetch currently running active boosts
    let activeBoosts = await VideoBoost.find({
      status: 'active',
      expiresAt: { $gt: now },
    }).populate('video', 'title');

    // 3. Promote queued boosts if any of the 4 concurrent highlight slots are open
    const slotsAvailable = MAX_ACTIVE_BOOSTS - activeBoosts.length;

    if (slotsAvailable > 0) {
      const nextBoosts = await VideoBoost.find({
        status: 'queued',
      })
        .sort({ createdAt: 1 })
        .limit(slotsAvailable)
        .populate('video', 'title');

      for (const nextBoost of nextBoosts) {
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

        activeBoosts.push(nextBoost);

        // Send push & in-app notification to the creator
        try {
          const videoTitle = nextBoost.video?.title || 'Your video';
          const message = `🚀 "${videoTitle}" is now pinned in the top highlights on the Home Feed for ${nextBoost.durationHours} hours!`;
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

    // 4. Recalculate queue positions and estimated start times across all 4 slots for remaining queued boosts
    const remainingQueued = await VideoBoost.find({
      status: 'queued',
    }).sort({ createdAt: 1 });

    const slotEndTimes = activeBoosts.map((b) => new Date(b.expiresAt).getTime());
    while (slotEndTimes.length < MAX_ACTIVE_BOOSTS) {
      slotEndTimes.push(now.getTime());
    }

    for (let i = 0; i < remainingQueued.length; i++) {
      const qBoost = remainingQueued[i];
      const minSlotIdx = slotEndTimes.indexOf(Math.min(...slotEndTimes));
      const startTime = new Date(Math.max(now.getTime(), slotEndTimes[minSlotIdx]));

      qBoost.queuePosition = i + 1;
      qBoost.estimatedStartTime = startTime;
      await qBoost.save();

      slotEndTimes[minSlotIdx] = startTime.getTime() + qBoost.durationHours * 3600 * 1000;
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
