import { create } from 'zustand';
import api from '../services/api';

export interface Document {
  id: string;
  title: string;
  document_type: string;
  file_url?: string;
  expiry_date?: string | null;
  summary?: string;
  key_fields?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

interface DocumentState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;

  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: any, memberName?: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,

  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/api/documents/');
      set({ documents: res.data || [] });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to fetch documents';
      set({ error: message });
      console.error('Fetch documents error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  uploadDocument: async (file, memberName) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file as any);
      if (memberName) formData.append('member_name', memberName);

      await api.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await get().fetchDocuments();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to upload document';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDocument: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/documents/${id}`);
      await get().fetchDocuments();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to delete document';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));