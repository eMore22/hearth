import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'
import { householdService } from '../../src/services/api'
import { COLORS, TYPOGRAPHY, SPACING } from '../../src/utils/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuthStore()
  const router = useRouter()

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }

    setLoading(true)
    console.log('📤 Submitting signin...');
    try {
      await signIn(email, password)
      console.log('🎉 signIn completed successfully');
      
      // Check if household exists and navigate accordingly
      try {
        const householdRes = await householdService.get()
        console.log('🏠 Household check:', householdRes.data);
        if (householdRes.data && Object.keys(householdRes.data).length > 0) {
          console.log('➡️ Navigating to dashboard');
          router.replace('/(tabs)/dashboard')
        } else {
          console.log('➡️ Navigating to onboarding');
          router.replace('/onboarding/welcome')
        }
      } catch (householdError) {
        console.log('🏠 No household found, going to onboarding');
        router.replace('/onboarding/welcome')
      }
    } catch (error: any) {
      console.log('❌ signIn error:', error);
      Alert.alert('Sign In Failed', error.response?.data?.detail || error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Hearth</Text>
          <Text style={styles.subtitle}>Your household's AI chief of staff</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkButton} disabled={loading}>
                <Text style={styles.linkText}>
                  Don't have an account? <Text style={styles.linkTextBold}>Create one</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.heading1,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    ...TYPOGRAPHY.body,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...TYPOGRAPHY.body,
    color: '#fff',
    fontWeight: '600',
  },
  linkButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  linkText: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
  },
  linkTextBold: {
    color: COLORS.primary,
    fontWeight: '600',
  },
})