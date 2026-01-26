import axios, { AxiosError } from 'axios';
import { API_URL } from './config';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to get token from cookies or localStorage
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // First try cookies
  const cookieToken = Cookies.get('token');
  if (cookieToken) return cookieToken;
  
  // Fallback to localStorage
  const localToken = localStorage.getItem('token');
  if (localToken) {
    // Also set it in cookies for consistency
    Cookies.set('token', localToken, { expires: 7 });
    return localToken;
  }
  
  return null;
};

// Add token to requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle response errors, especially 401 Unauthorized
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear authentication data
      Cookies.remove('token');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        
        // Clear user data from localStorage
        const keysToRemove = ['user_id', 'username', 'email', 'account_balance', 'display_name', 'avatar_url'];
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Only redirect if we're not already on a login/auth page
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/auth') && currentPath !== '/') {
          // Use setTimeout to avoid issues during render
          setTimeout(() => {
            window.location.href = '/';
          }, 100);
        }
      }
      
      // Return a more user-friendly error
      const errorData = error.response?.data as { message?: string } | undefined;
      return Promise.reject({
        ...error,
        message: errorData?.message || 'Authentication failed. Please log in again.',
        isAuthError: true,
      });
    }
    
    return Promise.reject(error);
  }
);

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

