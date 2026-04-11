import { create } from 'zustand'
import { documentService } from '../services/api'

interface DocumentState {
  documents: any[]
  alerts: any[]
  loading: boolean
  fetchDocuments: () => Promise<void>
  fetchAlerts: () => Promise<void>
  uploadDocument: (asset: any, memberName?: string) => Promise<void>
  askQuestion: (question: string) => Promise<string>
  deleteDocument: (id: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  alerts: [],
  loading: false,

  fetchDocuments: async () => {
    set({ loading: true })
    try {
      const res = await documentService.list()
      set({ documents: res.data })
    } catch (err) {
      console.error('fetchDocuments error:', err)
    } finally {
      set({ loading: false })
    }
  },

  fetchAlerts: async () => {
    try {
      const res = await documentService.getExpiring()
      set({ alerts: res.data })
    } catch (err) {
      console.error('fetchAlerts error:', err)
    }
  },

  uploadDocument: async (asset, memberName) => {
    await documentService.upload(asset, memberName)
  },

  askQuestion: async (question) => {
    const res = await documentService.ask(question)
    return res.data.answer
  },

  deleteDocument: async (id) => {
    await documentService.delete(id)
    set({ documents: get().documents.filter(d => d.id !== id) })
  }
}))
