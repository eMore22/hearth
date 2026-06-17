import { create } from 'zustand';
import api from '../services/api';

export interface HADevice {
  id: string;
  entity_id: string;
  friendly_name: string;
  domain: string;
  device_class?: string;
  area?: string;
  last_state: string;
  last_state_at?: string;
  is_actionable: boolean;
}

export interface HAEvent {
  id: string;
  entity_id: string;
  event_type: string;
  old_state?: string;
  new_state?: string;
  attributes: {
    friendly_name?: string;
    chief_message?: string;
    suggested_actions?: SuggestedAction[];
    device_class?: string;
  };
  processed: boolean;
  alert_sent: boolean;
  created_at: string;
}

export interface SuggestedAction {
  label: string;
  action: string;
  entity_id?: string;
  icon: string;
  color: string;
}

export interface HAStatus {
  connected: boolean;
  ha_instance_url?: string;
  ha_connected_at?: string;
  last_sync_at?: string;
  device_count?: number;
}

interface AutomationState {
  status: HAStatus;
  devices: HADevice[];
  events: HAEvent[];
  isLoading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  connectHA: (haUrl: string, accessToken: string) => Promise<{ device_count: number; message: string }>;
  fetchDevices: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  executeAction: (entityId: string, action: string, payload?: any) => Promise<void>;
  clearError: () => void;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  status: { connected: false },
  devices: [],
  events: [],
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const res = await api.get('/api/automation/status');
      set({ status: res.data });
    } catch {
      set({ status: { connected: false } });
    }
  },

  connectHA: async (haUrl, accessToken) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/api/automation/connect', {
        ha_instance_url: haUrl,
        ha_access_token: accessToken,
      });
      set({ status: { connected: true }, isLoading: false });
      // Refresh devices after connecting
      await get().fetchDevices();
      return res.data;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Could not connect to Home Assistant';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  fetchDevices: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/api/automation/devices');
      set({ devices: res.data || [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchEvents: async () => {
    try {
      const res = await api.get('/api/automation/events');
      set({ events: res.data || [] });
    } catch {
      // Non-fatal
    }
  },

  executeAction: async (entityId, action, payload = {}) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/api/automation/action', {
        entity_id: entityId,
        action,
        payload,
      });
      // Refresh device states and events after action
      await get().fetchDevices();
      await get().fetchEvents();
      set({ isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Action failed';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));