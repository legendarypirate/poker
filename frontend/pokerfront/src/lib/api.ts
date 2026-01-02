import axios from 'axios';
import { API_URL } from './config';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },

  register: async (username: string, password: string, passwordConfirm: string, email?: string) => {
    const response = await api.post('/api/auth/register', {
      username,
      password,
      passwordConfirm,
      email: email || null,
    });
    return response.data;
  },

  socialLogin: async (data: {
    firebase_uid: string;
    email?: string;
    display_name?: string;
    provider: string;
    avatar_url?: string;
  }) => {
    const response = await api.post('/api/auth/social-login', data);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

export const gameAPI = {
  createGame: async (roomId: string, players: any[], buyIn: number) => {
    const response = await api.post('/api/games/create', {
      roomId,
      players,
      buyIn,
    });
    return response.data;
  },

  updateGameStatus: async (gameId: number, status: string) => {
    const response = await api.put(`/api/games/${gameId}/status`, { status });
    return response.data;
  },
};

export default api;

