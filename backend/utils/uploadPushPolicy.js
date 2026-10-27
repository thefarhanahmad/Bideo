const PendingPush = require('../models/PendingPush');
const PushQuota = require('../models/PushQuota');

// Rules for "new upload" pushes (followers + recommended). Other pushes (chat, likes,
// comments, replies, new followers) are not affected.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const QUIET_FROM_HOUR = 22; // 10 PM IST
const QUIET_UNTIL_HOUR = 8; // 8 AM IST
const MAX_RECOMMENDATIONS_PER_DAY = parseInt(process.env.MAX_RECOMMENDED_PUSHES_PER_DAY, 10) || 10;

const istNow = (now) => new Date(now.getTime() + IST_OFFSET_MS);

/** True between 10 PM and 8 AM India time, when upload pushes are held until morning */
const isQuietHours = (now = new Date()) => {
  const hour = istNow(now).getUTCHours();
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
};

/** The India calendar day, e.g. "2026-10-27" */
const istDay = (now = new Date()) => istNow(now).toISOString().slice(0, 10);

/**
 * Uses up one of today's "recommended" pushes for each user who still has one left.
 * Safe when many uploads run at once: the counter is checked and raised in one database step.
 * Returns the ids (as strings) of the users who may be sent a recommendation now.
 */
const claimRecommendationQuota = async (userIds, now = new Date()) => {
  const ids = (userIds || []).map(String);
  if (ids.length === 0) return new Set();
  const day = istDay(now);
  const expireAt = new Date(Date.parse(`${day}T00:00:00+05:30`) + 2 * 24 * 60 * 60 * 1000);

  const ops = ids.map((id) => ({
    updateOne: {
      filter: { _id: `${id}:${day}`, recommendations: { $lt: MAX_RECOMMENDATIONS_PER_DAY } },
      update: { $inc: { recommendations: 1 }, $setOnInsert: { expireAt } },
      upsert: true,
    },
  }));

  // A user already at today's limit makes the upsert hit their existing counter (duplicate key):
  // that write fails and the user is left out. Any other failure is a real error.
  const overLimit = new Set();
  try {
    await PushQuota.bulkWrite(ops, { ordered: false });
  } catch (err) {
    const writeErrors = err?.writeErrors || err?.result?.getWriteErrors?.() || [];
    if (writeErrors.length === 0) throw err;
    for (const e of writeErrors) {
      if ((e.code ?? e.err?.code) !== 11000) throw err;
      overLimit.add(e.index ?? e.err?.index);
    }
  }
  return new Set(ids.filter((_, i) => !overLimit.has(i)));
};

// Writes that hit an existing document by design (duplicate key) are expected; anything else is logged
const runHoldWrites = async (ops, label) => {
  if (ops.length === 0) return;
  try {
    await PendingPush.bulkWrite(ops, { ordered: false });
  } catch (err) {
    const writeErrors = err?.writeErrors || err?.result?.getWriteErrors?.() || [];
    const unexpected = writeErrors.length === 0 || writeErrors.some((e) => (e.code ?? e.err?.code) !== 11000);
    if (unexpected) console.error(`[UploadPush] Failed to hold night ${label} pushes:`, err?.message || err);
  }
};

/**
 * Night: remembers that a followed creator uploaded, one document per person (a counter plus
 * the latest upload's message), so 8 AM sends one push per person however many uploads came in.
 */
const holdFollowerPushes = (recipientIds, { title, body, data }) =>
  runHoldWrites(
    (recipientIds || []).map((recipient) => ({
      updateOne: {
        filter: { recipient, kind: 'follower' },
        update: { $inc: { count: 1 }, $set: { title, body, data }, $setOnInsert: { createdAt: new Date() } },
        upsert: true,
      },
    })),
    'follower'
  );

/**
 * Night: keeps each person's single best-matching recommendation (replaced only by a better match).
 * candidates: [{ recipient, score, notification }]
 */
const holdRecommendationPushes = (candidates, { title, body, data }) =>
  runHoldWrites(
    (candidates || []).map(({ recipient, score, notification }) => ({
      updateOne: {
        // Matches when nothing is held yet or the held one is weaker; otherwise the upsert hits the
        // existing document (duplicate key) and the better one already held is kept
        filter: { recipient, kind: 'recommendation', score: { $lt: score } },
        update: { $set: { title, body, data, score, notification, count: 1 }, $setOnInsert: { createdAt: new Date() } },
        upsert: true,
      },
    })),
    'recommendation'
  );

module.exports = {
  MAX_RECOMMENDATIONS_PER_DAY,
  isQuietHours,
  istDay,
  claimRecommendationQuota,
  holdFollowerPushes,
  holdRecommendationPushes,
};
