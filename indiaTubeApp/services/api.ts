import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const videoService = {
  getVideos: async () => {
    const response = await api.get('/videos');
    return response.data;
  },
  getVideo: async (id: string) => {
    const response = await api.get(`/videos/${id}`);
    return response.data;
  },
};

export const authService = {
  googleLogin: async (userData: { name: string; email: string; avatar: string }) => {
    const response = await api.post('/auth/google', userData);
    return response.data;
  },
};

export default api;
