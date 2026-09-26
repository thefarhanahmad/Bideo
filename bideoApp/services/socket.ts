import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import api from './api';

let socket: Socket | null = null;
let currentToken: string | null = null;
let isConnecting = false;
let activeConversationId: string | null = null;
const pendingOnlineUserIds = new Set<string>();

export const getSocketUrl = (): string => {
  const apiBase = api.defaults.baseURL || process.env.EXPO_PUBLIC_API_URL || 'https://bideo.in/api';
  return apiBase.replace(/\/api\/?$/, '');
};

export const initSocket = async (tokenOverride?: string): Promise<Socket | null> => {
  try {
    const token = tokenOverride || (await AsyncStorage.getItem('token'));
    if (!token) {
      disconnectSocket();
      return null;
    }

    if (socket && socket.connected && currentToken === token) {
      return socket;
    }

    if (isConnecting) {
      return socket;
    }

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    const socketUrl = getSocketUrl();
    currentToken = token;
    isConnecting = true;

    socket = io(socketUrl, {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      timeout: 15000,
    });

    socket.on('connect', () => {
      isConnecting = false;
      console.log('⚡ Socket connected successfully to:', socketUrl);

      // Re-join active conversation screen if open
      if (activeConversationId) {
        socket?.emit('join_conversation', { conversationId: activeConversationId });
      }

      // Flush pending presence queries
      flushPendingOnlineStatus();

      DeviceEventEmitter.emit('socketConnected');
    });

    socket.on('connect_error', (err) => {
      isConnecting = false;
      console.log('Socket connect error:', err?.message || err);
    });

    // Real-time events from server
    socket.on('new_message', (message) => {
      DeviceEventEmitter.emit('chatMessageReceived', message);
    });

    socket.on('conversation_updated', (conversation) => {
      DeviceEventEmitter.emit('chatConversationUpdated', conversation);
    });

    socket.on('unread_chat_count', (data) => {
      DeviceEventEmitter.emit('chatUnreadCountUpdated', data?.count ?? 0);
    });

    socket.on('user_status', (data) => {
      DeviceEventEmitter.emit('chatUserStatusChanged', data);
    });

    socket.on('online_users_status', (statusMap) => {
      DeviceEventEmitter.emit('chatOnlineUsersStatus', statusMap);
    });

    socket.on('user_typing', (data) => {
      DeviceEventEmitter.emit('chatUserTyping', data);
    });

    socket.on('conversation_status_changed', (data) => {
      DeviceEventEmitter.emit('chatConversationStatusChanged', data);
    });

    socket.on('messages_read', (data) => {
      DeviceEventEmitter.emit('chatMessagesRead', data);
    });

    socket.on('message_unsent', (data) => {
      DeviceEventEmitter.emit('chatMessageUnsent', data);
    });

    socket.on('message_deleted_for_me', (data) => {
      DeviceEventEmitter.emit('chatMessageDeletedForMe', data);
    });

    socket.on('disconnect', (reason) => {
      isConnecting = false;
      console.log('Socket disconnected:', reason);
      DeviceEventEmitter.emit('socketDisconnected');
    });

    return socket;
  } catch (err) {
    isConnecting = false;
    console.error('Failed to init socket:', err);
    return null;
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
    isConnecting = false;
  }
};

export const joinConversationRoom = (conversationId: string) => {
  if (!conversationId) return;
  activeConversationId = conversationId;
  if (socket && socket.connected) {
    socket.emit('join_conversation', { conversationId });
  } else {
    initSocket();
  }
};

export const leaveConversationRoom = (conversationId: string) => {
  if (!conversationId) return;
  if (activeConversationId === conversationId) {
    activeConversationId = null;
  }
  if (socket && socket.connected) {
    socket.emit('leave_conversation', { conversationId });
  }
};

export const getActiveConversationId = (): string | null => {
  return activeConversationId;
};

export const emitTyping = (conversationId: string, recipientId: string, isTyping: boolean) => {
  if (socket && socket.connected && conversationId) {
    socket.emit('typing', { conversationId, recipientId, isTyping });
  }
};

const flushPendingOnlineStatus = () => {
  if (!socket || !socket.connected || pendingOnlineUserIds.size === 0) return;
  const ids = Array.from(pendingOnlineUserIds);
  pendingOnlineUserIds.clear();
  socket.emit('check_online_users', ids, (statusMap: Record<string, boolean>) => {
    if (statusMap) {
      DeviceEventEmitter.emit('chatOnlineUsersStatus', statusMap);
    }
  });
};

export const requestOnlineStatus = (userIds: string[], callback?: (status: Record<string, boolean>) => void) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  userIds.forEach((id) => {
    if (id) pendingOnlineUserIds.add(id.toString());
  });

  if (socket && socket.connected) {
    flushPendingOnlineStatus();
  } else {
    initSocket();
  }

  if (callback && socket && socket.connected) {
    socket.emit('check_online_users', userIds, callback);
  }
};
