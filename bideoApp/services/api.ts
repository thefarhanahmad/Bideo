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

// Automatically ensure Bearer token is attached on every outgoing request
api.interceptors.request.use(
  async (config) => {
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

export const setAuthToken = (token?: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
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
};

export default api;
