import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { authService } from '../services/api'

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
    const token = await SecureStore.getItemAsync('access_token')
    const userStr = await SecureStore.getItemAsync('user')
    if (token && userStr) {
      set({ session: token, user: JSON.parse(userStr), loading: false })
    } else {
      set({ loading: false })
    }
  },

  signIn: async (email, password) => {
    const res = await authService.signIn(email, password)
    const { access_token, user } = res.data
    await SecureStore.setItemAsync('access_token', access_token)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    set({ session: access_token, user })
  },

  signUp: async (email, password, fullName) => {
    await authService.signUp(email, password, fullName)
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync('access_token')
    await SecureStore.deleteItemAsync('user')
    set({ session: null, user: null })
  }
}))
