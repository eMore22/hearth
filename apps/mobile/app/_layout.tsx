import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../src/stores/authStore'
import { householdService } from '../src/services/api'

export default function RootLayout() {
  const { session, loadSession, isLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inTabs = segments[0] === '(tabs)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && !inOnboarding && !inTabs) {
      checkHouseholdAndRoute()
    }
  }, [isMounted, session, segments, isLoading])

  const checkHouseholdAndRoute = async () => {
    try {
      const response = await householdService.get()
      if (response.data) {
        router.replace('/(tabs)/dashboard')
      } else {
        router.replace('/onboarding/welcome')
      }
    } catch (error) {
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
        {/* Removed duplicate chief-of-staff route */}
      </Stack>
    </GestureHandlerRootView>
  )
}