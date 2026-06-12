import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useHouseholdStore } from '../../src/stores/householdStore';

export default function OnboardingLayout() {
  const { fetchHousehold } = useHouseholdStore();

  useEffect(() => {
    fetchHousehold();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="create-household" />
      <Stack.Screen name="add-members" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}