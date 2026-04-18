import { create } from 'zustand';
import { billService } from '../services/api';

export interface Bill {
  id: string;
  provider: string;
  description?: string;
  amount: number;
  billing_cycle: string;
  category: string;
  last_used?: string;
  notes?: string;
  created_at: string;
}

export interface UnusedSubscription {
  provider: string;
  reason: string;
  suggested_action: string;
  monthly_savings: number;
}

export interface MonthlyReport {
  month: string;
  total_spent: number;
  change_from_last_month: number;
  biggest_increases: Array<{ provider: string; increase: number }>;
  summary: string;
  mood: 'good' | 'neutral' | 'alert';
  savings_tip?: string;
}

interface BillState {
  bills: Bill[];
  isLoading: boolean;
  error: string | null;
  monthlyReport: MonthlyReport | null;
  unusedSubscriptions: UnusedSubscription[];
  negotiationScript: any | null;

  fetchBills: () => Promise<void>;
  createBill: (data: Partial<Bill>) => Promise<Bill>;
  analyzeBill: (billData: Partial<Bill>) => Promise<any>;
  detectUnused: (bills?: Bill[]) => Promise<UnusedSubscription[]>;
  generateNegotiationScript: (provider: string, currentPlan: string, accountAgeMonths?: number) => Promise<any>;
  fetchMonthlyReport: () => Promise<MonthlyReport>;
  clearError: () => void;
}

export const useBillStore = create<BillState>((set, get) => ({
  bills: [],
  isLoading: false,
  error: null,
  monthlyReport: null,
  unusedSubscriptions: [],
  negotiationScript: null,

  fetchBills: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await billService.list();
      set({ bills: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createBill: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await billService.create(data);
      const newBill = response.data;
      set({ bills: [...get().bills, newBill], isLoading: false });
      return newBill;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  analyzeBill: async (billData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await billService.analyze(billData);
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  detectUnused: async (bills) => {
    const billsToCheck = bills || get().bills;
    set({ isLoading: true, error: null });
    try {
      const response = await billService.detectUnused(billsToCheck);
      set({ unusedSubscriptions: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  generateNegotiationScript: async (provider, currentPlan, accountAgeMonths = 12) => {
    set({ isLoading: true, error: null });
    try {
      const response = await billService.negotiationScript(provider, currentPlan, accountAgeMonths);
      set({ negotiationScript: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchMonthlyReport: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await billService.monthlyReport();
      set({ monthlyReport: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));