import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_URL })

// Auto-attach auth token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authService = {
  signUp: (email: string, password: string, fullName: string) =>
    api.post('/api/auth/signup', { email, password, full_name: fullName }),

  signIn: (email: string, password: string) =>
    api.post('/api/auth/signin', { email, password }),

  signOut: () => api.post('/api/auth/signout'),
}

// ─── HOUSEHOLD ───────────────────────────────────────────────────────────────
export const householdService = {
  create: (name: string, country?: string) =>
    api.post('/api/household/', { name, country }),

  get: () => api.get('/api/household/'),

  getMembers: () => api.get('/api/household/members'),
}

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
export const documentService = {
  upload: async (asset: any, memberName?: string) => {
    const formData = new FormData()
    formData.append('file', {
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || 'document.jpg'
    } as any)
    if (memberName) formData.append('member_name', memberName)

    return api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  list: () => api.get('/api/documents/'),

  ask: (question: string) =>
    api.post('/api/documents/ask', { question }),

  getExpiring: () => api.get('/api/documents/expiring'),

  delete: (id: string) => api.delete(`/api/documents/${id}`),
}

export default api
