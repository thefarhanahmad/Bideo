const axios = require('axios');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification to a user via Expo Push Service (delivered via FCM v1 on Android)
 * @param {Object} options
 * @param {string|ObjectId} options.recipientId - Recipient user ID
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} [options.data] - Custom data payload (e.g. videoId, screen)
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

    // Filter valid Expo push tokens
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

    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    });

    // Cleanup expired tokens if Expo reports DeviceNotRegistered
    const tickets = response.data?.data;
    if (Array.isArray(tickets)) {
      const tokensToRemove = [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          tokensToRemove.push(validTokens[idx]);
        }
      });

      if (tokensToRemove.length > 0) {
        await User.findByIdAndUpdate(recipientId, {
          $pull: { pushTokens: { $in: tokensToRemove } },
          ...(tokensToRemove.includes(user.pushToken) ? { pushToken: null } : {}),
        });
      }
    }
  } catch (err) {
    console.error('Push notification send error:', err?.response?.data || err?.message || err);
  }
}

/**
 * Creates in-app Notification record AND sends a real mobile Push Notification
 */
async function notifyAndPush({ recipient, actor, type, video, post, comment, message }) {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;

  try {
    // 1. Create in-app database notification
    const notification = await Notification.create({
      recipient,
      actor,
      type,
      video,
      post,
      comment,
      message,
    });

    // 2. Fetch actor info to build friendly title/body
    const actorUser = await User.findById(actor).select('name channelName avatar');
    const actorName = actorUser?.channelName || actorUser?.name || 'Someone';

    let title = 'Bideo';
    let body = '';
    const pushData = { type };

    if (video) {
      pushData.videoId = video.toString();
    }
    if (post) {
      pushData.postId = post.toString();
    }

    // Build context-specific message
    if (type === 'video_like') {
      let videoTitle = '';
      if (video) {
        const v = await Video.findById(video).select('title').lean();
        if (v?.title) {
          videoTitle = v.title.length > 30 ? `${v.title.substring(0, 30)}...` : v.title;
        }
      }
      body = videoTitle
        ? `${actorName} liked your video "${videoTitle}" ❤️`
        : `${actorName} liked your video ❤️`;
    } else if (type === 'video_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      body = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your video.`;
    } else if (type === 'comment_like') {
      body = `${actorName} liked your comment ❤️`;
    } else if (type === 'comment_reply') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      body = snippet ? `${actorName} replied: "${snippet}"` : `${actorName} replied to your comment.`;
    } else if (type === 'post_like') {
      body = `${actorName} liked your post ❤️`;
    } else if (type === 'post_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      body = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your post.`;
    } else {
      body = message || `${actorName} interacted with your content.`;
    }

    // 3. Dispatch real mobile push alert asynchronously
    sendPushNotification({
      recipientId: recipient,
      title,
      body,
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
async function sendPushForEvent({ recipient, actor, type, video, post, comment, message }) {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;

  try {
    const actorUser = await User.findById(actor).select('name channelName avatar');
    const actorName = actorUser?.channelName || actorUser?.name || 'Someone';

    let title = 'Bideo';
    let body = '';
    const pushData = { type };

    if (video) {
      pushData.videoId = video.toString();
    }
    if (post) {
      pushData.postId = post.toString();
    }

    if (type === 'video_like') {
      let videoTitle = '';
      if (video) {
        const v = await Video.findById(video).select('title').lean();
        if (v?.title) {
          videoTitle = v.title.length > 30 ? `${v.title.substring(0, 30)}...` : v.title;
        }
      }
      body = videoTitle
        ? `${actorName} liked your video "${videoTitle}" ❤️`
        : `${actorName} liked your video ❤️`;
    } else if (type === 'video_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      body = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your video.`;
    } else if (type === 'comment_like') {
      body = `${actorName} liked your comment ❤️`;
    } else if (type === 'comment_reply') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      body = snippet ? `${actorName} replied: "${snippet}"` : `${actorName} replied to your comment.`;
    } else if (type === 'post_like') {
      body = `${actorName} liked your post ❤️`;
    } else if (type === 'post_comment') {
      const snippet = message ? (message.length > 50 ? `${message.substring(0, 50)}...` : message) : '';
      body = snippet ? `${actorName} commented: "${snippet}"` : `${actorName} commented on your post.`;
    } else {
      body = message || `${actorName} interacted with your content.`;
    }

    await sendPushNotification({
      recipientId: recipient,
      title,
      body,
      data: pushData,
    });
  } catch (err) {
    console.error('sendPushForEvent error:', err?.message || err);
  }
}

module.exports = {
  sendPushNotification,
  notifyAndPush,
  sendPushForEvent,
};
