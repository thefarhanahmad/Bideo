const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let ioInstance = null;

// Memory stores for online presence and active screens
// userId (string) -> Set of socket IDs
const onlineUsers = new Map();
// socketId -> userId (string)
const socketToUser = new Map();
// socketId -> Set of conversation IDs currently opened by this socket
const socketConversations = new Map();

function initSocket(server) {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://192.168.3.107:5173",
    "exp://192.168.3.107:8081",
    "https://bideo-t.netlify.app",
    "https://bideo.in",
    "https://www.bideo.in",
  ];

  ioInstance = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://') || origin.startsWith('https://')) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // JWT Authentication Middleware for Sockets
  ioInstance.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
      const user = await User.findById(decoded.id).select('_id name channelName avatar isBlocked');

      if (!user || user.isBlocked) {
        return next(new Error('User unauthorized or suspended'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired authentication token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.userId;
    socketToUser.set(socket.id, userId);

    // Track online user
    const userSockets = onlineUsers.get(userId) || new Set();
    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);
    onlineUsers.set(userId, userSockets);

    // Join personal user room for targeted notifications/events
    socket.join(`user:${userId}`);

    // If user just transitioned to online, broadcast to other connected users
    if (wasOffline) {
      socket.broadcast.emit('user_status', {
        userId,
        isOnline: true,
      });
    }

    // Client requests status of specific user IDs (e.g. on opening chat list or chat room)
    socket.on('check_online_users', (userIds, callback) => {
      if (!Array.isArray(userIds)) return;
      const statusMap = {};
      userIds.forEach((id) => {
        if (id) {
          const sId = id.toString();
          statusMap[sId] = onlineUsers.has(sId) && onlineUsers.get(sId).size > 0;
        }
      });
      if (typeof callback === 'function') {
        callback(statusMap);
      } else {
        socket.emit('online_users_status', statusMap);
      }
    });

    // When client enters a conversation screen
    socket.on('join_conversation', (payload) => {
      const convId = (typeof payload === 'object' ? payload?.conversationId : payload)?.toString();
      if (!convId) return;
      socket.join(`conversation:${convId}`);

      let convSet = socketConversations.get(socket.id);
      if (!convSet) {
        convSet = new Set();
        socketConversations.set(socket.id, convSet);
      }
      convSet.add(convId);
    });

    // When client leaves a conversation screen
    socket.on('leave_conversation', (payload) => {
      const convId = (typeof payload === 'object' ? payload?.conversationId : payload)?.toString();
      if (!convId) return;
      socket.leave(`conversation:${convId}`);

      const convSet = socketConversations.get(socket.id);
      if (convSet) {
        convSet.delete(convId);
      }
    });

    // Typing indicators
    socket.on('typing', ({ conversationId, recipientId, isTyping }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        senderId: userId,
        isTyping: Boolean(isTyping),
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      socketToUser.delete(socket.id);
      socketConversations.delete(socket.id);

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline event
          socket.broadcast.emit('user_status', {
            userId,
            isOnline: false,
            lastSeen: new Date(),
          });
        }
      }
    });
  });

  console.log('✅ Socket.io initialized successfully for real-time chat');
  return ioInstance;
}

function getIO() {
  return ioInstance;
}

/**
 * Check if a user currently has active socket connections
 */
function isUserOnline(userId) {
  if (!userId) return false;
  const idStr = userId.toString();
  return onlineUsers.has(idStr) && onlineUsers.get(idStr).size > 0;
}

/**
 * Check if a user is currently active inside a specific conversation screen
 */
function isUserInConversation(userId, conversationId) {
  if (!userId || !conversationId) return false;
  const idStr = userId.toString();
  const convIdStr = conversationId.toString();

  const userSockets = onlineUsers.get(idStr);
  if (!userSockets || userSockets.size === 0) return false;

  // 1. Direct Socket.IO room adapter check (most accurate source of truth)
  if (ioInstance && ioInstance.sockets && ioInstance.sockets.adapter) {
    const room = ioInstance.sockets.adapter.rooms.get(`conversation:${convIdStr}`);
    if (room && room.size > 0) {
      for (const socketId of userSockets) {
        if (room.has(socketId)) {
          return true;
        }
      }
    }
  }

  // 2. Active conversations Map check
  for (const socketId of userSockets) {
    const activeConvs = socketConversations.get(socketId);
    if (activeConvs && activeConvs.has(convIdStr)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  initSocket,
  getIO,
  isUserOnline,
  isUserInConversation,
};
