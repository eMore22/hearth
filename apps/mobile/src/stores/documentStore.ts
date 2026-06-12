import { create } from 'zustand';
import api from '../services/api';

interface Document {
  id: string;
  title: string;
  document_type: string;
  expiry_date?: string;
  file_url?: string;
  summary?: string;
  key_fields?: Record<string, any>;
}

interface DocumentState {
  documents: Document[];
  isLoading: boolean;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: any, memberName?: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  isLoading: false,

  fetchDocuments: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/api/documents/');
      set({ documents: res.data });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  uploadDocument: async (file, memberName) => {
    const formData = new FormData();
    formData.append('file', file as any);
    if (memberName) formData.append('member_name', memberName);

    await api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await get().fetchDocuments();
  },

  deleteDocument: async (id) => {
    await api.delete(`/api/documents/${id}`);
    await get().fetchDocuments();
  },
}));