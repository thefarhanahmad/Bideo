import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.101:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token?: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const videoService = {
  getVideos: async (params?: any) => {
    const response = await api.get('/videos', { params });
    // normalize to return the array of videos directly
    return response.data && response.data.data ? response.data.data : [];
  },
  getVideo: async (id: string) => {
    const response = await api.get(`/videos/${id}`);
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
