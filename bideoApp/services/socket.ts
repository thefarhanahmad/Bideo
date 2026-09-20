import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import api from './api';

let socket: Socket | null = null;
let currentToken: string | null = null;

export const getSocketUrl = (): string => {
  const apiBase = api.defaults.baseURL || process.env.EXPO_PUBLIC_API_URL || 'https://bideo.in/api';
  return apiBase.replace(/\/api\/?$/, '');
};

export const initSocket = async (): Promise<Socket | null> => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      disconnectSocket();
      return null;
    }

    if (socket && socket.connected && currentToken === token) {
      return socket;
    }

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    const socketUrl = getSocketUrl();
    currentToken = token;

    socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected successfully to:', socketUrl);
      DeviceEventEmitter.emit('socketConnected');
    });

    socket.on('connect_error', (err) => {
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

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      DeviceEventEmitter.emit('socketDisconnected');
    });

    return socket;
  } catch (err) {
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
  }
};

export const joinConversationRoom = (conversationId: string) => {
  if (socket && socket.connected && conversationId) {
    socket.emit('join_conversation', { conversationId });
  }
};

export const leaveConversationRoom = (conversationId: string) => {
  if (socket && socket.connected && conversationId) {
    socket.emit('leave_conversation', { conversationId });
  }
};

export const emitTyping = (conversationId: string, recipientId: string, isTyping: boolean) => {
  if (socket && socket.connected && conversationId) {
    socket.emit('typing', { conversationId, recipientId, isTyping });
  }
};

export const requestOnlineStatus = (userIds: string[], callback?: (status: Record<string, boolean>) => void) => {
  if (socket && socket.connected && userIds.length > 0) {
    socket.emit('check_online_users', userIds, callback);
  }
};
