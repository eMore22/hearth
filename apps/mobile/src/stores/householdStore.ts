import { create } from 'zustand';
import api from '../services/api';

export interface Household {
  id: string;
  name: string;
  address?: string | null;
  country?: string;
  currency?: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

interface HouseholdState {
  household: Household | null;
  loading: boolean;
  isLoading: boolean;
  error: string | null;

  fetchHousehold: () => Promise<void>;
  createHousehold: (data: { name: string; address?: string; country?: string; currency?: string; timezone?: string }) => Promise<void>;
  updateHousehold: (data: { name?: string; address?: string; country?: string; currency?: string; timezone?: string }) => Promise<void>;
  clearHousehold: () => void;
  clearError: () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  household: null,
  loading: false,
  isLoading: false,
  error: null,

  fetchHousehold: async () => {
    set({ loading: true, isLoading: true, error: null });
    try {
      const res = await api.get('/api/household/');
      if (res.data?.households) {
        set({ household: res.data.households });
      } else if (res.data?.id) {
        set({ household: res.data });
      } else {
        set({ household: null });
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to fetch household';
      set({ error: message, household: null });
    } finally {
      set({ loading: false, isLoading: false });
    }
  },

  createHousehold: async (data) => {
    set({ loading: true, isLoading: true, error: null });
    try {
      await api.post('/api/household/', data);
      await get().fetchHousehold();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create household';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false, isLoading: false });
    }
  },

  updateHousehold: async (data) => {
    const current = get().household;
    if (!current?.id) throw new Error('No household to update');
    set({ loading: true, isLoading: true, error: null });
    try {
      await api.patch(`/api/household/${current.id}`, data);
      await get().fetchHousehold();
    } catch (error: any) {
      set({ household: { ...current, ...data }, loading: false, isLoading: false });
      const message = error.response?.data?.detail || 'Failed to update household';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false, isLoading: false });
    }
  },

  clearHousehold: () => set({ household: null, error: null }),
  clearError: () => set({ error: null }),
}));