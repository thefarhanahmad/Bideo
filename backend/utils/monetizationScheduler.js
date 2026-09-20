const cron = require('node-cron');
const MonetizationApplication = require('../models/MonetizationApplication');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('./pushNotification');

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

/**
 * Checks all pending monetization applications submitted at least 48 hours (2 days) ago.
 * If the user has passed at least 3 videos for monetization, auto-approves the application.
 * Matches exactly what happens on manual admin approval.
 * Guarantees a user cannot be hit or approved more than once.
 */
const checkAndApproveMonetization = async () => {
  try {
    const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS);

    // Find all pending applications submitted at least 2 days ago
    const pendingApplications = await MonetizationApplication.find({
      status: 'pending',
      createdAt: { $lte: twoDaysAgo },
    });

    if (!pendingApplications.length) {
      return;
    }

    // Fetch an admin user ID so notification actor matches admin side approval
    const adminUser = await User.findOne({ role: 'admin' }).select('_id').lean();

    for (const app of pendingApplications) {
      // 1. Verify user has at least 3 passed videos for monetization
      const passedVideosCount = await VideoMonetizationReview.countDocuments({
        user: app.user,
        status: 'passed',
      });

      if (passedVideosCount < 3) {
        continue;
      }

      // 2. Atomically transition status from 'pending' to 'approved'
      // This strictly guarantees idempotency: if the application was already approved,
      // findOneAndUpdate will return null and the user will NEVER be hit again.
      const updatedApp = await MonetizationApplication.findOneAndUpdate(
        { _id: app._id, status: 'pending' },
        { $set: { status: 'approved', updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!updatedApp) {
        // Already processed or no longer pending
        continue;
      }

      const actorId = adminUser?._id || updatedApp.user;
      const approvalMessage =
        'Congratulations! Your channel monetization application has been approved. You are now earning from video views! 🎉';

      // 3. Create exact same in-app notification as admin approval
      Notification.create({
        recipient: updatedApp.user,
        actor: actorId,
        type: 'system',
        message: approvalMessage,
      }).catch((err) => {
        console.warn('[MonetizationScheduler] Notification create error:', err.message);
      });

      // 4. Send mobile push notification
      sendPushNotification({
        recipientId: updatedApp.user,
        title: 'Monetization Approved! 🎉',
        body: approvalMessage,
        data: { type: 'system' },
      }).catch(() => {});

      console.log(
        `[MonetizationScheduler] Auto-approved monetization application for user: ${updatedApp.user} (${passedVideosCount} videos passed)`
      );
    }
  } catch (err) {
    console.error('[MonetizationScheduler] Error running monetization auto-approval scheduler:', err.message);
  }
};

/**
 * Initializes the monetization auto-approval scheduler
 * Runs once every 1 hour
 */
const initMonetizationScheduler = () => {
  // Run once shortly after server startup
  setTimeout(checkAndApproveMonetization, 15 * 1000);

  // Run on each 1 hour (at minute 0 of every hour)
  cron.schedule('0 * * * *', () => {
    checkAndApproveMonetization();
  });

  console.log('✅ [MonetizationScheduler] Monetization auto-approval scheduler initialized (runs every 1 hour for 48h approval).');
};

module.exports = {
  checkAndApproveMonetization,
  initMonetizationScheduler,
};
