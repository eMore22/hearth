import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="create-household" />
      <Stack.Screen name="add-members" />
      <Stack.Screen name="permissions" />
    </Stack>
  )
}