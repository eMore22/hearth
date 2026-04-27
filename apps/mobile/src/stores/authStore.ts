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
    console.log('📂 loadSession called');
    const token = await SecureStore.getItemAsync('access_token')
    const userStr = await SecureStore.getItemAsync('user')
    console.log('📂 Token from storage:', token ? 'present' : 'missing');
    if (token && userStr) {
      set({ session: token, user: JSON.parse(userStr), loading: false })
      console.log('📂 Session restored from storage');
    } else {
      set({ loading: false })
      console.log('📂 No session found in storage');
    }
  },

  signIn: async (email, password) => {
    console.log('🔐 signIn called with email:', email);
    const res = await authService.signIn(email, password)
    const { access_token, user } = res.data
    console.log('✅ signIn response received, token:', access_token ? 'present' : 'MISSING');
    await SecureStore.setItemAsync('access_token', access_token)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    console.log('💾 Token stored in SecureStore');
    set({ session: access_token, user })
    console.log('🔄 Zustand state updated, session:', access_token ? 'set' : 'null');
  },

  signUp: async (email, password, fullName) => {
    console.log('📝 signUp called with email:', email);
    await authService.signUp(email, password, fullName)
    console.log('📝 signUp completed');
  },

  signOut: async () => {
    console.log('🚪 signOut called');
    await SecureStore.deleteItemAsync('access_token')
    await SecureStore.deleteItemAsync('user')
    set({ session: null, user: null })
    console.log('🚪 Session cleared');
  }
}))