import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useHouseholdStore } from '../src/stores/householdStore';
import { setUnauthorizedHandler } from '../src/services/api';

export default function RootLayout() {
  const { session, loading: authLoading, loadSession } = useAuthStore();
  const { household, loading: householdLoading, fetchHousehold } = useHouseholdStore();
  const segments  = useSegments();
  const router    = useRouter();

  // ── Navigation guards ─────────────────────────────────────────────────────
  // Prevent the redirect effect from firing more than once per state change.
  // Without these, a session + no-household state triggers fetchHousehold →
  // re-render → effect fires again → fetchHousehold → infinite loop.
  const hasCheckedHousehold = useRef(false);
  const isNavigating        = useRef(false);

  const inAuthGroup       = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === 'onboarding';

  // Load session once on mount
  useEffect(() => {
    loadSession();
  }, []);

  // Register global unauthorized handler (clears session on 401)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      hasCheckedHousehold.current = false;
      isNavigating.current        = false;
      useAuthStore.setState({ session: null, user: null });
      useHouseholdStore.getState().clearHousehold();
    });
  }, []);

  // Fetch household exactly once when session becomes available
  useEffect(() => {
    if (session && !hasCheckedHousehold.current && !householdLoading) {
      hasCheckedHousehold.current = true;
      fetchHousehold();
    }
    // Reset guard when session is cleared (logout)
    if (!session) {
      hasCheckedHousehold.current = false;
    }
  }, [session]);

  // Navigate based on auth + household state — fires only once per decision
  useEffect(() => {
    // Wait until both loading states settle
    if (authLoading || householdLoading) return;
    // Don't navigate if we're already mid-navigation
    if (isNavigating.current) return;

    if (!session) {
      // Not logged in → login
      if (!inAuthGroup) {
        isNavigating.current = true;
        router.replace('/(auth)/login');
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
      return;
    }

    // Logged in but household fetch hasn't been triggered yet — wait
    if (!hasCheckedHousehold.current) return;

    if (!household) {
      // Logged in, no household → onboarding
      if (!inOnboardingGroup && !inAuthGroup) {
        isNavigating.current = true;
        router.replace('/onboarding/welcome');
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
    } else {
      // Logged in with household → main app
      if (inAuthGroup || inOnboardingGroup) {
        isNavigating.current = true;
        router.replace('/(tabs)/dashboard');
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
    }
  }, [session, household, authLoading, householdLoading]);

  if (authLoading) {
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