import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useHouseholdStore } from '../src/stores/householdStore';
import { setUnauthorizedHandler } from '../src/services/api';

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

  // If any request comes back 401 (token actually expired/invalid), clear
  // session + household state so the redirect effect below sends the user
  // back to login — instead of leaving the app "logged in" while every
  // request silently 401s with a wiped token.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      useAuthStore.setState({ session: null, user: null });
      useHouseholdStore.getState().clearHousehold();
    });
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