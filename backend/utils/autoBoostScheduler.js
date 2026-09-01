const mongoose = require('mongoose');
const crypto = require('crypto');
const cron = require('node-cron');
const Video = require('../models/Video');
const User = require('../models/User');

/**
 * Deterministically generates a unique, persistent target view cap (between 130 and 290)
 * for a given video ID so that every video settles at a different, organic number.
 */
const getTargetCap = (videoId) => {
  const str = videoId ? videoId.toString() : '';
  const hash = crypto.createHash('md5').update(str).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) || 0;
  // Range: 130 to 290 inclusive
  return 130 + (num % 161);
};

/**
 * Executes one hourly pass of gradual organic boosting:
 * - Only public videos uploaded at least 3 hours ago (createdAt <= 3 hours ago)
 * - Only public videos below their unique deterministic cap (< 290)
 * - Increments 1-3 views (whole integer, capped at target)
 * - Adds 0-1 natural likes proportionally (no duplicates)
 * - 0 ₹ wallet balance (purely cosmetic)
 */
const processAutoHourlyBoost = async () => {
  try {
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const threeHoursAgo = new Date(Date.now() - THREE_HOURS_MS);

    // 1. Fetch eligible unpinned public videos uploaded at least 3 hours ago with views under max threshold
    const videos = await Video.find({
      visibility: 'public',
      isPinned: { $ne: true }, // Only unpinned videos should increase views
      views: { $lt: 290 },
      createdAt: { $lte: threeHoursAgo },
    });

    if (!videos.length) {
      return;
    }

    // 2. Fetch user IDs pool for safe like assignment
    const users = await User.find().select('_id').limit(100).lean();
    const userIds = users.map((u) => u._id);

    let updatedCount = 0;
    let totalViewsAdded = 0;
    let totalLikesAdded = 0;

    for (const video of videos) {
      // Strictly skip any pinned video
      if (video.isPinned === true || video.isPinned === 'true') {
        continue;
      }

      const targetCap = getTargetCap(video._id);
      const currentViews = Math.round(Number(video.views) || 0);

      // Skip if video has already reached or exceeded its unique cap
      if (currentViews >= targetCap) {
        continue;
      }

      // Generate random whole integer views (1, 2, or 3)
      const randomViews = Math.floor(Math.random() * 3) + 1;
      const finalAddedViews = Math.min(randomViews, targetCap - currentViews);

      if (finalAddedViews <= 0) {
        continue;
      }

      video.views = currentViews + finalAddedViews;
      totalViewsAdded += finalAddedViews;

      // Handle natural likes (target ~5% to 7% like-to-view ratio)
      const existingLikes = Array.isArray(video.likes) ? video.likes : [];
      const targetLikes = Math.round(video.views * 0.065);

      // Random ~35% chance per hour to add 1 like if current likes are below target ratio
      if (existingLikes.length < targetLikes && Math.random() < 0.35) {
        const existingLikesSet = new Set(existingLikes.map((id) => id.toString()));
        let likeAdded = false;

        // Try to pick an existing user ID not yet in likes
        const shuffled = [...userIds].sort(() => 0.5 - Math.random());
        for (const uid of shuffled) {
          if (!existingLikesSet.has(uid.toString())) {
            video.likes.push(uid);
            likeAdded = true;
            break;
          }
        }

        // Fallback to a synthetic ObjectId if user pool is exhausted
        if (!likeAdded) {
          video.likes.push(new mongoose.Types.ObjectId());
        }

        totalLikesAdded += 1;
      }

      // Save video without affecting any wallet balance or earnings
      await video.save({ validateBeforeSave: false });
      updatedCount += 1;
    }

    if (updatedCount > 0) {
      console.log(
        `[AutoBoostScheduler] Hourly pass: Boosted ${updatedCount} video(s) (+${totalViewsAdded} views, +${totalLikesAdded} likes).`
      );
    }
  } catch (err) {
    console.error('[AutoBoostScheduler] Error processing hourly auto-boost:', err.message);
  }
};

/**
 * Initializes the background cron job to run every hour at minute 0 (0 * * * *)
 */
const initAutoBoostScheduler = () => {
  // 1. Initial warm-up run 15 seconds after server startup
  setTimeout(processAutoHourlyBoost, 15 * 1000);

  // 2. Standard Cron Job scheduled to run at the start of every hour (e.g. 1:00, 2:00, 3:00)
  cron.schedule('0 * * * *', () => {
    console.log('[AutoBoostScheduler] Hourly cron job triggered.');
    processAutoHourlyBoost();
  });

  console.log('✅ [AutoBoostScheduler] Hourly cron job initialized (0 * * * *).');
};

module.exports = {
  getTargetCap,
  processAutoHourlyBoost,
  initAutoBoostScheduler,
};
