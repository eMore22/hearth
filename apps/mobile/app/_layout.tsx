import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useHouseholdStore } from '../src/stores/householdStore';

export default function RootLayout() {
  const { session, isLoading: authLoading } = useAuthStore();
  const { household, isLoading: householdLoading, fetchHousehold } = useHouseholdStore();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === 'onboarding';

  // Fetch household when user logs in
  useEffect(() => {
    if (session && !household && !householdLoading) {
      fetchHousehold();
    }
  }, [session]);

  // Handle navigation logic
  useEffect(() => {
    if (authLoading || householdLoading) return;

    // Not logged in → go to login
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }

    // Logged in but no household → go to onboarding
    else if (session && !household && !inOnboardingGroup && !inAuthGroup) {
      router.replace('/onboarding/welcome');
    }

    // Logged in with household but in auth/onboarding → go to tabs
    else if (session && household && (inAuthGroup || inOnboardingGroup)) {
      router.replace('/(tabs)');
    }
  }, [session, household, authLoading, householdLoading, inAuthGroup, inOnboardingGroup]);

  // Show loading screen
  if (authLoading || householdLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A1628' }}>
        <ActivityIndicator size="large" color="#C77DFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}