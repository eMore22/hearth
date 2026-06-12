import { create } from 'zustand';
import api from '../services/api';

interface User {
  id: string;
  email: string;
}

interface Session {
  access_token: string;
  user: User;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      // Try to refresh session on app start
      const response = await api.post('/api/auth/refresh');
      if (response.data?.session) {
        set({
          session: response.data.session,
          user: response.data.user || response.data.session.user,
        });
      }
    } catch (error) {
      // No valid session, user needs to login
      set({ session: null, user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/signin', { email, password });
      
      if (response.data?.session) {
        set({
          session: response.data.session,
          user: response.data.user || response.data.session.user,
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/api/auth/signup', { email, password });
      
      if (response.data?.session) {
        set({
          session: response.data.session,
          user: response.data.user || response.data.session.user,
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Signup failed';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/signout');
    } catch (error) {
      console.warn('Signout request failed, clearing local session anyway');
    } finally {
      set({ session: null, user: null, isLoading: false });
    }
  },

  refreshSession: async () => {
    try {
      const response = await api.post('/api/auth/refresh');
      if (response.data?.session) {
        set({
          session: response.data.session,
          user: response.data.user || response.data.session.user,
        });
      }
    } catch (error) {
      set({ session: null, user: null });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));