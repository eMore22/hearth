import { create } from 'zustand';
import api from '../services/api';

export interface Household {
  id: string;
  name: string;
  address?: string | null;
  country?: string;
  created_at?: string;
  updated_at?: string;
}

interface HouseholdState {
  household: Household | null;
  isLoading: boolean;
  error: string | null;

  fetchHousehold: () => Promise<void>;
  createHousehold: (data: { name: string; address?: string; country?: string }) => Promise<void>;
  clearHousehold: () => void;
  clearError: () => void;
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  household: null,
  isLoading: false,
  error: null,

  fetchHousehold: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/api/household/');
      if (res.data?.households) {
        set({ household: res.data.households });
      } else {
        set({ household: null });
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to fetch household';
      set({ error: message, household: null });
    } finally {
      set({ isLoading: false });
    }
  },

  createHousehold: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/api/household/', data);
      await get().fetchHousehold(); // refresh after creation
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create household';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearHousehold: () => set({ household: null, error: null }),

  clearError: () => set({ error: null }),
}));