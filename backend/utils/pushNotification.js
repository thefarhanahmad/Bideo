const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follower = require('../models/Follower');
const { extractKeywords } = require('./recommendation');
const {
  isQuietHours,
  claimRecommendationQuota,
  holdFollowerPushes,
  holdRecommendationPushes,
} = require('./uploadPushPolicy');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Helper to validate standard Expo Push Token formats (ExponentPushToken, ExpoPushToken, or raw UUID)
 */
function isValidPushToken(token) {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')) return true;
  if (/^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/i.test(t)) return true;
  return false;
}

/**
 * One Expo message per valid device token of each user ({ pushToken, pushTokens })
 */
function buildPushMessages(users, { title, body, data = {} }) {
  const messages = [];
  (users || []).forEach((u) => {
    const tokens = new Set();
    if (u.pushToken) tokens.add(u.pushToken);
    if (Array.isArray(u.pushTokens)) u.pushTokens.forEach((t) => t && tokens.add(t));
    tokens.forEach((to) => {
      if (isValidPushToken(to)) {
        messages.push({ to, sound: 'default', title, body, data, priority: 'high', channelId: 'default' });
      }
    });
  });
  return messages;
}

/**
 * Send push notification to a single user via Expo Push Service
 * @param {Object} options
 * @param {string|ObjectId} options.recipientId - Recipient user ID
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} [options.data] - Custom data payload
 */
async function sendPushNotification({ recipientId, title, body, data = {} }) {
  try {
    if (!recipientId) return;

    const user = await User.findById(recipientId).select('pushToken pushTokens isBlocked');
    if (!user || user.isBlocked) return;

    const tokens = new Set();
    if (user.pushToken) tokens.add(user.pushToken);
    if (Array.isArray(user.pushTokens)) {
      user.pushTokens.forEach((t) => t && tokens.add(t));
    }

    const validTokens = Array.from(tokens).filter(isValidPushToken);

    if (validTokens.length === 0) return;

    const messages = validTokens.map((to) => ({
      to,
      sound: 'default',
      title: title || 'Bideo',
      body: body || '',
      data,
      priority: 'high',
      channelId: 'default',
    }));

    await sendBatchPushNotifications(messages, recipientId);
  } catch (err) {
    console.error('Push notification send error:', err?.response?.data || err?.message || err);
  }
}

/**
 * Send an array of Expo push messages in batches of up to 100 with retry and cleanup
 */
async function sendBatchPushNotifications(messages, recipientIdToClean = null) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  const CHUNK_SIZE = 100;
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(10000),
      });

      const resJson = await response.json().catch(() => null);

      if (!response.ok) {
        console.warn(`[Push Service] Expo push HTTP status ${response.status}:`, resJson?.errors || resJson);
      }

      // Clean up invalid/unregistered tokens if reported
      const tickets = resJson?.data;
      if (Array.isArray(tickets)) {
        const tokensToRemove = [];
        tickets.forEach((ticket, idx) => {
          if (ticket.status === 'error') {
            const errCode = ticket.details?.error;
            if (
              errCode === 'DeviceNotRegistered' ||
              errCode === 'ExpoPushTokenNotFound' ||
              errCode === 'InvalidCredentials'
            ) {
              const badToken = chunk[idx]?.to;
              if (badToken) tokensToRemove.push(badToken);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          if (recipientIdToClean) {
            await User.findByIdAndUpdate(recipientIdToClean, {
              $pull: { pushTokens: { $in: tokensToRemove } },
            }).catch(() => {});
          } else {
            await User.updateMany(
              {
                $or: [
                  { pushToken: { $in: tokensToRemove } },
                  { pushTokens: { $in: tokensToRemove } },
                ],
              },
              {
                $pull: { pushTokens: { $in: tokensToRemove } },
              }
            ).catch(() => {});
          }
        }
      }
    } catch (batchErr) {
      console.error('Failed to send Expo push batch:', batchErr?.message || batchErr);
    }

    // Gentle 50ms pause between chunks to respect Expo rate limits and avoid socket congestion
    if (i + CHUNK_SIZE < messages.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/**
 * Creates in-app Notification record AND sends a real mobile Push Notification
 */
async function notifyAndPush({ recipient, actor, type, video, post, comment, message, title }) {
  if (!recipient) return;
  if (actor && recipient.toString() === actor.toString() && type !== 'milestone' && type !== 'system') {
    return;
  }

  try {
    // 1. Create in-app database notification
    const notification = await Notification.create({
      recipient,
      actor: actor || null,
      type,
      video: video?._id || video || undefined,
      post: post?._id || post || undefined,
      comment: comment?._id || comment || undefined,
      message,
    });

    // 2. Fetch actor info if present
    let actorName = 'Someone';
    if (actor) {
      const actorUser = await User.findById(actor).select('name channelName avatar');
      actorName = actorUser?.channelName || actorUser?.name || 'Someone';
    }

    let pushTitle = title || 'Bideo';
    let pushBody = message || '';
    const pushData = { type };

    if (video) {
      const vidId = (video._id || video).toString();
      const isShort = video.isShort === true || video.isShort === 'true';
      pushData.videoId = vidId;
      pushData.isShort = isShort;
      pushData.screen = isShort ? `/shorts?initialShortId=${vidId}` : `/video/${vidId}`;
    }
    if (post) {
      const pId = (post._id || post).toString();
      pushData.postId = pId;
      pushData.screen = `/post/${pId}`;
    }
    if (actor) {
      pushData.channelId = actor.toString();
    }

    // Context-specific push notification titles and messages
    if (type === 'new_follower') {
      pushTitle = 'New Follower 👤';
      pushBody = `${actorName} started following your channel!`;
      pushData.screen = `/channel/${actor}`;
    } else if (type === 'video_like') {
      let videoTitle = '';
      if (video) {
        const v = video.title ? video : await Video.findById(video).select('title').lean();
        if (v?.title) {
          videoTitle = v.title.length > 30 ? `${v.title.substring(0, 30)}...` : v.title;
        }
      }
      pushBody = videoTitle
        ? `${actorName} liked your video "${videoTitle}" ❤️`
        : `${actorName} liked your video ❤️`;
    } else if (type === 'video_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      pushBody = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your video.`;
    } else if (type === 'comment_like') {
      pushBody = `${actorName} liked your comment ❤️`;
    } else if (type === 'comment_reply') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      pushBody = snippet ? `${actorName} replied: "${snippet}"` : `${actorName} replied to your comment.`;
    } else if (type === 'post_like') {
      pushBody = `${actorName} liked your post ❤️`;
    } else if (type === 'post_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      pushBody = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your post.`;
    } else if (type === 'milestone') {
      pushTitle = title || 'Milestone Reached! 🎉';
      pushBody = message || 'Congratulations on reaching a new milestone!';
    } else if (type === 'system') {
      pushTitle = title || 'Bideo Alert 🔔';
      pushBody = message || 'You have an account update.';
    }

    // 3. Dispatch real mobile push alert asynchronously
    sendPushNotification({
      recipientId: recipient,
      title: pushTitle,
      body: pushBody,
      data: pushData,
    }).catch(() => {});

    return notification;
  } catch (err) {
    console.error('Failed to notify and push:', err);
  }
}

/**
 * Send real mobile push notification for an event (without creating DB record)
 */
async function sendPushForEvent({ recipient, actor, type, video, post, comment, message, title }) {
  if (!recipient) return;
  if (actor && recipient.toString() === actor.toString() && type !== 'milestone' && type !== 'system') {
    return;
  }

  try {
    let actorName = 'Someone';
    if (actor) {
      const actorUser = await User.findById(actor).select('name channelName avatar');
      actorName = actorUser?.channelName || actorUser?.name || 'Someone';
    }

    let pushTitle = title || 'Bideo';
    let pushBody = message || '';
    const pushData = { type };

    if (video) {
      const vidId = (video._id || video).toString();
      const isShort = video.isShort === true || video.isShort === 'true';
      pushData.videoId = vidId;
      pushData.isShort = isShort;
      pushData.screen = isShort ? `/shorts?initialShortId=${vidId}` : `/video/${vidId}`;
    }
    if (post) {
      const pId = (post._id || post).toString();
      pushData.postId = pId;
      pushData.screen = `/post/${pId}`;
    }
    if (actor) {
      pushData.channelId = actor.toString();
    }

    if (type === 'new_follower') {
      pushTitle = 'New Follower 👤';
      pushBody = `${actorName} started following your channel!`;
      pushData.screen = `/channel/${actor}`;
    } else if (type === 'video_like') {
      let videoTitle = '';
      if (video) {
        const v = video.title ? video : await Video.findById(video).select('title').lean();
        if (v?.title) {
          videoTitle = v.title.length > 30 ? `${v.title.substring(0, 30)}...` : v.title;
        }
      }
      pushBody = videoTitle
        ? `${actorName} liked your video "${videoTitle}" ❤️`
        : `${actorName} liked your video ❤️`;
    } else if (type === 'video_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      pushBody = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your video.`;
    } else if (type === 'comment_like') {
      pushBody = `${actorName} liked your comment ❤️`;
    } else if (type === 'comment_reply') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      pushBody = snippet ? `${actorName} replied: "${snippet}"` : `${actorName} replied to your comment.`;
    } else if (type === 'post_like') {
      pushBody = `${actorName} liked your post ❤️`;
    } else if (type === 'post_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      pushBody = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your post.`;
    } else if (type === 'milestone') {
      pushTitle = title || 'Milestone Reached! 🎉';
      pushBody = message || 'Congratulations on reaching a new milestone!';
    } else if (type === 'system') {
      pushTitle = title || 'Bideo Alert 🔔';
      pushBody = message || 'You have an account update.';
    }

    await sendPushNotification({
      recipientId: recipient,
      title: pushTitle,
      body: pushBody,
      data: pushData,
    });
  } catch (err) {
    console.error('sendPushForEvent error:', err?.message || err);
  }
}

/**
 * Automatically notify all followers when a creator uploads a new Video or Community Post
 */
async function notifyFollowersOfUpload({ creatorId, video, post }) {
  if (!creatorId) return;

  try {
    const creator = await User.findById(creatorId).select('name channelName avatar');
    if (!creator) return;

    const creatorName = creator.channelName || creator.name || 'A creator you follow';

    // 1. Fetch all followers
    const followers = await Follower.find({ channel: creatorId }).select('follower').lean();
    const followerIds = (followers || []).map((f) => f.follower).filter(Boolean);

    // 2. Prepare in-app notification records and push payloads
    let notifType = 'video_upload';
    let notifMessage = '';
    let pushTitle = '';
    let pushBody = '';
    let pushData = {};

    if (video) {
      const isShort = video.isShort === true || video.isShort === 'true';
      const cleanTitle = video.title ? (video.title.length > 70 ? `${video.title.substring(0, 70)}...` : video.title) : 'New video';
      notifType = 'video_upload';
      notifMessage = `${cleanTitle}\n${creatorName} • ${isShort ? 'Short' : 'video'}`;
      pushTitle = cleanTitle;
      pushBody = `${creatorName} uploaded a new ${isShort ? 'Short' : 'video'}`;
      pushData = {
        type: 'video_upload',
        videoId: video._id.toString(),
        isShort,
        screen: isShort ? `/shorts?initialShortId=${video._id}` : `/video/${video._id}`,
      };
    } else if (post) {
      const cleanSnippet = post.text ? (post.text.length > 70 ? `${post.text.substring(0, 70)}...` : post.text) : 'New community post';
      notifType = 'post_upload';
      notifMessage = `${cleanSnippet}\n${creatorName} • post`;
      pushTitle = cleanSnippet;
      pushBody = `${creatorName} shared a new post`;
      pushData = {
        type: 'post_upload',
        postId: post._id.toString(),
        screen: `/post/${post._id}`,
      };
    }

    if (followerIds.length > 0) {
      // Insert in-app notifications in batch for followers
      const notificationsToInsert = followerIds.map((fId) => ({
        recipient: fId,
        actor: creatorId,
        type: notifType,
        video: video?._id || undefined,
        post: post?._id || undefined,
        message: notifMessage,
      }));

      await Notification.insertMany(notificationsToInsert, { ordered: false }).catch(() => {});

      // Batch push notifications to followers with active push tokens
      const followerUsers = await User.find({
        _id: { $in: followerIds },
        isBlocked: { $ne: true },
        $or: [
          { pushToken: { $exists: true, $nin: [null, ''] } },
          { 'pushTokens.0': { $exists: true } },
        ],
      }).select('pushToken pushTokens').lean();

      if (isQuietHours()) {
        // Night (10 PM - 8 AM IST): followers still get every upload, but the push waits until 8 AM
        await holdFollowerPushes(followerUsers.map((u) => u._id), { title: pushTitle, body: pushBody, data: pushData });
      } else {
        const pushMessages = buildPushMessages(followerUsers, { title: pushTitle, body: pushBody, data: pushData });
        if (pushMessages.length > 0) {
          await sendBatchPushNotifications(pushMessages);
        }
      }
    }

    // 3. Recommend the video to interested non-followers (queued, see enqueueRecommendation)
    enqueueRecommendation({ creatorId, video, post, followerIds });
  } catch (err) {
    console.error('Failed to notify followers of upload:', err?.message || err);
  }
}

// "Recommended for you" pushes go only to people whose watch history really matches the new
// video (no random users), best matches first, at most MAX_RECOMMENDED_PUSHES_PER_DAY (10) per
// person per India day. Posts are not recommended: there is no watch history to match them with.
const RECOMMEND = {
  maxPerUpload: parseInt(process.env.MAX_RECOMMENDED_NOTIF_COUNT, 10) || 200,
  topicVideos: 300, // most relevant videos on the same topic, used to read people's interests
  minMatches: 2, // watched at least this many of those videos
  maxKeywords: 8,
  concurrency: 2,
  maxQueued: 500,
};

/** Videos on the same topic as the upload (word search over title, tags, description) */
async function findTopicVideoIds(video) {
  const tags = Array.isArray(video.tags)
    ? video.tags.map((t) => (typeof t === 'string' ? t.toLowerCase().trim() : '')).filter(Boolean)
    : [];
  const keywords = Array.from(
    new Set([...extractKeywords(video.title || ''), ...tags, ...extractKeywords(video.description || '')])
  ).slice(0, RECOMMEND.maxKeywords);
  if (keywords.length === 0) return [];

  const found = await Video.find(
    { _id: { $ne: video._id }, visibility: 'public', $text: { $search: keywords.join(' ') } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(RECOMMEND.topicVideos)
    .select('_id')
    .lean();
  return found.map((v) => v._id);
}

// Recommendation work runs at most RECOMMEND.concurrency at a time, so a burst of uploads can't
// pile heavy queries on the database. Recommendations are optional: when the queue is full the
// extra ones are skipped (follower notifications and the uploads themselves are never affected).
const recommendationQueue = [];
let recommendationsRunning = 0;
function runNextRecommendation() {
  while (recommendationsRunning < RECOMMEND.concurrency && recommendationQueue.length > 0) {
    const job = recommendationQueue.shift();
    recommendationsRunning++;
    notifyInterestedNonFollowersOfUpload(job)
      .catch((err) => console.error('Failed to notify non-followers of upload:', err?.message || err))
      .finally(() => {
        recommendationsRunning--;
        runNextRecommendation();
      });
  }
}
function enqueueRecommendation(job) {
  if (!job?.video) return;
  if (recommendationQueue.length >= RECOMMEND.maxQueued) return;
  recommendationQueue.push(job);
  runNextRecommendation();
}

/**
 * Notify interested non-followers when a creator uploads a video.
 */
async function notifyInterestedNonFollowersOfUpload({ creatorId, video, post, followerIds = [] }) {
  if (!creatorId || !video) return;

  try {
    const creator = await User.findById(creatorId).select('name channelName').lean();
    if (!creator) return;
    const creatorName = creator.channelName || creator.name || 'A creator';

    const topicIds = await findTopicVideoIds(video);
    if (topicIds.length === 0) return;

    // 1. People who watched the most videos on this topic (followers and the creator excluded)
    const excluded = [creatorId, ...(followerIds || [])].map((id) => new mongoose.Types.ObjectId(String(id)));
    const matched = await User.aggregate([
      {
        $match: {
          watchHistory: { $in: topicIds },
          _id: { $nin: excluded },
          isBlocked: { $ne: true },
          $or: [{ pushToken: { $exists: true, $nin: [null, ''] } }, { 'pushTokens.0': { $exists: true } }],
        },
      },
      {
        $project: {
          pushToken: 1,
          pushTokens: 1,
          score: { $size: { $setIntersection: [{ $ifNull: ['$watchHistory', []] }, topicIds] } },
        },
      },
      { $match: { score: { $gte: RECOMMEND.minMatches } } },
      { $sort: { score: -1 } },
      { $limit: RECOMMEND.maxPerUpload },
    ]);
    if (matched.length === 0) return;

    // 2. Skip people who already got an upload notification from this creator in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await Notification.distinct('recipient', {
      recipient: { $in: matched.map((u) => u._id) },
      actor: creatorId,
      type: { $in: ['video_upload', 'post_upload'] },
      createdAt: { $gte: oneHourAgo },
    });
    const recentSet = new Set(recent.map(String));
    const candidates = matched.filter((u) => !recentSet.has(String(u._id)));
    if (candidates.length === 0) return;

    // 3. Message (same wording as before)
    const isShort = video.isShort === true || video.isShort === 'true';
    const cleanTitle = video.title ? (video.title.length > 70 ? `${video.title.substring(0, 70)}...` : video.title) : 'New video';
    const pushTitle = cleanTitle;
    const pushBody = `${creatorName} uploaded a new ${isShort ? 'Short' : 'video'}`;
    const pushData = {
      type: 'video_upload',
      videoId: video._id.toString(),
      isShort,
      screen: isShort ? `/shorts?initialShortId=${video._id}` : `/video/${video._id}`,
    };
    const inApp = (recipient) => ({
      recipient,
      actor: creatorId,
      type: 'video_upload',
      video: video._id,
      message: `${cleanTitle}\n${creatorName} • ${isShort ? 'Short' : 'video'}`,
    });

    // 4. Night: hold; at 8 AM each person gets only their single best match (counted then)
    if (isQuietHours()) {
      await holdRecommendationPushes(
        candidates.map((u) => ({ recipient: u._id, score: u.score, notification: inApp(u._id) })),
        { title: pushTitle, body: pushBody, data: pushData }
      );
      return;
    }

    // 5. Day: only people who still have one of today's recommendation pushes left
    const allowed = await claimRecommendationQuota(candidates.map((u) => u._id));
    const targets = candidates.filter((u) => allowed.has(String(u._id)));
    if (targets.length === 0) return;

    await Notification.insertMany(targets.map((u) => inApp(u._id)), { ordered: false }).catch(() => {});
    const pushMessages = buildPushMessages(targets, { title: pushTitle, body: pushBody, data: pushData });
    if (pushMessages.length > 0) {
      await sendBatchPushNotifications(pushMessages);
    }
  } catch (err) {
    console.error('Failed to notify non-followers of upload:', err?.message || err);
  }
}

/**
 * Check and alert creator if channel follower count crosses milestone
 */
async function checkAndNotifyFollowerMilestone({ channelId, followersCount }) {
  const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  if (!channelId || !MILESTONES.includes(followersCount)) return;

  try {
    const formatted = followersCount.toLocaleString();
    const message = `🏆 Milestone reached! Your channel has reached ${formatted} followers!`;

    await notifyAndPush({
      recipient: channelId,
      actor: null,
      type: 'milestone',
      title: 'Follower Milestone! 🏆',
      message,
    });
  } catch (err) {
    console.error('Failed to dispatch follower milestone:', err?.message || err);
  }
}

/**
 * Check and alert creator if video view count crosses milestone
 */
async function checkAndNotifyViewMilestone({ creatorId, video }) {
  const VIEW_MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  if (!creatorId || !video || !VIEW_MILESTONES.includes(video.views)) return;

  try {
    const formatted = video.views.toLocaleString();
    const cleanTitle = video.title ? `"${video.title.length > 30 ? video.title.substring(0, 30) + '...' : video.title}"` : 'Your video';
    const message = `🎉 Milestone! ${cleanTitle} has reached ${formatted} views!`;

    await notifyAndPush({
      recipient: creatorId,
      actor: null,
      type: 'milestone',
      title: `${formatted} Views! 🎉`,
      video: video._id,
      message,
    });
  } catch (err) {
    console.error('Failed to dispatch view milestone:', err?.message || err);
  }
}

module.exports = {
  sendPushNotification,
  sendBatchPushNotifications,
  buildPushMessages,
  notifyAndPush,
  sendPushForEvent,
  notifyFollowersOfUpload,
  notifyInterestedNonFollowersOfUpload,
  checkAndNotifyFollowerMilestone,
  checkAndNotifyViewMilestone,
};
