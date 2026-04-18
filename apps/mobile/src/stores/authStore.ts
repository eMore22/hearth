import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { authService, setAuthToken } from '../services/api'

interface AuthState {
  session: string | null
  user: any | null
  loading: boolean
  loadSession: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token')
      const userStr = await SecureStore.getItemAsync('user')
      if (token && userStr) {
        // Set token in memory cache immediately so interceptor has it
        setAuthToken(token)
        set({ session: token, user: JSON.parse(userStr), loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  signIn: async (email, password) => {
    const res = await authService.signIn(email, password)
    const { access_token, user } = res.data
    // Save to secure storage
    await SecureStore.setItemAsync('access_token', access_token)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    // Set in memory cache immediately — this is what fixes the 401s
    setAuthToken(access_token)
    set({ session: access_token, user })
  },

  signUp: async (email, password, fullName) => {
    await authService.signUp(email, password, fullName)
    // Don't auto sign-in — user needs to verify email first
  },

  signOut: async () => {
    try { await authService.signOut() } catch {}
    await SecureStore.deleteItemAsync('access_token')
    await SecureStore.deleteItemAsync('user')
    setAuthToken(null)
    set({ session: null, user: null })
  }
}))