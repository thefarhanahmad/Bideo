const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const { getIO, isUserOnline, isUserInConversation } = require('../socket');
const { sendPushNotification } = require('../utils/pushNotification');
const { saveLocalFile } = require('../utils/localUpload');

/**
 * Format conversation for client consumption
 */
function formatConversation(conv, currentUserId) {
  const currentUserIdStr = currentUserId.toString();
  const isGroup = Boolean(conv.isGroup);

  const unreadMap = conv.unreadCounts instanceof Map 
    ? conv.unreadCounts 
    : new Map(Object.entries(conv.unreadCounts || {}));
  const unreadCount = unreadMap.get(currentUserIdStr) || 0;

  if (isGroup) {
    const admins = Array.isArray(conv.groupAdmins) ? conv.groupAdmins : [];
    const isAdmin = admins.some((a) => (a?._id || a)?.toString() === currentUserIdStr);
    const isCreator = (conv.groupCreator?._id || conv.groupCreator || conv.initiator)?.toString() === currentUserIdStr;

    return {
      _id: conv._id,
      isGroup: true,
      groupName: conv.groupName || 'Group',
      groupAvatar: conv.groupAvatar || null,
      groupDescription: conv.groupDescription || '',
      groupAdmins: conv.groupAdmins || [],
      groupCreator: conv.groupCreator || null,
      isAdmin,
      isCreator,
      memberCount: Array.isArray(conv.participants) ? conv.participants.length : 0,
      participants: conv.participants || [],
      initiator: conv.initiator,
      status: 'accepted',
      blockedBy: null,
      isBlockedByMe: false,
      isBlockedByOther: false,
      lastMessage: conv.lastMessage,
      unreadCount,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
    };
  }

  const otherParticipant = (conv.participants || []).find((p) => {
    const pId = (p?._id || p)?.toString();
    return pId && pId !== currentUserIdStr;
  }) || null;

  const otherId = (otherParticipant?._id || otherParticipant)?.toString() || null;

  return {
    _id: conv._id,
    isGroup: false,
    participants: conv.participants,
    otherParticipant: otherParticipant ? {
      _id: otherId,
      name: otherParticipant.name || '',
      channelName: otherParticipant.channelName || otherParticipant.name || '',
      avatar: otherParticipant.avatar || null,
      isVerified: Boolean(otherParticipant.isVerified),
      isOnline: isUserOnline(otherId),
    } : null,
    initiator: conv.initiator,
    status: conv.status,
    blockedBy: conv.blockedBy,
    isBlockedByMe: conv.status === 'blocked' && conv.blockedBy?.toString() === currentUserIdStr,
    isBlockedByOther: conv.status === 'blocked' && conv.blockedBy?.toString() !== currentUserIdStr,
    lastMessage: conv.lastMessage,
    unreadCount,
    updatedAt: conv.updatedAt,
    createdAt: conv.createdAt,
  };
}

/**
 * @desc    Get all conversations for current user
 * @route   GET /api/chat/conversations
 * @access  Private
 */
exports.getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const conversations = await Conversation.find({
      participants: currentUserId,
      deletedFor: { $ne: currentUserId },
      $or: [
        { isGroup: true },
        {
          'lastMessage.sender': { $ne: null },
          'lastMessage.text': { $exists: true, $ne: '' },
        },
      ],
    })
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar')
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = conversations.map((conv) => formatConversation(conv, currentUserId));

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get or create 1-to-1 conversation with a target user
 * @route   POST /api/chat/conversations
 * @access  Private
 */
exports.getOrCreateConversation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const currentUserId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }

    if (recipientId.toString() === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
    }

    const recipient = await User.findById(recipientId).select('_id name channelName avatar isVerified isBlocked');
    if (!recipient || recipient.isBlocked) {
      return res.status(404).json({ success: false, message: 'User not found or suspended' });
    }

    // Check if conversation already exists between these 2 users
    let conversation = await Conversation.findOne({
      isGroup: { $ne: true },
      participants: { $all: [currentUserId, recipientId], $size: 2 },
    }).populate('participants', '_id name channelName avatar isVerified');

    if (!conversation) {
      conversation = await Conversation.create({
        isGroup: false,
        participants: [currentUserId, recipientId],
        initiator: currentUserId,
        status: 'pending',
        unreadCounts: new Map([[recipientId.toString(), 0], [currentUserId.toString(), 0]]),
      });

      conversation = await Conversation.findById(conversation._id).populate(
        'participants',
        '_id name channelName avatar isVerified'
      );
    }

    res.status(200).json({
      success: true,
      data: formatConversation(conversation, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get conversation by ID
 * @route   GET /api/chat/conversations/:id
 * @access  Private
 */
exports.getConversationById = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: currentUserId,
    })
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.status(200).json({
      success: true,
      data: formatConversation(conversation, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get messages for a conversation
 * @route   GET /api/chat/conversations/:id/messages
 * @access  Private
 */
exports.getMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversationId: conversation._id,
      deletedFor: { $ne: currentUserId },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', '_id name channelName avatar')
      .populate({
        path: 'video',
        select: '_id title thumbnail duration views owner isShort',
        populate: { path: 'owner', select: '_id name channelName avatar isVerified' },
      })
      .populate({
        path: 'post',
        select: '_id text image author createdAt',
        populate: { path: 'author', select: '_id name channelName avatar isVerified' },
      })
      .lean();

    const total = await Message.countDocuments({
      conversationId: conversation._id,
      deletedFor: { $ne: currentUserId },
    });

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      hasMore: total > skip + messages.length,
      data: messages.reverse(), // Send in chronological order
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Send a message
 * @route   POST /api/chat/messages
 * @access  Private
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { conversationId, recipientId, text, videoId, postId } = req.body;
    const currentUserId = req.user._id;

    let cleanText = (text || '').trim();
    let videoDoc = null;
    let postDoc = null;

    if (videoId) {
      videoDoc = await Video.findById(videoId).populate('owner', '_id name channelName avatar isVerified');
      if (videoDoc && !cleanText) {
        cleanText = `https://bideo.in/v/${videoDoc._id}`;
      }
    } else if (postId) {
      postDoc = await Post.findById(postId).populate('author', '_id name channelName avatar isVerified');
      if (postDoc && !cleanText) {
        cleanText = `https://bideo.in/p/${postDoc._id}`;
      }
    } else if (!videoId && !postId && cleanText) {
      const videoMatch = cleanText.match(/(?:bideo\.in|bideo\.app|\/)\/(?:v|video)\/([a-fA-F0-9]{24})/i);
      if (videoMatch && videoMatch[1]) {
        videoDoc = await Video.findById(videoMatch[1]).populate('owner', '_id name channelName avatar isVerified');
      } else {
        const postMatch = cleanText.match(/(?:bideo\.in|bideo\.app|\/)\/(?:p|post)\/([a-fA-F0-9]{24})/i);
        if (postMatch && postMatch[1]) {
          postDoc = await Post.findById(postMatch[1]).populate('author', '_id name channelName avatar isVerified');
        }
      }
    }

    if (!cleanText && !videoId && !postId && !videoDoc && !postDoc) {
      return res.status(400).json({ success: false, message: 'Message text cannot be empty' });
    }

    let conversation;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        participants: currentUserId,
      }).populate('participants', '_id name channelName avatar isVerified');
    } else if (recipientId) {
      conversation = await Conversation.findOne({
        isGroup: { $ne: true },
        participants: { $all: [currentUserId, recipientId], $size: 2 },
      }).populate('participants', '_id name channelName avatar isVerified');

      if (!conversation) {
        conversation = await Conversation.create({
          isGroup: false,
          participants: [currentUserId, recipientId],
          initiator: currentUserId,
          status: 'pending',
          unreadCounts: new Map(),
        });
        conversation = await Conversation.findById(conversation._id).populate(
          'participants',
          '_id name channelName avatar isVerified'
        );
      }
    }

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Check if blocked
    if (conversation.status === 'blocked') {
      const isBlockedByOther = conversation.blockedBy && conversation.blockedBy.toString() !== currentUserId.toString();
      if (isBlockedByOther) {
        return res.status(403).json({
          success: false,
          message: 'You cannot send messages to this user because you are blocked.',
        });
      }
    }

    const isGroup = Boolean(conversation.isGroup);

    // Identify target recipient (for 1-on-1) or other participants (for group)
    const otherParticipants = (conversation.participants || []).filter(
      (p) => (p._id || p).toString() !== currentUserId.toString()
    );

    if (!isGroup && otherParticipants.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid recipient in conversation' });
    }

    const recipient = !isGroup && otherParticipants.length > 0 ? otherParticipants[0] : null;

    // Create Message record
    const message = await Message.create({
      conversationId: conversation._id,
      sender: currentUserId,
      recipient: recipient ? recipient._id : null,
      text: cleanText,
      video: videoDoc ? videoDoc._id : null,
      post: postDoc ? postDoc._id : null,
      isRead: false,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', '_id name channelName avatar isVerified')
      .populate({
        path: 'video',
        select: '_id title thumbnail duration views owner isShort',
        populate: { path: 'owner', select: '_id name channelName avatar isVerified' },
      })
      .populate({
        path: 'post',
        select: '_id text image author createdAt',
        populate: { path: 'author', select: '_id name channelName avatar isVerified' },
      })
      .lean();

    // Check if 1-on-1 recipient is active in this conversation right now
    const isRecipientViewingChat = recipient ? isUserInConversation(recipient._id, conversation._id) : false;

    // If 1-on-1 recipient is viewing the chat, message is instantly read
    if (!isGroup && isRecipientViewingChat) {
      await Message.findByIdAndUpdate(message._id, { isRead: true, readAt: new Date() });
      populatedMessage.isRead = true;
      populatedMessage.readAt = new Date();
    }

    // Update conversation lastMessage & unread count
    let previewText = cleanText;
    if (videoDoc) {
      previewText = `🎥 ${videoDoc.title || 'Video'}`;
    } else if (postDoc) {
      previewText = `📝 ${postDoc.text ? postDoc.text.slice(0, 40) : 'Shared a post'}`;
    }

    conversation.lastMessage = {
      text: previewText,
      sender: currentUserId,
      createdAt: message.createdAt,
      isRead: !isGroup ? isRecipientViewingChat : false,
    };

    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }

    if (!isGroup) {
      if (!isRecipientViewingChat && recipient) {
        const currentUnread = conversation.unreadCounts.get(recipient._id.toString()) || 0;
        conversation.unreadCounts.set(recipient._id.toString(), currentUnread + 1);
      }
    } else {
      // For groups, increment unread count for every other participant not currently viewing
      otherParticipants.forEach((p) => {
        const pIdStr = (p._id || p).toString();
        const isViewing = isUserInConversation(pIdStr, conversation._id);
        if (!isViewing) {
          const currentUnread = conversation.unreadCounts.get(pIdStr) || 0;
          conversation.unreadCounts.set(pIdStr, currentUnread + 1);
        }
      });
    }

    await conversation.save();

    // Socket.io Real-time dispatch
    const io = getIO();
    if (io) {
      // 1. Broadcast new message to conversation room and sender personal room
      io.to(`conversation:${conversation._id}`).emit('new_message', populatedMessage);
      io.to(`user:${currentUserId}`).emit('new_message', populatedMessage);

      if (!isGroup && recipient) {
        io.to(`user:${recipient._id}`).emit('new_message', populatedMessage);
        const formattedForSender = formatConversation(conversation, currentUserId);
        const formattedForRecipient = formatConversation(conversation, recipient._id);
        io.to(`user:${currentUserId}`).emit('conversation_updated', formattedForSender);
        io.to(`user:${recipient._id}`).emit('conversation_updated', formattedForRecipient);

        if (!isRecipientViewingChat) {
          const totalUnread = await exports.computeTotalUnreadCount(recipient._id);
          io.to(`user:${recipient._id}`).emit('unread_chat_count', { count: totalUnread });
        }
      } else {
        // Group broadcast to all other members
        otherParticipants.forEach(async (p) => {
          const pId = (p._id || p).toString();
          io.to(`user:${pId}`).emit('new_message', populatedMessage);
          io.to(`user:${pId}`).emit('conversation_updated', formatConversation(conversation, pId));
          const isViewing = isUserInConversation(pId, conversation._id);
          if (!isViewing) {
            const totalUnread = await exports.computeTotalUnreadCount(pId);
            io.to(`user:${pId}`).emit('unread_chat_count', { count: totalUnread });
          }
        });
        io.to(`user:${currentUserId}`).emit('conversation_updated', formatConversation(conversation, currentUserId));
      }
    }

    // Push notification logic
    if (!isGroup && recipient && !isRecipientViewingChat) {
      sendPushNotification({
        recipientId: recipient._id,
        title: req.user.channelName || req.user.name || 'New Message',
        body: text.trim(),
        data: {
          screen: `/chat/${conversation._id}`,
          conversationId: conversation._id.toString(),
          senderId: currentUserId.toString(),
        },
      }).catch((pushErr) => {
        console.error('Failed to dispatch chat push notification:', pushErr);
      });
    } else if (isGroup) {
      otherParticipants.forEach((p) => {
        const pId = (p._id || p).toString();
        const isViewing = isUserInConversation(pId, conversation._id);
        if (!isViewing) {
          sendPushNotification({
            recipientId: pId,
            title: conversation.groupName || 'Group Message',
            body: `${req.user.name || 'Member'}: ${cleanText.slice(0, 100)}`,
            data: {
              screen: `/chat/${conversation._id}`,
              conversationId: conversation._id.toString(),
              senderId: currentUserId.toString(),
              isGroup: true,
            },
          }).catch(() => {});
        }
      });
    }

    res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mark conversation messages as read
 * @route   PUT /api/chat/conversations/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    }).populate('participants', '_id name channelName avatar isVerified');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Mark messages as read in DB
    const updateFilter = conversation.isGroup
      ? { conversationId, sender: { $ne: currentUserId }, isRead: false }
      : { conversationId, recipient: currentUserId, isRead: false };

    await Message.updateMany(updateFilter, {
      $set: { isRead: true, readAt: new Date() },
    });

    // Update conversation lastMessage.isRead so conversation list displays double tick
    if (conversation.lastMessage) {
      const senderStr = (conversation.lastMessage.sender?._id || conversation.lastMessage.sender)?.toString();
      if (senderStr && senderStr !== currentUserId.toString()) {
        conversation.lastMessage.isRead = true;
      }
    }

    // Reset unread count for current user
    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }
    conversation.unreadCounts.set(currentUserId.toString(), 0);
    await conversation.save();

    // Notify other participant via socket that messages were read
    const io = getIO();
    if (io) {
      // 1. Notify conversation room (for inside chat tick update)
      io.to(`conversation:${conversationId}`).emit('messages_read', {
        conversationId,
        readBy: currentUserId,
      });

      // 2. Identify the other participant (the sender of unread messages)
      const otherParticipant = (conversation.participants || []).find(
        (p) => (p?._id || p)?.toString() !== currentUserId.toString()
      );
      const otherId = (otherParticipant?._id || otherParticipant)?.toString();

      if (otherId) {
        // Send messages_read to other user's personal room so both their chat room & chat list update ticks
        io.to(`user:${otherId}`).emit('messages_read', {
          conversationId,
          readBy: currentUserId,
        });

        const formattedForSender = formatConversation(conversation, otherId);
        io.to(`user:${otherId}`).emit('conversation_updated', formattedForSender);
      }

      // 3. Notify current user's room
      const formattedForReader = formatConversation(conversation, currentUserId);
      io.to(`user:${currentUserId.toString()}`).emit('conversation_updated', formattedForReader);

      const totalUnread = await exports.computeTotalUnreadCount(currentUserId);
      io.to(`user:${currentUserId.toString()}`).emit('unread_chat_count', { count: totalUnread });
    }

    res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Accept chat request (First message continue)
 * @route   POST /api/chat/conversations/:id/accept
 * @access  Private
 */
exports.acceptChat = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    }).populate('participants', '_id name channelName avatar isVerified');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Cannot accept a group conversation' });
    }

    conversation.status = 'accepted';
    conversation.blockedBy = null;
    // Remove from deletedFor if previously declined or dismissed
    if (conversation.deletedFor && conversation.deletedFor.length > 0) {
      conversation.deletedFor = conversation.deletedFor.filter(
        (id) => id && id.toString() !== currentUserId.toString()
      );
    }
    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'accepted',
      });
      conversation.participants.forEach((p) => {
        const pId = (p?._id || p)?.toString();
        if (pId) {
          io.to(`user:${pId}`).emit('conversation_status_changed', {
            conversationId,
            status: 'accepted',
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat accepted',
      data: formatConversation(conversation, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Block user in chat (Cannot message again)
 * @route   POST /api/chat/conversations/:id/block
 * @access  Private
 */
exports.blockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    }).populate('participants', '_id name channelName avatar isVerified');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Cannot block a group conversation' });
    }

    conversation.status = 'blocked';
    conversation.blockedBy = currentUserId;
    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'blocked',
        blockedBy: currentUserId,
      });
      conversation.participants.forEach((p) => {
        const pId = (p?._id || p)?.toString();
        if (pId) {
          io.to(`user:${pId}`).emit('conversation_status_changed', {
            conversationId,
            status: 'blocked',
            blockedBy: currentUserId,
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'User blocked',
      data: formatConversation(conversation, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Unblock user in chat
 * @route   POST /api/chat/conversations/:id/unblock
 * @access  Private
 */
exports.unblockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    }).populate('participants', '_id name channelName avatar isVerified');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Cannot unblock a group conversation' });
    }

    if (conversation.blockedBy && conversation.blockedBy.toString() !== currentUserId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the blocker can unblock this user' });
    }

    conversation.status = 'accepted';
    conversation.blockedBy = null;
    // Remove from deletedFor if previously declined or dismissed
    if (conversation.deletedFor && conversation.deletedFor.length > 0) {
      conversation.deletedFor = conversation.deletedFor.filter(
        (id) => id && id.toString() !== currentUserId.toString()
      );
    }
    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'accepted',
      });
      conversation.participants.forEach((p) => {
        const pId = (p?._id || p)?.toString();
        if (pId) {
          io.to(`user:${pId}`).emit('conversation_status_changed', {
            conversationId,
            status: 'accepted',
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'User unblocked',
      data: formatConversation(conversation, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Helper to compute total unread messages count for a user
 */
exports.computeTotalUnreadCount = async (userId) => {
  try {
    const conversations = await Conversation.find({
      participants: userId,
      deletedFor: { $ne: userId },
      'lastMessage.sender': { $ne: null },
      'lastMessage.text': { $exists: true, $ne: '' },
    }).select('unreadCounts');

    let total = 0;
    const uIdStr = userId.toString();
    conversations.forEach((conv) => {
      const map = conv.unreadCounts instanceof Map
        ? conv.unreadCounts
        : new Map(Object.entries(conv.unreadCounts || {}));
      total += (map.get(uIdStr) || 0);
    });
    return total;
  } catch {
    return 0;
  }
};

/**
 * @desc    Get total unread messages count for badge
 * @route   GET /api/chat/unread-count
 * @access  Private
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await exports.computeTotalUnreadCount(req.user._id);
    res.status(200).json({
      success: true,
      count,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Decline/reject a chat request (removes from user's active conversations)
 * @route   POST /api/chat/conversations/:id/decline
 * @access  Private
 */
exports.declineChat = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Cannot decline a group conversation' });
    }

    // Add current user to deletedFor so it disappears from inbox
    if (!conversation.deletedFor) conversation.deletedFor = [];
    if (!conversation.deletedFor.some((id) => id.toString() === currentUserId.toString())) {
      conversation.deletedFor.push(currentUserId);
    }

    // Reset unread counts for current user
    if (conversation.unreadCounts) {
      if (conversation.unreadCounts instanceof Map) {
        conversation.unreadCounts.set(currentUserId.toString(), 0);
      } else {
        conversation.unreadCounts[currentUserId.toString()] = 0;
      }
    }

    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'declined',
        declinedBy: currentUserId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat request declined',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Unsend a message (removes completely from both sides)
 * @route   POST /api/chat/messages/:id/unsend
 * @access  Private
 */
exports.unsendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Only sender can unsend
    if (message.sender.toString() !== currentUserId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only unsend your own messages' });
    }

    const conversationId = message.conversationId;
    const recipientId = message.recipient;

    // Delete message permanently from database
    await Message.findByIdAndDelete(messageId);

    // Update conversation lastMessage
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      const latestRemaining = await Message.findOne({
        conversationId,
      })
        .sort({ createdAt: -1 })
        .populate('video', 'title')
        .populate('post', 'text');

      if (latestRemaining) {
        let preview = latestRemaining.text || '';
        if (latestRemaining.video) preview = `🎥 ${latestRemaining.video.title || 'Video'}`;
        else if (latestRemaining.post) preview = `📝 ${latestRemaining.post.text ? latestRemaining.post.text.slice(0, 40) : 'Post'}`;

        conversation.lastMessage = {
          text: preview,
          sender: latestRemaining.sender,
          createdAt: latestRemaining.createdAt,
          isRead: latestRemaining.isRead,
        };
      } else {
        conversation.lastMessage = {
          text: '',
          sender: null,
          createdAt: conversation.createdAt,
          isRead: true,
        };
      }

      await conversation.save();

      // Dispatch socket events to conversation room and both users' rooms
      const io = getIO();
      if (io) {
        io.to(`conversation:${conversationId}`).emit('message_unsent', {
          messageId,
          conversationId,
        });
        io.to(`user:${currentUserId}`).emit('message_unsent', {
          messageId,
          conversationId,
        });
        io.to(`user:${recipientId}`).emit('message_unsent', {
          messageId,
          conversationId,
        });

        const formattedSender = formatConversation(conversation, currentUserId);
        const formattedRecipient = formatConversation(conversation, recipientId);
        io.to(`user:${currentUserId}`).emit('conversation_updated', formattedSender);
        io.to(`user:${recipientId}`).emit('conversation_updated', formattedRecipient);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Message unsent successfully',
      data: { messageId, conversationId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a message only for the current user
 * @route   POST /api/chat/messages/:id/delete
 * @access  Private
 */
exports.deleteMessageForMe = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Verify user is a participant
    const isParticipant =
      message.sender.toString() === currentUserId.toString() ||
      message.recipient.toString() === currentUserId.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }

    // Add user to message.deletedFor
    if (!message.deletedFor) message.deletedFor = [];
    if (!message.deletedFor.some((id) => id.toString() === currentUserId.toString())) {
      message.deletedFor.push(currentUserId);
      await message.save();
    }

    const io = getIO();
    if (io) {
      io.to(`user:${currentUserId}`).emit('message_deleted_for_me', {
        messageId,
        conversationId: message.conversationId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted for you',
      data: { messageId, conversationId: message.conversationId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get contacts eligible to be added to a group (accepted, non-blocked 1-on-1 chats)
 * @route   GET /api/chat/eligible-contacts
 * @access  Private
 */
exports.getEligibleContacts = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Find all 1-on-1 conversations where status is 'accepted'
    // Exclude conversations where current user blocked the other or vice-versa
    const conversations = await Conversation.find({
      isGroup: { $ne: true },
      participants: currentUserId,
      status: 'accepted',
      blockedBy: { $ne: currentUserId },
    })
      .populate('participants', '_id name channelName avatar isVerified isBlocked')
      .sort({ updatedAt: -1 })
      .lean();

    const contactMap = new Map();
    conversations.forEach((conv) => {
      const other = (conv.participants || []).find(
        (p) => p && p._id && p._id.toString() !== currentUserId.toString()
      );
      if (other && !other.isBlocked && !contactMap.has(other._id.toString())) {
        contactMap.set(other._id.toString(), {
          _id: other._id,
          name: other.name || '',
          channelName: other.channelName || other.name || '',
          avatar: other.avatar || null,
          isVerified: Boolean(other.isVerified),
        });
      }
    });

    const contacts = Array.from(contactMap.values());
    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new group conversation
 * @route   POST /api/chat/groups
 * @access  Private
 */
exports.createGroup = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { name, description, memberIds: rawMemberIds } = req.body;

    const trimmedName = String(name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ success: false, message: 'Group name must be at least 2 characters long' });
    }
    if (trimmedName.length > 60) {
      return res.status(400).json({ success: false, message: 'Group name cannot exceed 60 characters' });
    }

    let memberIds = [];
    if (Array.isArray(rawMemberIds)) {
      memberIds = rawMemberIds.map((id) => id?.toString()).filter(Boolean);
    } else if (typeof rawMemberIds === 'string') {
      try {
        const parsed = JSON.parse(rawMemberIds);
        if (Array.isArray(parsed)) memberIds = parsed.map((id) => id?.toString()).filter(Boolean);
      } catch {
        memberIds = rawMemberIds.split(',').map((id) => id.trim()).filter(Boolean);
      }
    }

    memberIds = Array.from(new Set(memberIds.filter((id) => id !== currentUserId.toString())));

    if (memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least 1 member to add to the group' });
    }

    // Verify all memberIds are in creator's eligible contacts (accepted and not blocked by creator)
    const eligibleConvs = await Conversation.find({
      isGroup: { $ne: true },
      participants: { $all: [currentUserId] },
      status: 'accepted',
      blockedBy: { $ne: currentUserId },
    }).select('participants').lean();

    const allowedUserIds = new Set();
    eligibleConvs.forEach((c) => {
      (c.participants || []).forEach((p) => {
        const pId = p.toString();
        if (pId !== currentUserId.toString()) {
          allowedUserIds.add(pId);
        }
      });
    });

    const validMemberIds = memberIds.filter((id) => allowedUserIds.has(id));
    if (validMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'None of the selected members are eligible to be added. You can only add users you have actively chatted and connected with.',
      });
    }

    let groupAvatar = null;
    if (req.file) {
      const uploadRes = await saveLocalFile(req, req.file, 'image');
      if (uploadRes && uploadRes.url) {
        groupAvatar = uploadRes.url;
      }
    } else if (req.body.avatar) {
      groupAvatar = req.body.avatar;
    }

    const allParticipants = [currentUserId, ...validMemberIds];

    const group = await Conversation.create({
      isGroup: true,
      groupName: trimmedName,
      groupAvatar,
      groupDescription: String(description || '').trim().slice(0, 300),
      initiator: currentUserId,
      groupCreator: currentUserId,
      groupAdmins: [currentUserId],
      participants: allParticipants,
      status: 'accepted',
      lastMessage: {
        text: `Group "${trimmedName}" created`,
        sender: currentUserId,
        createdAt: new Date(),
        isRead: false,
      },
    });

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar')
      .lean();

    const io = getIO();
    if (io) {
      allParticipants.forEach((pId) => {
        const idStr = pId.toString();
        io.to(`user:${idStr}`).emit('conversation_updated', formatConversation(populatedGroup, idStr));
      });
    }

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: formatConversation(populatedGroup, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Add new members to an existing group
 * @route   PUT /api/chat/groups/:id/members
 * @access  Private
 */
exports.addGroupMembers = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;
    const { memberIds: rawMemberIds } = req.body;

    const group = await Conversation.findOne({ _id: conversationId, isGroup: true });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if requester is admin of this group
    const isAdmin = (group.groupAdmins || []).some(
      (a) => a.toString() === currentUserId.toString()
    );
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only group admins can add members' });
    }

    let memberIds = [];
    if (Array.isArray(rawMemberIds)) {
      memberIds = rawMemberIds.map((id) => id?.toString()).filter(Boolean);
    } else if (typeof rawMemberIds === 'string') {
      try {
        memberIds = JSON.parse(rawMemberIds);
      } catch {
        memberIds = rawMemberIds.split(',').map((id) => id.trim()).filter(Boolean);
      }
    }

    // Filter out users already in the group
    const existingParticipantSet = new Set(group.participants.map((p) => p.toString()));
    const newMemberIds = memberIds.filter((id) => !existingParticipantSet.has(id));

    if (newMemberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'All selected members are already in the group' });
    }

    // Validate that new members are in THIS admin's eligible contacts (accepted and not blocked by THIS admin)
    const eligibleConvs = await Conversation.find({
      isGroup: { $ne: true },
      participants: { $all: [currentUserId] },
      status: 'accepted',
      blockedBy: { $ne: currentUserId },
    }).select('participants').lean();

    const allowedUserIds = new Set();
    eligibleConvs.forEach((c) => {
      (c.participants || []).forEach((p) => {
        const pId = p.toString();
        if (pId !== currentUserId.toString()) {
          allowedUserIds.add(pId);
        }
      });
    });

    const validNewMembers = newMemberIds.filter((id) => allowedUserIds.has(id));
    if (validNewMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add users who you have blocked or have not accepted chat requests with.',
      });
    }

    // Add to participants
    group.participants.push(...validNewMembers);

    // Fetch names of added members
    const addedUsers = await User.find({ _id: { $in: validNewMembers } }).select('name').lean();
    const addedNames = addedUsers.map((u) => u.name || 'User').join(', ');
    const adminUser = await User.findById(currentUserId).select('name').lean();

    const systemText = `${adminUser?.name || 'Admin'} added ${addedNames}`;
    group.lastMessage = {
      text: systemText,
      sender: currentUserId,
      createdAt: new Date(),
      isRead: false,
    };
    group.updatedAt = new Date();
    await group.save();

    // Create system message record
    const systemMsg = await Message.create({
      conversationId: group._id,
      sender: currentUserId,
      recipient: null,
      text: systemText,
    });
    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate('sender', '_id name channelName avatar isVerified')
      .lean();

    const updatedGroup = await Conversation.findById(group._id)
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar')
      .lean();

    const io = getIO();
    if (io) {
      io.to(`conversation:${group._id}`).emit('new_message', populatedSystemMsg);
      io.to(`conversation:${group._id}`).emit('group_members_updated', formatConversation(updatedGroup, currentUserId));
      group.participants.forEach((pId) => {
        const idStr = pId.toString();
        io.to(`user:${idStr}`).emit('conversation_updated', formatConversation(updatedGroup, idStr));
        io.to(`user:${idStr}`).emit('new_message', populatedSystemMsg);
      });
    }

    res.status(200).json({
      success: true,
      message: `${validNewMembers.length} member(s) added successfully`,
      data: formatConversation(updatedGroup, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Remove member from group OR leave group
 * @route   DELETE /api/chat/groups/:id/members/:memberId
 * @access  Private
 */
exports.removeGroupMember = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;
    const targetMemberId = req.params.memberId;

    const group = await Conversation.findOne({ _id: conversationId, isGroup: true });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isSelfLeaving = targetMemberId.toString() === currentUserId.toString();
    const isAdmin = (group.groupAdmins || []).some((a) => a.toString() === currentUserId.toString());
    const isCreator = (group.groupCreator || group.initiator)?.toString() === currentUserId.toString();

    if (!isSelfLeaving) {
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Only group admins can remove members' });
      }
      // Cannot remove group creator unless requester is creator
      const targetIsCreator = (group.groupCreator || group.initiator)?.toString() === targetMemberId.toString();
      if (targetIsCreator && !isCreator) {
        return res.status(403).json({ success: false, message: 'Cannot remove the group creator' });
      }
    }

    // Remove target from participants and admins
    group.participants = group.participants.filter((p) => p.toString() !== targetMemberId.toString());
    group.groupAdmins = group.groupAdmins.filter((a) => a.toString() !== targetMemberId.toString());

    // If no participants left, delete group
    if (group.participants.length === 0) {
      await group.deleteOne();
      await Message.deleteMany({ conversationId: group._id });
      return res.status(200).json({ success: true, message: 'Group deleted as all members left' });
    }

    // If leaving member was the last admin, assign the oldest remaining member as admin
    if (group.groupAdmins.length === 0 && group.participants.length > 0) {
      group.groupAdmins.push(group.participants[0]);
    }

    const targetUser = await User.findById(targetMemberId).select('name').lean();
    const actorUser = await User.findById(currentUserId).select('name').lean();
    const systemText = isSelfLeaving
      ? `${targetUser?.name || 'Member'} left the group`
      : `${actorUser?.name || 'Admin'} removed ${targetUser?.name || 'Member'}`;

    group.lastMessage = {
      text: systemText,
      sender: currentUserId,
      createdAt: new Date(),
      isRead: false,
    };
    group.updatedAt = new Date();
    await group.save();

    const systemMsg = await Message.create({
      conversationId: group._id,
      sender: currentUserId,
      recipient: null,
      text: systemText,
    });
    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate('sender', '_id name channelName avatar isVerified')
      .lean();

    const updatedGroup = await Conversation.findById(group._id)
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar')
      .lean();

    const io = getIO();
    if (io) {
      io.to(`conversation:${group._id}`).emit('new_message', populatedSystemMsg);
      io.to(`conversation:${group._id}`).emit('group_members_updated', formatConversation(updatedGroup, currentUserId));
      io.to(`user:${targetMemberId}`).emit('conversation_removed', { conversationId: group._id });
      group.participants.forEach((pId) => {
        const idStr = pId.toString();
        io.to(`user:${idStr}`).emit('conversation_updated', formatConversation(updatedGroup, idStr));
        io.to(`user:${idStr}`).emit('new_message', populatedSystemMsg);
      });
    }

    res.status(200).json({
      success: true,
      message: isSelfLeaving ? 'You left the group' : 'Member removed from group',
      data: formatConversation(updatedGroup, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Promote or demote group admin
 * @route   PUT /api/chat/groups/:id/admins
 * @access  Private
 */
exports.updateGroupAdminRole = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;
    const { targetUserId, action } = req.body;

    if (!targetUserId || !['promote', 'demote'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be promote or demote' });
    }

    const group = await Conversation.findOne({ _id: conversationId, isGroup: true });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isAdmin = (group.groupAdmins || []).some((a) => a.toString() === currentUserId.toString());
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only group admins can manage roles' });
    }

    const isCreator = (group.groupCreator || group.initiator)?.toString() === currentUserId.toString();
    const targetIsCreator = (group.groupCreator || group.initiator)?.toString() === targetUserId.toString();

    if (action === 'demote') {
      if (targetIsCreator) {
        return res.status(403).json({ success: false, message: 'Cannot demote the group creator' });
      }
      if (!isCreator && group.groupAdmins.length <= 1) {
        return res.status(400).json({ success: false, message: 'Group must have at least one admin' });
      }
      group.groupAdmins = group.groupAdmins.filter((a) => a.toString() !== targetUserId.toString());
    } else if (action === 'promote') {
      const alreadyAdmin = group.groupAdmins.some((a) => a.toString() === targetUserId.toString());
      if (!alreadyAdmin) {
        group.groupAdmins.push(targetUserId);
      }
    }

    group.updatedAt = new Date();
    await group.save();

    const targetUser = await User.findById(targetUserId).select('name').lean();
    const actorUser = await User.findById(currentUserId).select('name').lean();
    const systemText = action === 'promote'
      ? `${actorUser?.name || 'Admin'} made ${targetUser?.name || 'User'} a group admin`
      : `${actorUser?.name || 'Admin'} dismissed ${targetUser?.name || 'User'} as admin`;

    const systemMsg = await Message.create({
      conversationId: group._id,
      sender: currentUserId,
      recipient: null,
      text: systemText,
    });
    const populatedSystemMsg = await Message.findById(systemMsg._id)
      .populate('sender', '_id name channelName avatar isVerified')
      .lean();

    const updatedGroup = await Conversation.findById(group._id)
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar')
      .lean();

    const io = getIO();
    if (io) {
      io.to(`conversation:${group._id}`).emit('new_message', populatedSystemMsg);
      io.to(`conversation:${group._id}`).emit('group_members_updated', formatConversation(updatedGroup, currentUserId));
      group.participants.forEach((pId) => {
        const idStr = pId.toString();
        io.to(`user:${idStr}`).emit('conversation_updated', formatConversation(updatedGroup, idStr));
        io.to(`user:${idStr}`).emit('new_message', populatedSystemMsg);
      });
    }

    res.status(200).json({
      success: true,
      message: action === 'promote' ? 'Member promoted to Admin' : 'Admin role removed',
      data: formatConversation(updatedGroup, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update group details (name, description, avatar)
 * @route   PUT /api/chat/groups/:id
 * @access  Private
 */
exports.updateGroupDetails = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;
    const { name, description } = req.body;

    const group = await Conversation.findOne({ _id: conversationId, isGroup: true });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isAdmin = (group.groupAdmins || []).some((a) => a.toString() === currentUserId.toString());
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only group admins can edit group details' });
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2 || trimmed.length > 60) {
        return res.status(400).json({ success: false, message: 'Group name must be between 2 and 60 characters' });
      }
      group.groupName = trimmed;
    }

    if (description !== undefined) {
      group.groupDescription = String(description).trim().slice(0, 300);
    }

    if (req.file) {
      const uploadRes = await saveLocalFile(req, req.file, 'image');
      if (uploadRes && uploadRes.url) {
        group.groupAvatar = uploadRes.url;
      }
    } else if (req.body.avatar !== undefined) {
      group.groupAvatar = req.body.avatar;
    }

    group.updatedAt = new Date();
    await group.save();

    const updatedGroup = await Conversation.findById(group._id)
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('groupAdmins', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName avatar')
      .lean();

    const io = getIO();
    if (io) {
      io.to(`conversation:${group._id}`).emit('group_details_updated', formatConversation(updatedGroup, currentUserId));
      group.participants.forEach((pId) => {
        io.to(`user:${pId.toString()}`).emit('conversation_updated', formatConversation(updatedGroup, pId.toString()));
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group details updated',
      data: formatConversation(updatedGroup, currentUserId),
    });
  } catch (err) {
    next(err);
  }
};

