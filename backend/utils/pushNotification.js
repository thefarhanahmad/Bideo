const User = require('../models/User');
const Notification = require('../models/Notification');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follower = require('../models/Follower');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

    const validTokens = Array.from(tokens).filter(
      (t) => typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
    );

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
 * Send an array of Expo push messages in batches of up to 100
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

      // Clean up invalid/unregistered tokens if reported
      const tickets = resJson?.data;
      if (Array.isArray(tickets) && recipientIdToClean) {
        const tokensToRemove = [];
        tickets.forEach((ticket, idx) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            tokensToRemove.push(chunk[idx]?.to);
          }
        });

        if (tokensToRemove.length > 0) {
          await User.findByIdAndUpdate(recipientIdToClean, {
            $pull: { pushTokens: { $in: tokensToRemove } },
          }).catch(() => {});
        }
      }
    } catch (batchErr) {
      console.error('Failed to send Expo push batch:', batchErr?.message || batchErr);
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
    if (!followers || followers.length === 0) return;

    const followerIds = followers.map((f) => f.follower).filter(Boolean);
    if (followerIds.length === 0) return;

    // 2. Prepare in-app notification records
    let notifType = 'video_upload';
    let notifMessage = '';
    let pushTitle = '';
    let pushBody = '';
    let pushData = {};

    if (video) {
      const isShort = video.isShort === true || video.isShort === 'true';
      const cleanTitle = video.title ? (video.title.length > 40 ? `${video.title.substring(0, 40)}...` : video.title) : 'a new video';
      notifType = 'video_upload';
      notifMessage = `${creatorName} uploaded a new ${isShort ? 'Short' : 'video'}: "${cleanTitle}"`;
      pushTitle = `🎬 ${creatorName}`;
      pushBody = `Uploaded: "${cleanTitle}"`;
      pushData = {
        type: 'video_upload',
        videoId: video._id.toString(),
        isShort,
        screen: isShort ? `/shorts?initialShortId=${video._id}` : `/video/${video._id}`,
      };
    } else if (post) {
      const cleanSnippet = post.text ? (post.text.length > 50 ? `${post.text.substring(0, 50)}...` : post.text) : 'Shared a new post';
      notifType = 'post_upload';
      notifMessage = `${creatorName} shared a new community post`;
      pushTitle = `📝 ${creatorName}`;
      pushBody = cleanSnippet;
      pushData = {
        type: 'post_upload',
        postId: post._id.toString(),
        screen: `/post/${post._id}`,
      };
    }

    // Insert in-app notifications in batch
    const notificationsToInsert = followerIds.map((fId) => ({
      recipient: fId,
      actor: creatorId,
      type: notifType,
      video: video?._id || undefined,
      post: post?._id || undefined,
      message: notifMessage,
    }));

    await Notification.insertMany(notificationsToInsert, { ordered: false }).catch(() => {});

    // 3. Batch push notifications to followers with active push tokens
    const followerUsers = await User.find({
      _id: { $in: followerIds },
      isBlocked: { $ne: true },
      $or: [
        { pushToken: { $exists: true, $ne: null } },
        { 'pushTokens.0': { $exists: true } },
      ],
    }).select('pushToken pushTokens').lean();

    const pushMessages = [];
    followerUsers.forEach((u) => {
      const tokens = new Set();
      if (u.pushToken) tokens.add(u.pushToken);
      if (Array.isArray(u.pushTokens)) {
        u.pushTokens.forEach((t) => t && tokens.add(t));
      }
      tokens.forEach((to) => {
        if (typeof to === 'string' && (to.startsWith('ExponentPushToken[') || to.startsWith('ExpoPushToken['))) {
          pushMessages.push({
            to,
            sound: 'default',
            title: pushTitle,
            body: pushBody,
            data: pushData,
            priority: 'high',
            channelId: 'default',
          });
        }
      });
    });

    if (pushMessages.length > 0) {
      await sendBatchPushNotifications(pushMessages);
    }
  } catch (err) {
    console.error('Failed to notify followers of upload:', err?.message || err);
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
  notifyAndPush,
  sendPushForEvent,
  notifyFollowersOfUpload,
  checkAndNotifyFollowerMilestone,
  checkAndNotifyViewMilestone,
};
