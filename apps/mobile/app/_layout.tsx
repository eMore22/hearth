import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useHouseholdStore } from '../src/stores/householdStore';
import { setUnauthorizedHandler } from '../src/services/api';
import { registerForPushNotificationsAsync } from '../src/services/notifications';
import { ThemeProvider } from '../src/theme/ThemeContext';

export default function RootLayout() {
  const { session, loading: authLoading, loadSession } = useAuthStore();
  const { household, loading: householdLoading, fetchHousehold } = useHouseholdStore();
  const segments  = useSegments();
  const router    = useRouter();

  const hasCheckedHousehold = useRef(false);
  const isNavigating        = useRef(false);
  const hasRegisteredPush   = useRef(false);

  const inAuthGroup       = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === 'onboarding';

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      hasCheckedHousehold.current = false;
      isNavigating.current        = false;
      useAuthStore.setState({ session: null, user: null });
      useHouseholdStore.getState().clearHousehold();
    });
  }, []);

  useEffect(() => {
    if (session && !hasCheckedHousehold.current && !householdLoading) {
      hasCheckedHousehold.current = true;
      fetchHousehold();
    }
    if (!session) {
      hasCheckedHousehold.current = false;
    }
  }, [session]);

  useEffect(() => {
    if (session && !hasRegisteredPush.current) {
      hasRegisteredPush.current = true;
      registerForPushNotificationsAsync().catch((err) => {
        console.log('Push registration failed (non-fatal):', err);
      });
    }
    if (!session) {
      hasRegisteredPush.current = false;
    }
  }, [session]);

  useEffect(() => {
    if (authLoading || householdLoading) return;
    if (isNavigating.current) return;

    if (!session) {
      if (!inAuthGroup) {
        isNavigating.current = true;
        router.replace('/(auth)/login');
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
      return;
    }

    if (!hasCheckedHousehold.current) return;

    if (!household) {
      if (!inOnboardingGroup && !inAuthGroup) {
        isNavigating.current = true;
        router.replace('/onboarding/welcome');
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
    } else {
      if (inAuthGroup || inOnboardingGroup) {
        isNavigating.current = true;
        router.replace('/(tabs)/dashboard');
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
    }
  }, [session, household, authLoading, householdLoading]);

  if (authLoading) {
    return (
      <ThemeProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A1628' }}>
          <ActivityIndicator size="large" color="#C77DFF" />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
