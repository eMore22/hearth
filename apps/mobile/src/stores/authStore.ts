import { create } from 'zustand';
import { authService } from '../services/api';
import {
  getToken,
  setToken,
  removeToken,
  getUser,
  setUser,
  removeUser,
} from '../lib/authToken';

interface AuthState {
  session: string | null;
  user: any | null;
  loading: boolean;
  error: string | null;

  loadSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  error: null,

  loadSession: async () => {
    try {
      const token = await getToken();
      const user = await getUser();

      if (token && user) {
        set({ session: token, user, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authService.signIn(email, password);
      const { access_token, user } = res.data;

      await setToken(access_token);
      await setUser(user);

      set({ session: access_token, user });
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Login failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    try {
      await authService.signUp(email, password, fullName);
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Signup failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await removeToken();
      await removeUser();
      set({ session: null, user: null });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));