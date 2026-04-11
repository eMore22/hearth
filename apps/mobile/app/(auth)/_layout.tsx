import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'

export default function AuthLayout() {
  const { session } = useAuthStore()

  if (session) return <Redirect href="/(tabs)/dashboard" />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
