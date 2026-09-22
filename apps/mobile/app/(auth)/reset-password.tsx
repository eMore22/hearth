import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'

const NAVY = '#0A1628'
const SURFACE = '#162035'
const ACCENT = '#4FC3F7'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'

export default function ResetPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const [email] = useState(emailParam || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuthStore()
  const router = useRouter()

  const handleSubmit = async () => {
    if (!code.trim()) { Alert.alert('Error', 'Please enter the code from your email'); return }
    if (newPassword.length < 8) { Alert.alert('Weak password', 'Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return }

    setLoading(true)
    try {
      await resetPassword(email, code.trim(), newPassword)
      Alert.alert(
        'Password updated',
        'Please sign in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      )
    } catch (err: any) {
      Alert.alert('Error', 'Invalid or expired code. Please request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={WHITE} />
            </TouchableOpacity>

            <Text style={styles.title}>Enter Reset Code</Text>
            <Text style={styles.subtitle}>
              Check {email || 'your email'} for a code, then set a new password.
            </Text>

            <Text style={styles.fieldLabel}>Reset Code</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={MUTED}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              editable={!loading}
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Min 8 characters"
                placeholderTextColor={MUTED}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor={MUTED}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={NAVY} /> : <Text style={styles.buttonText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  backBtn: { position: 'absolute', top: 12, left: 0, padding: 8 },
  title: { fontSize: 26, fontWeight: '700', color: WHITE, marginBottom: 10 },
  subtitle: { fontSize: 14, color: MUTED, marginBottom: 28, lineHeight: 20 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },
  input: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
    fontSize: 15, color: WHITE,
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 16,
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: WHITE },
  eyeButton: { paddingHorizontal: 14 },
  button: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 15, color: NAVY, fontWeight: '700' },
})
