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

// ─── BILLS ───────────────────────────────────────────────────────────────────
export const billService = {
  list: () => api.get('/api/bills/'),

  create: (data: any) => api.post('/api/bills/', data),

  analyze: (billData: any) => api.post('/api/bills/analyze', billData),

  detectUnused: (bills?: any[]) => api.post('/api/bills/detect-unused', { bills }),

  negotiationScript: (provider: string, currentPlan: string, accountAgeMonths?: number) =>
    api.post('/api/bills/negotiation-script', {
      provider,
      current_plan: currentPlan,
      account_age_months: accountAgeMonths || 12,
    }),

  monthlyReport: () => api.get('/api/bills/monthly-report'),
}

// ─── GROCERY ─────────────────────────────────────────────────────────────────
export const groceryService = {
  generateMealPlan: (preferences: any, inventory?: any[]) =>
    api.post('/api/grocery/meal-plan/generate', { preferences, inventory }),

  createShoppingList: (mealPlan: any, inventory?: any[]) =>
    api.post('/api/grocery/shopping-list', { meal_plan: mealPlan, inventory }),

  wasteAlert: (inventory: any[]) => api.post('/api/grocery/waste-alert', { inventory }),

  modifyMeal: (currentPlan: any, day: string, newPreference: string) =>
    api.post('/api/grocery/meal-plan/modify', {
      current_plan: currentPlan,
      day,
      new_preference: newPreference,
    }),

  getInventory: () => api.get('/api/grocery/inventory'),

  addInventory: (item: any) => api.post('/api/grocery/inventory', item),
}

// ─── MAINTENANCE ─────────────────────────────────────────────────────────────
export const maintenanceService = {
  generateCalendar: (homeProfile: any) =>
    api.post('/api/maintenance/calendar/generate', { home_profile: homeProfile }),

  diagnose: (description: string, photos?: string[]) =>
    api.post('/api/maintenance/diagnose', { description, photos }),

  estimateCost: (appliance: string, issue: string) =>
    api.post('/api/maintenance/estimate-cost', { appliance, issue }),

  getDIYInstructions: (taskName: string) =>
    api.get(`/api/maintenance/diy/${encodeURIComponent(taskName)}`),

  getTasks: () => api.get('/api/maintenance/tasks'),

  completeTask: (taskId: string) => api.post(`/api/maintenance/tasks/${taskId}/complete`),
}

// ─── HEALTH ──────────────────────────────────────────────────────────────────
export const healthService = {
  triage: (symptoms: string, patientProfile?: any) =>
    api.post('/api/health/triage', { symptoms, patient_profile: patientProfile }),

  homeCare: (condition: string) => api.post('/api/health/home-care', { condition }),

  medicationSchedule: (medications: any[]) =>
    api.post('/api/health/medication-schedule', { medications }),

  getMedications: () => api.get('/api/health/medications'),

  addMedication: (med: any) => api.post('/api/health/medications', med),
}

// ─── CHIEF OF STAFF ──────────────────────────────────────────────────────────
export const chiefService = {
  chat: (message: string, context?: any) =>
    api.post('/api/chief/chat', { message, context }),

  dashboardSummary: (householdData?: any) =>
    api.post('/api/chief/dashboard-summary', { household_data: householdData }),
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
export const notificationService = {
  registerToken: (token: string, deviceType: 'ios' | 'android') =>
    api.post('/api/notifications/register-token', { token, device_type: deviceType }),
}

export default api