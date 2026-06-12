import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useHouseholdStore } from '../src/stores/householdStore';

export default function RootLayout() {
  const { session, isLoading: authLoading } = useAuthStore();
  const { household, isLoading: householdLoading } = useHouseholdStore();
  const segments = useSegments();
  const router = useRouter();

  const isAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (authLoading || householdLoading) return;

    if (!session && !isAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && isAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, authLoading, householdLoading, isAuthGroup]);

  if (authLoading || householdLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}