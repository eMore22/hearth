import { create } from 'zustand';
import { chiefService } from '../services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: string;
  // Whoever sent this message — present on every row once loaded from
  // history. Not yet used for name/avatar attribution in the UI, but the
  // data's there for when that's built.
  user_id?: string;
  proactive_suggestions?: string[];
  // Present when the Chief executed a smart-home command during this reply
  action_result?: { status: 'sent' | 'failed'; entity_id?: string; action?: string; error?: string };
}

export interface DashboardSummary {
  documents: { total: number; expiring_soon: number; next_expiry: string | null };
  bills: { total: number; monthly_spend: number; largest_bill: string | null };
  grocery: { items: number; expiring_soon: number };
  maintenance: { total_tasks: number; due_this_week: number };
  health: { recent_events: number; active_medications: number };
  chief_message: string;
}

interface ChiefOfStaffState {
  messages: ChatMessage[];
  dashboardSummary: DashboardSummary | null;
  isTyping: boolean;
  isLoading: boolean;
  historyLoaded: boolean;
  error: string | null;

  sendMessage: (message: string, context?: any) => Promise<ChatMessage>;
  fetchDashboardSummary: (householdData?: any) => Promise<DashboardSummary>;
  fetchHistory: () => Promise<void>;
  clearMessages: () => Promise<void>;
  clearError: () => void;
}

export const useChiefOfStaffStore = create<ChiefOfStaffState>((set, get) => ({
  messages: [],
  dashboardSummary: null,
  isTyping: false,
  isLoading: false,
  historyLoaded: false,
  error: null,

  sendMessage: async (message, context = {}) => {
    const currentMessages = get().messages;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    set({ messages: [...currentMessages, userMessage], isTyping: true, error: null });

    try {
      // Build conversation history from all previous messages
      // This is what gives the Chief of Staff real memory
      const conversationHistory = currentMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await chiefService.chat(message, conversationHistory, context);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date().toISOString(),
        category: response.data.category,
        proactive_suggestions: response.data.proactive_suggestions,
        action_result: response.data.action_result,
      };

      set({
        messages: [...get().messages, assistantMessage],
        isTyping: false,
      });

      return assistantMessage;
    } catch (error: any) {
      set({ error: error.message, isTyping: false });
      throw error;
    }
  },

  fetchDashboardSummary: async (householdData = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await chiefService.dashboardSummary(householdData);
      set({ dashboardSummary: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchHistory: async () => {
    // Household-shared thread, loaded once per app session rather than
    // every time the screen mounts — avoids clobbering messages sent
    // seconds ago by re-fetching mid-conversation.
    if (get().historyLoaded) return;
    set({ isLoading: true, error: null });
    try {
      const response = await chiefService.getHistory();
      const loaded: ChatMessage[] = (response.data || []).map((row: any) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
        category: row.category,
        user_id: row.user_id,
      }));
      set({ messages: loaded, isLoading: false, historyLoaded: true });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearMessages: async () => {
    const previous = get().messages;
    set({ messages: [] });
    try {
      await chiefService.clearHistory();
    } catch (error: any) {
      // Server-side clear failed — restore local state rather than show
      // an empty thread that isn't actually cleared for the household.
      set({ messages: previous, error: error.message });
    }
  },

  clearError: () => set({ error: null }),
}));
