import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../src/stores/authStore'
import { householdService } from '../src/services/api'
import { registerForPushNotificationsAsync } from '../src/services/notifications'

export default function RootLayout() {
  const { session, loadSession, isLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inTabs = segments[0] === '(tabs)'

    if (!session && !inAuthGroup) {
      // Not logged in -> go to login
      router.replace('/(auth)/login')
    } else if (session && !inOnboarding && !inTabs) {
      // Logged in but not in onboarding or tabs -> check household
      checkHouseholdAndRoute()
    }
  }, [session, segments, isLoading])

  // Register for push notifications when logged in
  useEffect(() => {
    if (session) {
      registerForPushNotificationsAsync()
    }
  }, [session])

  const checkHouseholdAndRoute = async () => {
    try {
      const response = await householdService.get()
      if (response.data) {
        // Has household -> go to dashboard
        router.replace('/(tabs)/dashboard')
      } else {
        // No household -> go to onboarding
        router.replace('/onboarding/welcome')
      }
    } catch (error) {
      // Error or no household -> onboarding
      router.replace('/onboarding/welcome')
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="chief-of-staff" />
      </Stack>
    </GestureHandlerRootView>
  )
}