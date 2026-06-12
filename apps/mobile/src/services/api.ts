import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.175.30:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().session?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle 401 and auto refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the session
        const { refreshSession } = useAuthStore.getState();
        await refreshSession();

        const newToken = useAuthStore.getState().session?.access_token;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        const { signOut } = useAuthStore.getState();
        await signOut();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;