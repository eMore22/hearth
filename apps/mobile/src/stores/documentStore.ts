import { create } from 'zustand';
import { documentService } from '../services/api';

export interface Document {
  id: string;
  title: string;
  document_type: string;
  file_url?: string;
  expiry_date?: string | null;
  summary?: string;
  key_fields?: Record<string, any>;
  member_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentAlert {
  document_id?: string;
  title: string;
  urgency: 'expired' | 'critical' | 'urgent' | 'upcoming';
  days_until_expiry: number;
  message: string;
}

interface DocumentState {
  documents: Document[];
  alerts: DocumentAlert[];
  loading: boolean;
  isLoading: boolean;
  error: string | null;

  fetchDocuments: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  uploadDocument: (file: any, memberName?: string) => Promise<void>;
  askQuestion: (question: string) => Promise<string>;
  deleteDocument: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  alerts: [],
  loading: false,
  isLoading: false,
  error: null,

  fetchDocuments: async () => {
    set({ loading: true, isLoading: true, error: null });
    try {
      const res = await documentService.list();
      set({ documents: res.data || [] });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to fetch documents';
      set({ error: message });
    } finally {
      set({ loading: false, isLoading: false });
    }
  },

  fetchAlerts: async () => {
    try {
      const res = await documentService.getExpiring();
      set({ alerts: res.data || [] });
    } catch (error: any) {
      set({ alerts: [] });
    }
  },

  uploadDocument: async (file, memberName) => {
    set({ loading: true, isLoading: true, error: null });
    try {
      const formData = new FormData();
      // file.fileName is ImagePicker's field name; file.name is
      // DocumentPicker's — supporting both since documents.tsx now uses
      // either source depending on which button the user taps.
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'image/jpeg',
        name: file.fileName || file.name || 'document',
      } as any);
      if (memberName) formData.append('member_name', memberName);

      await documentService.upload(formData);
      await get().fetchDocuments();
      await get().fetchAlerts();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to upload document';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false, isLoading: false });
    }
  },

  askQuestion: async (question: string): Promise<string> => {
    try {
      const res = await documentService.ask(question);
      return res.data?.answer || 'No answer found.';
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to get answer');
    }
  },

  deleteDocument: async (id) => {
    set({ loading: true, isLoading: true, error: null });
    try {
      await documentService.delete(id);
      await get().fetchDocuments();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to delete document';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
