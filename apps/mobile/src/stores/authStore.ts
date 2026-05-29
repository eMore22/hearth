import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { authService, setAuthToken, clearAuthToken } from '../services/api'

interface AuthState {
  session: string | null
  user: any | null
  loading: boolean
  loadSession: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

// Check if JWT is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    )
    // Add 30 second buffer to avoid edge cases
    return payload.exp * 1000 < Date.now() + 30000
  } catch {
    return true
  }
}

const clearStoredSession = async () => {
  await SecureStore.deleteItemAsync('access_token')
  await SecureStore.deleteItemAsync('refresh_token')
  await SecureStore.deleteItemAsync('user')
  clearAuthToken()
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token')
      const refreshToken = await SecureStore.getItemAsync('refresh_token')
      const userStr = await SecureStore.getItemAsync('user')

      if (!token || !userStr) {
        set({ loading: false })
        return
      }

      // Token is still valid — restore session
      if (!isTokenExpired(token)) {
        setAuthToken(token)
        set({ session: token, user: JSON.parse(userStr), loading: false })
        return
      }

      // Token expired — try to refresh
      if (refreshToken) {
        try {
          const res = await authService.refresh(refreshToken)
          const { access_token, refresh_token: newRefresh } = res.data

          await SecureStore.setItemAsync('access_token', access_token)
          if (newRefresh) {
            await SecureStore.setItemAsync('refresh_token', newRefresh)
          }

          setAuthToken(access_token)
          set({ session: access_token, user: JSON.parse(userStr), loading: false })
          return
        } catch {
          // Refresh failed — force re-login
        }
      }

      // Could not refresh — clear and go to login
      await clearStoredSession()
      set({ session: null, user: null, loading: false })

    } catch {
      await clearStoredSession()
      set({ session: null, user: null, loading: false })
    }
  },

  signIn: async (email, password) => {
    const res = await authService.signIn(email, password)
    const { access_token, refresh_token, user } = res.data

    await SecureStore.setItemAsync('access_token', access_token)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    if (refresh_token) {
      await SecureStore.setItemAsync('refresh_token', refresh_token)
    }

    // Set in memory immediately — this is critical
    setAuthToken(access_token)
    set({ session: access_token, user })
  },

  signUp: async (email, password, fullName) => {
    await authService.signUp(email, password, fullName)
  },

  signOut: async () => {
    try { await authService.signOut() } catch {}
    await clearStoredSession()
    set({ session: null, user: null })
  },
}))