import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// EXPO_PUBLIC_API_URL is inlined at build time. In dev it comes from .env (LAN IP);
// for standalone builds it is injected per-profile via eas.json. The fallback is the
// hosted backend so an installed APK is never left pointing at an unreachable LAN IP.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://bideo.in/api';
console.log('🔗 [Bideo API] Connecting to:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach Bearer token on protected requests, but bypass for public auth routes
api.interceptors.request.use(
  async (config) => {
    const isAuthRoute =
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/signup') ||
      config.url?.includes('/auth/google') ||
      config.url?.includes('/auth/forgot-password') ||
      config.url?.includes('/auth/reset-password');

    if (isAuthRoute) {
      if (config.headers) {
        delete config.headers.Authorization;
      }
      return config;
    }

    if (!config.headers.Authorization) {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // ignore read error
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: automatically clear session if server indicates user account is blocked or revoked
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 403 && error?.response?.data?.isBlocked) {
      await clearAuthSession().catch(() => {});
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token?: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    api.defaults.headers.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
    delete api.defaults.headers.Authorization;
  }
};

export const clearAuthSession = async () => {
  try {
    const pushToken = await AsyncStorage.getItem('push_token');
    // Always call backend to revoke this device's push token while auth header is present
    await api.delete('/auth/push-token', { data: { pushToken: pushToken || undefined } }).catch(() => {});
    await AsyncStorage.multiRemove(['token', 'cached_user', 'push_token']);
  } catch {
    // ignore
  }
  setAuthToken(null);
  try {
    const { disconnectSocket } = require('./socket');
    disconnectSocket();
  } catch {}
};

export const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  const apiBase = api.defaults.baseURL || API_URL || '';
  const serverBase = apiBase.replace(/\/api\/?$/, '');

  if (url.startsWith('/')) {
    return `${serverBase}${url}`;
  }

  if (url.includes('localhost:5000') || url.includes('127.0.0.1:5000')) {
    return url
      .replace('http://localhost:5000', serverBase)
      .replace('https://localhost:5000', serverBase)
      .replace('http://127.0.0.1:5000', serverBase)
      .replace('https://127.0.0.1:5000', serverBase);
  }

  return url;
};

export const normalizeVideo = (video: any) => {
  if (!video) return video;
  return {
    ...video,
    thumbnail: resolveMediaUrl(video.thumbnail),
    videoUrl: resolveMediaUrl(video.videoUrl),
    owner: video.owner ? {
      ...video.owner,
      avatar: resolveMediaUrl(video.owner.avatar),
    } : video.owner,
  };
};

export const videoService = {
  getVideos: async (params?: any): Promise<any[]> => {
    const response = await api.get('/videos', { params });
    // normalize to return the array of videos directly
    const list = response.data && response.data.data ? response.data.data : [];
    return Array.isArray(list) ? list.map(normalizeVideo) : [];
  },
  getVideo: async (id: string): Promise<any> => {
    const response = await api.get(`/videos/${id}`);
    if (response.data && response.data.data) {
      response.data.data = normalizeVideo(response.data.data);
    }
    return response.data;
  },
  recordView: async (id: string) => {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    const response = await api.post(`/videos/${id}/view`, { deviceId }, {
      headers: { 'X-Device-Id': deviceId },
    });
    return response.data;
  },
};

export const categoryService = {
  getCategories: async () => {
    const response = await api.get('/categories');
    return response.data && response.data.data ? response.data.data : [];
  }
};

export const authService = {
  signupWithPhone: async (userData: { name: string; phone: string; password: string }) => {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },
  loginWithPhone: async (credentials: { phone: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  googleLogin: async (userData: { name: string; email: string; avatar: string }) => {
    const response = await api.post('/auth/google', userData);
    return response.data;
  },
  forgotPassword: async (phone: string) => {
    const response = await api.post('/auth/forgot-password', { phone });
    return response.data;
  },
  resetPassword: async (data: { phone: string; otp: string; password: string }) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
};

export const userService = {
  updateEmail: async (email: string) => {
    const response = await api.put('/users/email', { email });
    return response.data;
  },
  sendEmailOtp: async (email: string) => {
    const response = await api.post('/users/send-email-otp', { email });
    return response.data;
  },
  verifyEmailOtp: async (email: string, otp: string) => {
    const response = await api.post('/users/verify-email-otp', { email, otp });
    return response.data;
  },
};

export const chatService = {
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data?.data || [];
  },
  getConversationById: async (id: string) => {
    const response = await api.get(`/chat/conversations/${id}`);
    return response.data?.data;
  },
  getOrCreateConversation: async (recipientId: string) => {
    const response = await api.post('/chat/conversations', { recipientId });
    return response.data?.data;
  },
  getMessages: async (conversationId: string, page = 1, limit = 50) => {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { page, limit },
    });
    return response.data;
  },
  sendMessage: async (data: {
    conversationId?: string;
    recipientId?: string;
    text?: string;
    videoId?: string;
    postId?: string;
  }) => {
    const response = await api.post('/chat/messages', data);
    return response.data?.data;
  },
  markAsRead: async (conversationId: string) => {
    const response = await api.put(`/chat/conversations/${conversationId}/read`);
    return response.data;
  },
  acceptChat: async (conversationId: string) => {
    const response = await api.post(`/chat/conversations/${conversationId}/accept`);
    return response.data?.data;
  },
  declineChat: async (conversationId: string) => {
    const response = await api.post(`/chat/conversations/${conversationId}/decline`);
    return response.data;
  },
  blockUser: async (conversationId: string) => {
    const response = await api.post(`/chat/conversations/${conversationId}/block`);
    return response.data?.data;
  },
  unblockUser: async (conversationId: string) => {
    const response = await api.post(`/chat/conversations/${conversationId}/unblock`);
    return response.data?.data;
  },
  unsendMessage: async (messageId: string) => {
    const response = await api.post(`/chat/messages/${messageId}/unsend`);
    return response.data;
  },
  deleteMessage: async (messageId: string) => {
    const response = await api.post(`/chat/messages/${messageId}/delete`);
    return response.data;
  },
  getUnreadCount: async () => {
    const response = await api.get('/chat/unread-count');
    return response.data?.count || 0;
  },
};

export default api;
