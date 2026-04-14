import { create } from 'zustand';
import { api } from '../services/api';

export interface TriageResult {
  triage_level: 'home_care' | 'pharmacy' | 'gp_visit' | 'urgent_care' | 'emergency';
  recommendation: string;
  home_care_tips?: string[];
  red_flags?: string[];
  suggested_otc?: string;
  disclaimer: string;
}

export interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  patient_id?: string;
}

interface HealthState {
  triageHistory: Array<{ symptoms: string; result: TriageResult; date: string }>;
  medications: Medication[];
  isLoading: boolean;
  error: string | null;

  triageSymptoms: (symptoms: string, patientProfile?: any) => Promise<TriageResult>;
  getHomeCare: (condition: string) => Promise<any>;
  createMedicationSchedule: (medications: Medication[]) => Promise<any>;
  fetchMedications: () => Promise<void>;
  addMedication: (med: Partial<Medication>) => Promise<void>;
  clearError: () => void;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  triageHistory: [],
  medications: [],
  isLoading: false,
  error: null,

  triageSymptoms: async (symptoms, patientProfile = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/health/triage', {
        symptoms,
        patient_profile: patientProfile,
      });
      const result = response.data;
      set({
        triageHistory: [
          { symptoms, result, date: new Date().toISOString() },
          ...get().triageHistory,
        ],
        isLoading: false,
      });
      return result;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  getHomeCare: async (condition) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/health/home-care', { condition });
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createMedicationSchedule: async (medications) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/health/medication-schedule', { medications });
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchMedications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/health/medications');
      set({ medications: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addMedication: async (med) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/health/medications', med);
      set({
        medications: [...get().medications, response.data],
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));