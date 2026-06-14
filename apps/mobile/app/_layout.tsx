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

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (session && !household && !householdLoading) {
      fetchHousehold();
    }
  }, [session]);

  useEffect(() => {
    if (authLoading || householdLoading) return;

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    else if (session && !household && !inOnboardingGroup && !inAuthGroup) {
      // Use push instead of replace to avoid race conditions with onboarding layout mount
      router.push('/onboarding/welcome');
    }
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