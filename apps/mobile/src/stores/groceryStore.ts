import { create } from 'zustand';
import { groceryService } from '../services/api';

export interface MealPlan {
  week_of: string;
  days: Array<{
    day: string;
    breakfast: { name: string; ingredients: string[] };
    lunch: { name: string; ingredients: string[] };
    dinner: { name: string; ingredients: string[] };
  }>;
  estimated_cost: number;
  notes?: string;
}

export interface ShoppingList {
  week_of?: string;
  categories: Record<string, string[]>;
  total_items: number;
  estimated_cost: number;
  estimated_total?: number;
  over_budget?: boolean;
  budget_gap?: number;
  suggestions?: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity?: string;
  expiry_date?: string;
  days_left?: number;
}

export interface WasteAlert {
  item: string;
  expiry_date: string;
  days_left: number;
  urgency: 'critical' | 'warning';
  suggested_recipe: { recipe_name: string; quick_instructions: string };
}

interface GroceryState {
  preferences: any | null;
  mealPlan: MealPlan | null;
  shoppingList: ShoppingList | null;
  inventory: InventoryItem[];
  wasteAlerts: WasteAlert[];
  budget: number;
  isLoading: boolean;
  error: string | null;

  setPreferences: (prefs: any) => void;
  generateMealPlan: (preferences?: any, inventory?: InventoryItem[]) => Promise<MealPlan>;
  createShoppingList: (mealPlan: MealPlan, inventory?: InventoryItem[]) => Promise<ShoppingList>;
  fetchWasteAlerts: (inventory?: InventoryItem[]) => Promise<WasteAlert[]>;
  modifyMeal: (currentPlan: MealPlan, day: string, newPreference: string) => Promise<any>;
  fetchInventory: () => Promise<void>;
  addInventoryItem: (item: Partial<InventoryItem>) => Promise<void>;
  fetchBudget: () => Promise<void>;
  // currency param kept for backend compatibility (household_preferences still
  // stores it), but the UI should always pass the household's currency here —
  // it is no longer read back for display anywhere.
  setBudget: (amount: number, currency?: string) => Promise<void>;
  saveMealPlan: (plan: MealPlan) => Promise<void>;
  generateBudgetShoppingList: (plan: MealPlan, budget: number) => Promise<any>;
  clearError: () => void;
}

export const useGroceryStore = create<GroceryState>((set, get) => ({
  preferences: null,
  mealPlan: null,
  shoppingList: null,
  inventory: [],
  wasteAlerts: [],
  budget: 0,
  isLoading: false,
  error: null,

  setPreferences: (prefs) => set({ preferences: prefs }),

  generateMealPlan: async (preferences, inventory) => {
    set({ isLoading: true, error: null });
    try {
      const response = await groceryService.generateMealPlan(
        preferences || get().preferences,
        inventory || get().inventory
      );
      set({ mealPlan: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createShoppingList: async (mealPlan, inventory) => {
    set({ isLoading: true, error: null });
    try {
      const response = await groceryService.createShoppingList(
        mealPlan,
        inventory || get().inventory
      );
      set({ shoppingList: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchWasteAlerts: async (inventory) => {
    const inv = inventory || get().inventory;
    set({ isLoading: true, error: null });
    try {
      const response = await groceryService.wasteAlert(inv);
      set({ wasteAlerts: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  modifyMeal: async (currentPlan, day, newPreference) => {
    set({ isLoading: true, error: null });
    try {
      const response = await groceryService.modifyMeal(currentPlan, day, newPreference);
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchInventory: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await groceryService.getInventory();
      set({ inventory: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addInventoryItem: async (item) => {
    set({ isLoading: true, error: null });
    try {
      const response = await groceryService.addInventory(item);
      set({ inventory: [...get().inventory, response.data], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchBudget: async () => {
    try {
      const res = await groceryService.getBudget();
      set({ budget: res.data?.weekly_budget || 0 });
    } catch {}
  },

  setBudget: async (amount, currency = 'NGN') => {
    try {
      await groceryService.setBudget(amount, currency);
      set({ budget: amount });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  saveMealPlan: async (plan) => {
    set({ isLoading: true, error: null });
    try {
      await groceryService.saveMealPlan(plan);
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  generateBudgetShoppingList: async (plan, budget) => {
    set({ isLoading: true, error: null });
    try {
      const res = await groceryService.generateBudgetShoppingList(plan, budget);
      set({ shoppingList: res.data, isLoading: false });
      return res.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
