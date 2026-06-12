import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useHouseholdStore } from '../src/stores/householdStore';

export default function RootLayout() {
  const { session, loading: authLoading, loadSession } = useAuthStore();
  const { household, loading: householdLoading, fetchHousehold } = useHouseholdStore();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === 'onboarding';

  // Load session once when app starts
  useEffect(() => {
    loadSession();
  }, []);

  // Fetch household when user is logged in
  useEffect(() => {
    if (session && !household && !householdLoading) {
      fetchHousehold();
    }
  }, [session]);

  // Handle navigation redirects
  useEffect(() => {
    if (authLoading || householdLoading) return;

    // Not logged in → Login screen
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }

    // Logged in but no household → Onboarding
    else if (session && !household && !inOnboardingGroup && !inAuthGroup) {
      router.replace('/onboarding/welcome');
    }

    // Logged in with household but in auth/onboarding → Main app
    else if (session && household && (inAuthGroup || inOnboardingGroup)) {
      router.replace('/(tabs)');
    }
  }, [session, household, authLoading, householdLoading, inAuthGroup, inOnboardingGroup]);

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