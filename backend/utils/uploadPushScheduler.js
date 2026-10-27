const User = require('../models/User');
const Notification = require('../models/Notification');
const PendingPush = require('../models/PendingPush');
const { isQuietHours, claimRecommendationQuota } = require('./uploadPushPolicy');
const { buildPushMessages, sendBatchPushNotifications } = require('./pushNotification');

// Sends the upload pushes held overnight (10 PM - 8 AM IST) once it is 8 AM:
// - followers: one held upload is sent as it was; several become one summary push
// - recommendations: each person's best match, only if today's limit allows
// Held documents are at most two per person (see models/PendingPush.js), read in batches.
const BATCH = 1000;
const CHECK_EVERY_MS = 5 * 60 * 1000;
let flushing = false;

const devicesOf = async (ids) => {
  const users = await User.find({
    _id: { $in: ids },
    isBlocked: { $ne: true },
    $or: [{ pushToken: { $exists: true, $nin: [null, ''] } }, { 'pushTokens.0': { $exists: true } }],
  })
    .select('pushToken pushTokens')
    .lean();
  return new Map(users.map((u) => [String(u._id), u]));
};

const followerContent = (held) =>
  held.count > 1
    ? {
        title: `${held.count} new uploads from creators you follow`,
        body: 'Tap to see what you missed overnight',
        data: { type: 'upload_digest', screen: '/notifications' },
      }
    : { title: held.title, body: held.body, data: held.data || {} };

const flushKind = async (kind, send, now) => {
  let sent = 0;
  for (;;) {
    const held = await PendingPush.find({ kind }).sort({ _id: 1 }).limit(BATCH).lean();
    if (held.length === 0) return sent;

    const devices = await devicesOf(held.map((h) => h.recipient));
    let deliver = held.filter((h) => devices.has(String(h.recipient)));
    if (kind === 'recommendation') {
      const allowed = await claimRecommendationQuota(deliver.map((h) => h.recipient), now);
      deliver = deliver.filter((h) => allowed.has(String(h.recipient)));
      const notifications = deliver.map((h) => h.notification).filter(Boolean);
      if (notifications.length > 0) await Notification.insertMany(notifications, { ordered: false }).catch(() => {});
    }

    const messages = deliver.flatMap((h) =>
      buildPushMessages([devices.get(String(h.recipient))], kind === 'follower' ? followerContent(h) : { title: h.title, body: h.body, data: h.data || {} })
    );
    if (messages.length > 0) await send(messages);
    sent += deliver.length;
    // Remove the whole batch (also people with no device or no recommendations left today)
    await PendingPush.deleteMany({ _id: { $in: held.map((h) => h._id) } });
  }
};

/** Sends everything held overnight; does nothing during night hours or while already running */
const flushHeldUploadPushes = async ({ now = new Date(), send = sendBatchPushNotifications } = {}) => {
  if (flushing || isQuietHours(now)) return null;
  flushing = true;
  try {
    const followers = await flushKind('follower', send, now);
    const recommendations = await flushKind('recommendation', send, now);
    if (followers || recommendations) {
      console.log(`[UploadPush] Sent held night pushes to ${followers} followers, ${recommendations} recommended`);
    }
    return { followers, recommendations };
  } catch (err) {
    console.error('[UploadPush] Failed to send held night pushes:', err?.message || err);
    return null;
  } finally {
    flushing = false;
  }
};

const initUploadPushScheduler = () => {
  setTimeout(() => flushHeldUploadPushes().catch(() => {}), 60 * 1000);
  setInterval(() => flushHeldUploadPushes().catch(() => {}), CHECK_EVERY_MS);
  console.log('[Scheduler] Night upload push sender initialized (sends held pushes from 8 AM IST, checks every 5 mins).');
};

module.exports = { initUploadPushScheduler, flushHeldUploadPushes };
