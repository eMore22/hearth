import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getToken, removeToken, removeUser } from '../lib/authToken';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://hearth-hq.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  unauthorizedHandler = handler;
};

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

export const authService = {
  signIn: (email: string, password: string) =>
    api.post('/api/auth/signin', { email, password }),
  signUp: (email: string, password: string, fullName?: string) =>
    api.post('/api/auth/signup', { email, password, full_name: fullName }),
  signOut: () => api.post('/api/auth/signout'),
};

export const householdService = {
  get: () => api.get('/api/household/'),
  create: (data: { name: string; address?: string; country?: string; currency?: string; timezone?: string }) =>
    api.post('/api/household/', data),
  update: (householdId: string, data: { name?: string; address?: string; country?: string; currency?: string; timezone?: string }) =>
    api.patch(`/api/household/${householdId}`, data),
  getMembers: () => api.get('/api/household/members'),
};

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

// ==================== GROCERY (with currency support) ====================
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
  saveMealPlan: (mealPlan: any) =>
    api.post('/api/grocery/meal-plan/save', { meal_plan: mealPlan }),
  generateBudgetShoppingList: (mealPlan: any, weeklyBudget: number) =>
    api.post('/api/grocery/shopping-list/generate', { meal_plan: mealPlan, weekly_budget: weeklyBudget }),
  getBudget: () =>
    api.get('/api/grocery/budget'),
  setBudget: (weeklyBudget: number, currency?: string) =>
    api.put('/api/grocery/budget', { weekly_budget: weeklyBudget, currency }),
};

export const maintenanceService = {
  getTasks: () => api.get('/api/maintenance/tasks'),
  // Backend endpoint exists (POST /api/maintenance/tasks) but nothing in
  // maintenanceStore.ts calls this yet — no "Add Maintenance Task" UI
  // exists. Adding the service function now so it's reachable whenever
  // that UI gets built; not wiring a new screen for it in this pass.
  createTask: (data: any) => api.post('/api/maintenance/tasks', data),
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
  getHistory: () => api.get('/api/chief/history'),
  clearHistory: () => api.delete('/api/chief/history'),
};

export const automationService = {
  getStatus: () => api.get('/api/automation/status'),
  connect: (haInstanceUrl: string, haAccessToken: string) =>
    api.post('/api/automation/connect', {
      ha_instance_url: haInstanceUrl,
      ha_access_token: haAccessToken,
    }),
  getDevices: () => api.get('/api/automation/devices'),
  getEvents: (limit = 20) => api.get(`/api/automation/events?limit=${limit}`),
  executeAction: (entityId: string, action: string, payload: any = {}) =>
    api.post('/api/automation/action', { entity_id: entityId, action, payload }),
};

export const notificationService = {
  registerToken: (token: string, deviceType: string) =>
    api.post('/api/notifications/register-token', { token, device_type: deviceType }),
  send: (data: any) => api.post('/api/notifications/send', data),
};

export const taskService = {
  list: () => api.get('/api/tasks/'),
  create: (title: string, notes?: string, dueAt?: string) =>
    api.post('/api/tasks/', { title, notes, due_at: dueAt }),
  complete: (taskId: string) => api.post(`/api/tasks/${taskId}/complete`),
  delete: (taskId: string) => api.delete(`/api/tasks/${taskId}`),
};

export default api;