const Story = require('../models/Story');
const { deleteLocalFile } = require('./localUpload');

let isCleaning = false;

/**
 * Permanently removes expired stories (older than 24h) from both Cloudflare R2 / local storage and MongoDB.
 */
const cleanupExpiredStories = async () => {
  if (isCleaning) return;
  isCleaning = true;

  try {
    const now = new Date();
    const expiredStories = await Story.find({ expiresAt: { $lte: now } })
      .select('_id mediaUrl')
      .lean();

    if (!expiredStories || expiredStories.length === 0) {
      isCleaning = false;
      return;
    }

    console.log(`[StoryCleanup] Found ${expiredStories.length} expired story/stories to clean up.`);

    const expiredIds = [];
    for (const story of expiredStories) {
      if (!story || !story._id) continue;
      expiredIds.push(story._id);
      if (story.mediaUrl) {
        try {
          await deleteLocalFile(story.mediaUrl);
        } catch (delErr) {
          console.warn(`[StoryCleanup] File already deleted or failed for story ${story._id}:`, delErr?.message);
        }
      }
    }

    if (expiredIds.length > 0) {
      await Story.deleteMany({ _id: { $in: expiredIds } });
      console.log(`[StoryCleanup] Successfully purged ${expiredIds.length} expired stories from database and storage.`);
    }
  } catch (err) {
    console.error('[StoryCleanup] Error during expired story cleanup:', err?.message || err);
  } finally {
    isCleaning = false;
  }
};

/**
 * Initializes the recurring 24-hour story cleanup cron/timer (runs every 15 mins).
 */
const initStoryCleanupScheduler = () => {
  // Run on startup after 10 seconds
  setTimeout(() => {
    cleanupExpiredStories().catch(() => {});
  }, 10000);

  // Run recurring check every 15 minutes
  setInterval(() => {
    cleanupExpiredStories().catch(() => {});
  }, 15 * 60 * 1000);

  console.log('[Scheduler] Story 24-hour auto-cleanup scheduler initialized (runs every 15 mins).');
};

module.exports = {
  initStoryCleanupScheduler,
  cleanupExpiredStories,
};
