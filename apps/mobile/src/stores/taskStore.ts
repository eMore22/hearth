import { create } from 'zustand';
import { taskService } from '../services/api';

export interface HouseholdTask {
  id: string;
  title: string;
  notes?: string;
  due_at?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

interface TaskState {
  tasks: HouseholdTask[];
  isLoading: boolean;
  error: string | null;

  fetchTasks: () => Promise<void>;
  createTask: (title: string, notes?: string, dueAt?: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await taskService.list();
      set({ tasks: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createTask: async (title, notes, dueAt) => {
    set({ isLoading: true, error: null });
    try {
      const response = await taskService.create(title, notes, dueAt);
      set({ tasks: [...get().tasks, response.data], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  completeTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await taskService.complete(taskId);
      set({
        tasks: get().tasks.map((t) =>
          t.id === taskId ? { ...t, is_completed: true } : t
        ),
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await taskService.delete(taskId);
      set({
        tasks: get().tasks.filter((t) => t.id !== taskId),
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
