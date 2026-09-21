const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const { getIO, isUserOnline, isUserInConversation } = require('../socket');
const { sendPushNotification } = require('../utils/pushNotification');

/**
 * Format conversation for client consumption
 */
function formatConversation(conv, currentUserId) {
  const currentUserIdStr = currentUserId.toString();
  const otherParticipant = (conv.participants || []).find((p) => {
    const pId = (p?._id || p)?.toString();
    return pId && pId !== currentUserIdStr;
  }) || null;

  const unreadMap = conv.unreadCounts instanceof Map 
    ? conv.unreadCounts 
    : new Map(Object.entries(conv.unreadCounts || {}));
  const unreadCount = unreadMap.get(currentUserIdStr) || 0;

  const otherId = (otherParticipant?._id || otherParticipant)?.toString() || null;

  return {
    _id: conv._id,
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
      'lastMessage.sender': { $ne: null },
      'lastMessage.text': { $exists: true, $ne: '' },
    })
      .populate('participants', '_id name channelName avatar isVerified')
      .populate('lastMessage.sender', '_id name channelName')
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
      participants: { $all: [currentUserId, recipientId], $size: 2 },
    }).populate('participants', '_id name channelName avatar isVerified');

    if (!conversation) {
      conversation = await Conversation.create({
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
    }).populate('participants', '_id name channelName avatar isVerified');

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

    const messages = await Message.find({ conversationId: conversation._id })
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

    const total = await Message.countDocuments({ conversationId: conversation._id });

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
        participants: { $all: [currentUserId, recipientId], $size: 2 },
      }).populate('participants', '_id name channelName avatar isVerified');

      if (!conversation) {
        conversation = await Conversation.create({
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

    // Identify target recipient
    const recipient = conversation.participants.find(
      (p) => p._id.toString() !== currentUserId.toString()
    );

    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Invalid recipient in conversation' });
    }

    // Create Message record
    const message = await Message.create({
      conversationId: conversation._id,
      sender: currentUserId,
      recipient: recipient._id,
      text: cleanText,
      video: videoDoc ? videoDoc._id : null,
      post: postDoc ? postDoc._id : null,
      isRead: false,
    });

    const populatedMessage = await Message.findById(message._id)
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

    // Check if recipient is active in this conversation right now
    const isRecipientViewingChat = isUserInConversation(recipient._id, conversation._id);

    // If recipient is viewing the chat, message is instantly read
    if (isRecipientViewingChat) {
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
      isRead: isRecipientViewingChat,
    };

    if (!conversation.unreadCounts) {
      conversation.unreadCounts = new Map();
    }

    if (!isRecipientViewingChat) {
      const currentUnread = conversation.unreadCounts.get(recipient._id.toString()) || 0;
      conversation.unreadCounts.set(recipient._id.toString(), currentUnread + 1);
    }

    await conversation.save();

    // Socket.io Real-time dispatch
    const io = getIO();
    if (io) {
      // 1. Broadcast new message to conversation room and directly to both users' personal rooms
      io.to(`conversation:${conversation._id}`).emit('new_message', populatedMessage);
      io.to(`user:${recipient._id}`).emit('new_message', populatedMessage);
      io.to(`user:${currentUserId}`).emit('new_message', populatedMessage);

      // 2. Broadcast conversation updated event to both users' personal rooms
      const formattedForSender = formatConversation(conversation, currentUserId);
      const formattedForRecipient = formatConversation(conversation, recipient._id);

      io.to(`user:${currentUserId}`).emit('conversation_updated', formattedForSender);
      io.to(`user:${recipient._id}`).emit('conversation_updated', formattedForRecipient);

      // 3. Emit badge update to recipient if not viewing
      if (!isRecipientViewingChat) {
        const totalUnread = await exports.computeTotalUnreadCount(recipient._id);
        io.to(`user:${recipient._id}`).emit('unread_chat_count', { count: totalUnread });
      }
    }

    // Push notification logic: ONLY if recipient is NOT actively in the chat screen
    if (!isRecipientViewingChat) {
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
    await Message.updateMany(
      {
        conversationId,
        recipient: currentUserId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      }
    );

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

    conversation.status = 'accepted';
    conversation.blockedBy = null;
    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'accepted',
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

    if (conversation.blockedBy && conversation.blockedBy.toString() !== currentUserId.toString()) {
      return res.status(403).json({ success: false, message: 'Only the blocker can unblock this user' });
    }

    conversation.status = 'accepted';
    conversation.blockedBy = null;
    await conversation.save();

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_status_changed', {
        conversationId,
        status: 'accepted',
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
