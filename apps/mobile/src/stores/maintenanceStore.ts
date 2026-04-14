import { create } from 'zustand';
import { api } from '../services/api';

export interface MaintenanceTask {
  id?: string;
  name: string;
  due_date: string;
  interval_days: number;
  diy_friendly: boolean;
  season?: string;
  completed?: boolean;
}

export interface HomeProfile {
  id?: string;
  property_type: string;
  appliances: string[];
  climate: string;
  year_built?: number;
}

export interface Diagnosis {
  likely_causes: string[];
  diy_check_steps: string[];
  professional_needed: boolean;
  tradesperson_type: string;
  urgency: 'emergency' | 'soon' | 'whenever';
  estimated_cost_range: string;
}

interface MaintenanceState {
  homeProfile: HomeProfile | null;
  tasks: MaintenanceTask[];
  calendar: any | null;
  isLoading: boolean;
  error: string | null;

  setHomeProfile: (profile: HomeProfile) => void;
  generateCalendar: (profile?: HomeProfile) => Promise<any>;
  diagnoseProblem: (description: string, photos?: string[]) => Promise<Diagnosis>;
  estimateCost: (appliance: string, issue: string) => Promise<any>;
  getDIYInstructions: (taskName: string) => Promise<any>;
  fetchTasks: () => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  clearError: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  homeProfile: null,
  tasks: [],
  calendar: null,
  isLoading: false,
  error: null,

  setHomeProfile: (profile) => set({ homeProfile: profile }),

  generateCalendar: async (profile) => {
    const prof = profile || get().homeProfile;
    if (!prof) throw new Error('No home profile');
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/maintenance/calendar/generate', {
        home_profile: prof,
      });
      set({ calendar: response.data, tasks: response.data.tasks, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  diagnoseProblem: async (description, photos) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/maintenance/diagnose', {
        description,
        photos,
      });
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  estimateCost: async (appliance, issue) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/maintenance/estimate-cost', {
        appliance,
        issue,
      });
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getDIYInstructions: async (taskName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/maintenance/diy/${encodeURIComponent(taskName)}`);
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/maintenance/tasks');
      set({ tasks: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  completeTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/maintenance/tasks/${taskId}/complete`);
      set({
        tasks: get().tasks.map((t) =>
          t.id === taskId ? { ...t, completed: true } : t
        ),
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));