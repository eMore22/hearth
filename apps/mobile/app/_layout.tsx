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
    console.log('🧭 Navigation check:', { 
      isMounted, 
      isLoading, 
      session: !!session, 
      segment: segments[0] 
    });
    
    if (!isMounted || isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inTabs = segments[0] === '(tabs)'

    if (!session && !inAuthGroup) {
      console.log('➡️ No session, redirecting to login');
      router.replace('/(auth)/login')
    } else if (session && !inOnboarding && !inTabs) {
      console.log('➡️ Session exists, checking household...');
      checkHouseholdAndRoute()
    }
  }, [isMounted, session, segments, isLoading])

  const checkHouseholdAndRoute = async () => {
    try {
      const response = await householdService.get()
      console.log('🏠 Household response:', response.data);
      if (response.data && Object.keys(response.data).length > 0) {
        console.log('➡️ Household found, redirecting to dashboard');
        router.replace('/(tabs)/dashboard')
      } else {
        console.log('➡️ No household, redirecting to onboarding');
        router.replace('/onboarding/welcome')
      }
    } catch (error) {
      console.log('❌ Household check error, going to onboarding');
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
      </Stack>
    </GestureHandlerRootView>
  )
}