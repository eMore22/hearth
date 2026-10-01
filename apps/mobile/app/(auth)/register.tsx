import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Keyboard, KeyboardAvoidingView, Platform, Alert, ScrollView, StatusBar
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuthStore()
  const router = useRouter()

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords don\'t match', 'Please make sure both password fields match.')
      return
    }
    Keyboard.dismiss()
    setLoading(true)
    try {
      const result = await signUp(email, password, fullName)
      if (result.already_registered) {
        Alert.alert(
          'Account already exists',
          'An account with this email already exists. Try signing in, or use Forgot Password if you don\'t remember your password.',
          [
            { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
            { text: 'Forgot Password', onPress: () => router.push('/(auth)/forgot-password') },
          ]
        )
      } else {
        Alert.alert(
          'Account created!',
          'Check your email to verify your account, then sign in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        )
      }
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Ionicons name="home-outline" size={23} color={H.navy} /></View>
              <Text style={styles.brandName}>Hearth HQ</Text>
            </View>

            <View style={styles.intro}>
              <Text style={styles.eyebrow}>GET STARTED</Text>
              <Text style={styles.title}>A calmer home starts here.</Text>
              <Text style={styles.subtitle}>Create your account. Hearth HQ will guide you through the household setup next.</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <TextInput style={styles.input} placeholder="Jane Doe" placeholderTextColor={H.muted2} value={fullName} onChangeText={setFullName} autoCapitalize="words" editable={!loading} />

              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={H.muted2} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!loading} />

              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput style={styles.passwordInput} placeholder="At least 8 characters" placeholderTextColor={H.muted2} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!loading} />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={H.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirm password</Text>
              <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor={H.muted2} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} editable={!loading} returnKeyType="done" blurOnSubmit onSubmitEditing={() => Keyboard.dismiss()} />

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.86}>
                <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create account'}</Text>
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.linkRow} disabled={loading}>
                <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign in</Text></Text>
              </TouchableOpacity>
            </Link>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper },
  safeArea: { flex: 1 },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 34 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: H.white, borderWidth: 1, borderColor: H.line, alignItems: 'center', justifyContent: 'center', ...HearthDesign.shadow.card },
  brandName: { color: H.navy, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  intro: { marginTop: 38, marginBottom: 24 },
  eyebrow: { color: H.purple, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  title: { color: H.navy, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -1.1 },
  subtitle: { color: H.muted, fontSize: 15, lineHeight: 22, marginTop: 12 },
  formCard: { backgroundColor: H.white, borderRadius: 24, borderWidth: 1, borderColor: H.lineSoft, padding: 18, ...HearthDesign.shadow.card },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: H.navy, marginBottom: 8, marginTop: 4 },
  input: { minHeight: 54, backgroundColor: '#F8F7FA', borderRadius: 16, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, color: H.navy, borderWidth: 1, borderColor: H.line },
  passwordContainer: { minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: H.line, borderRadius: 16, marginBottom: 15 },
  passwordInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, color: H.navy },
  eyeButton: { paddingHorizontal: 14 },
  button: { backgroundColor: H.navy, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  linkRow: { marginTop: 22, alignItems: 'center' },
  linkText: { color: H.muted, fontSize: 14 },
  linkAccent: { color: H.purple, fontWeight: '800' },
})
