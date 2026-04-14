import { create } from 'zustand';
import { api } from '../services/api';

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
  week_of: string;
  categories: Record<string, string[]>;
  total_items: number;
  estimated_cost: number;
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
  isLoading: boolean;
  error: string | null;

  setPreferences: (prefs: any) => void;
  generateMealPlan: (preferences?: any, inventory?: InventoryItem[]) => Promise<MealPlan>;
  createShoppingList: (mealPlan: MealPlan, inventory?: InventoryItem[]) => Promise<ShoppingList>;
  fetchWasteAlerts: (inventory?: InventoryItem[]) => Promise<WasteAlert[]>;
  modifyMeal: (currentPlan: MealPlan, day: string, newPreference: string) => Promise<any>;
  fetchInventory: () => Promise<void>;
  addInventoryItem: (item: Partial<InventoryItem>) => Promise<void>;
  clearError: () => void;
}

export const useGroceryStore = create<GroceryState>((set, get) => ({
  preferences: null,
  mealPlan: null,
  shoppingList: null,
  inventory: [],
  wasteAlerts: [],
  isLoading: false,
  error: null,

  setPreferences: (prefs) => set({ preferences: prefs }),

  generateMealPlan: async (preferences, inventory) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/grocery/meal-plan/generate', {
        preferences: preferences || get().preferences,
        inventory: inventory || get().inventory,
      });
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
      const response = await api.post('/grocery/shopping-list', {
        meal_plan: mealPlan,
        inventory: inventory || get().inventory,
      });
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
      const response = await api.post('/grocery/waste-alert', { inventory: inv });
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
      const response = await api.post('/grocery/meal-plan/modify', {
        current_plan: currentPlan,
        day,
        new_preference: newPreference,
      });
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
      const response = await api.get('/grocery/inventory');
      set({ inventory: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addInventoryItem: async (item) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/grocery/inventory', item);
      set({ inventory: [...get().inventory, response.data], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));