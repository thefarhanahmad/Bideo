import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.108:5000/api';

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
  getVideos: async () => {
    const response = await api.get('/videos');
    // normalize to return the array of videos directly
    return response.data && response.data.data ? response.data.data : [];
  },
  getVideo: async (id: string) => {
    const response = await api.get(`/videos/${id}`);
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
