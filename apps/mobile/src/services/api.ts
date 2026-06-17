import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getToken, removeToken, removeUser } from '../lib/authToken';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.175.202:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Unauthorized Handler ----
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  unauthorizedHandler = handler;
};

// ---- Request Interceptor ----
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Response Interceptor ----
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await removeToken();
      await removeUser();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authService = {
  signIn: (email: string, password: string) =>
    api.post('/api/auth/signin', { email, password }),
  signUp: (email: string, password: string, fullName?: string) =>
    api.post('/api/auth/signup', { email, password, full_name: fullName }),
  signOut: () => api.post('/api/auth/signout'),
};

// ==================== HOUSEHOLD ====================
export const householdService = {
  get: () => api.get('/api/household/'),
  create: (data: { name: string; address?: string; country?: string }) =>
    api.post('/api/household/', data),
  update: (householdId: string, data: { name?: string; address?: string; country?: string }) =>
    api.patch(`/api/household/${householdId}`, data),
  getMembers: () => api.get('/api/household/members'),
};

// ==================== DOCUMENTS ====================
export const documentService = {
  list: () => api.get('/api/documents/'),
  upload: (formData: FormData) =>
    api.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),
  delete: (id: string) => api.delete(`/api/documents/${id}`),
  getExpiring: () => api.get('/api/documents/expiring'),
  ask: (question: string) => api.post('/api/documents/ask', { question }),
};

// ==================== BILLS ====================
export const billService = {
  list: () => api.get('/api/bills/'),
  create: (data: any) => api.post('/api/bills/', data),
  analyze: (billData: any) => api.post('/api/bills/analyze', billData),
  detectUnused: (bills: any[]) => api.post('/api/bills/detect-unused', { bills }),
  negotiationScript: (provider: string, currentPlan: string, accountAgeMonths = 12) =>
    api.post('/api/bills/negotiation-script', {
      provider,
      current_plan: currentPlan,
      account_age_months: accountAgeMonths,
    }),
  monthlyReport: () => api.get('/api/bills/monthly-report'),
};

// ==================== GROCERY ====================
export const groceryService = {
  getInventory: () => api.get('/api/grocery/inventory'),
  addInventory: (item: any) => api.post('/api/grocery/inventory', item),
  generateMealPlan: (preferences?: any, inventory?: any[]) =>
    api.post('/api/grocery/meal-plan/generate', { preferences, inventory }),
  createShoppingList: (mealPlan: any, inventory?: any[]) =>
    api.post('/api/grocery/shopping-list', { meal_plan: mealPlan, inventory }),
  wasteAlert: (inventory: any[]) =>
    api.post('/api/grocery/waste-alert', { inventory }),
  modifyMeal: (currentPlan: any, day: string, newPreference: string) =>
    api.post('/api/grocery/meal-plan/modify', {
      current_plan: currentPlan,
      day,
      new_preference: newPreference,
    }),
};

// ==================== MAINTENANCE ====================
export const maintenanceService = {
  getTasks: () => api.get('/api/maintenance/tasks'),
  generateCalendar: (profile: any) =>
    api.post('/api/maintenance/calendar/generate', { home_profile: profile }),
  diagnose: (description: string, photos?: string[]) =>
    api.post('/api/maintenance/diagnose', { description, photos }),
  estimateCost: (appliance: string, issue: string) =>
    api.post('/api/maintenance/estimate-cost', { appliance, issue }),
  getDIYInstructions: (taskName: string) =>
    api.get(`/api/maintenance/diy/${encodeURIComponent(taskName)}`),
  completeTask: (taskId: string) =>
    api.post(`/api/maintenance/tasks/${taskId}/complete`),
};

// ==================== HEALTH ====================
export const healthService = {
  getMedications: () => api.get('/api/health/medications'),
  addMedication: (med: any) => api.post('/api/health/medications', med),
  triage: (symptoms: string, patientProfile?: any) =>
    api.post('/api/health/triage', { symptoms, patient_profile: patientProfile }),
  homeCare: (condition: string) =>
    api.post('/api/health/home-care', { condition }),
  medicationSchedule: (medications: any[]) =>
    api.post('/api/health/medication-schedule', { medications }),
};

// ==================== CHIEF OF STAFF ====================
export const chiefService = {
  chat: (message: string, conversationHistory: any[] = [], context?: any) =>
    api.post('/api/chief/chat', {
      message,
      conversation_history: conversationHistory,
      context: context || {},
    }),
  dashboardSummary: (householdData?: any) =>
    api.post('/api/chief/dashboard-summary', {
      household_data: householdData || {},
    }),
};

// ==================== AUTOMATION (Home Assistant) ====================
export const automationService = {
  getStatus: () =>
    api.get('/api/automation/status'),
  connect: (haInstanceUrl: string, haAccessToken: string) =>
    api.post('/api/automation/connect', {
      ha_instance_url: haInstanceUrl,
      ha_access_token: haAccessToken,
    }),
  getDevices: () =>
    api.get('/api/automation/devices'),
  getEvents: (limit = 20) =>
    api.get(`/api/automation/events?limit=${limit}`),
  executeAction: (entityId: string, action: string, payload: any = {}) =>
    api.post('/api/automation/action', { entity_id: entityId, action, payload }),
};

// ==================== NOTIFICATIONS ====================
export const notificationService = {
  registerToken: (token: string, deviceType: string) =>
    api.post('/api/notifications/register-token', { token, device_type: deviceType }),
  send: (data: any) => api.post('/api/notifications/send', data),
};

export default api;