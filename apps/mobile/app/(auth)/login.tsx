import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { householdService } from '../../src/services/api'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuthStore()
  const router = useRouter()

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Please enter your email and password.')
      return
    }

    Keyboard.dismiss()
    setLoading(true)
    try {
      await signIn(email, password)

      try {
        const householdRes = await householdService.get()
        if (householdRes.data && Object.keys(householdRes.data).length > 0) {
          router.replace('/(tabs)/dashboard')
        } else {
          router.replace('/onboarding/welcome')
        }
      } catch {
        router.replace('/onboarding/welcome')
      }
    } catch (error: any) {
      Alert.alert('Sign in failed', error.response?.data?.detail || error.message || 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.content}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Ionicons name="home-outline" size={23} color={H.navy} />
              </View>
              <Text style={styles.brandName}>Hearth HQ</Text>
            </View>

            <View style={styles.intro}>
              <Text style={styles.eyebrow}>WELCOME BACK</Text>
              <Text style={styles.title}>Your household,{"\n"}already organised.</Text>
              <Text style={styles.subtitle}>Sign in to pick up exactly where Hearth HQ left off.</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={19} color={H.muted2} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={H.muted2}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="username"
                  textContentType="username"
                />
              </View>

              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={19} color={H.muted2} />
                <TextInput
                  style={styles.input}
                  placeholder="Your password"
                  placeholderTextColor={H.muted2}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={H.muted} />
                </TouchableOpacity>
              </View>

              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity style={styles.forgotLink} disabled={loading}>
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
                activeOpacity={0.86}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkButton} disabled={loading}>
                <Text style={styles.linkText}>
                  New to Hearth HQ? <Text style={styles.linkTextBold}>Create an account</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: H.white, borderWidth: 1, borderColor: H.line,
    alignItems: 'center', justifyContent: 'center', ...HearthDesign.shadow.card,
  },
  brandName: { color: H.navy, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  intro: { marginTop: 52, marginBottom: 26 },
  eyebrow: { color: H.purple, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  title: { color: H.navy, fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: H.muted, fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 330 },
  formCard: {
    backgroundColor: H.white, borderRadius: 24, borderWidth: 1, borderColor: H.lineSoft,
    padding: 18, ...HearthDesign.shadow.card,
  },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: H.navy, marginBottom: 8, marginTop: 4 },
  inputWrap: {
    minHeight: 54, borderRadius: 16, backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: H.line,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 16,
  },
  input: { flex: 1, color: H.navy, fontSize: 16, paddingHorizontal: 11, paddingVertical: 14 },
  eyeButton: { padding: 6 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 18, marginTop: -4 },
  forgotLinkText: { fontSize: 13, color: H.purple, fontWeight: '700' },
  button: { backgroundColor: H.navy, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  linkButton: { marginTop: 22, alignItems: 'center' },
  linkText: { color: H.muted, fontSize: 14 },
  linkTextBold: { color: H.purple, fontWeight: '800' },
})
