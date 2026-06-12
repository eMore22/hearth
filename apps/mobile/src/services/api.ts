import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.175.202:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Request Interceptor: Attach token ----
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // authStore stores session as a plain string (the access token)
    const token = useAuthStore.getState().session;

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Response Interceptor: Simple 401 handling ----
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token is invalid/expired → sign out and let navigation handle redirect
      const { signOut } = useAuthStore.getState();
      await signOut();
    }
    return Promise.reject(error);
  }
);

// ==================== SERVICE LAYER ====================

export const authService = {
  signIn: (email: string, password: string) =>
    api.post('/api/auth/signin', { email, password }),

  signUp: (email: string, password: string, fullName?: string) =>
    api.post('/api/auth/signup', { email, password, full_name: fullName }),

  signOut: () => api.post('/api/auth/signout'),
};

export const householdService = {
  get: () => api.get('/api/household/'),
  create: (data: { name: string; address?: string; country?: string }) =>
    api.post('/api/household/', data),
};

export const documentService = {
  list: () => api.get('/api/documents/'),
  upload: (formData: FormData) =>
    api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => api.delete(`/api/documents/${id}`),
  getExpiring: () => api.get('/api/documents/expiring'),
};

export const billService = {
  list: () => api.get('/api/bills/'),
  create: (data: any) => api.post('/api/bills/', data),
};

export const groceryService = {
  inventory: () => api.get('/api/grocery/inventory'),
  mealPlan: () => api.post('/api/grocery/meal-plan/generate'),
  shoppingList: () => api.post('/api/grocery/shopping-list'),
};

export default api;