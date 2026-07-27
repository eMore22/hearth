import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, StatusBar
} from 'react-native'
import { Link, router } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'

const NAVY = '#0A1628'
const SURFACE = '#162035'
const ACCENT = '#4FC3F7'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuthStore()

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, fullName)
      Alert.alert(
        'Account created!',
        'Check your email to verify your account, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      )
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <Text style={styles.title}>Hearth</Text>
          <Text style={styles.tagline}>Set up your household in 60 seconds</Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Jane Doe"
            placeholderTextColor={MUTED}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            editable={!loading}
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={MUTED}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 8 characters"
            placeholderTextColor={MUTED}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.linkRow} disabled={loading}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  keyboardView: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(79,195,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.25)',
  },
  logoIcon: { fontSize: 26, color: ACCENT },
  title: { fontSize: 32, fontWeight: '700', color: WHITE, textAlign: 'center', marginBottom: 6 },
  tagline: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 32 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 4,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 15,
    color: WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  button: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: NAVY, fontSize: 15, fontWeight: '700' },
  linkRow: { marginTop: 22, alignItems: 'center' },
  linkText: { color: MUTED, fontSize: 14 },
  linkAccent: { color: ACCENT, fontWeight: '600' },
})
