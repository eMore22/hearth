import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

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
    if (!code.trim()) { Alert.alert('Missing code', 'Please enter the code from your email.'); return }
    if (newPassword.length < 8) { Alert.alert('Weak password', 'Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { Alert.alert('Passwords do not match', 'Please check both password fields.'); return }

    setLoading(true)
    try {
      await resetPassword(email, code.trim(), newPassword)
      Alert.alert('Password updated', 'Please sign in with your new password.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }])
    } catch {
      Alert.alert('Invalid code', 'The code may be invalid or expired. Please request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={H.navy} />
            </TouchableOpacity>
            <View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={27} color={H.purple} /></View>
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.subtitle}>Enter the code sent to {email || 'your email'}, then set a new password.</Text>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Reset code</Text>
              <TextInput style={styles.input} placeholder="6-digit code" placeholderTextColor={H.muted2} value={code} onChangeText={setCode} keyboardType="number-pad" editable={!loading} />

              <Text style={styles.fieldLabel}>New password</Text>
              <View style={styles.passwordContainer}>
                <TextInput style={styles.passwordInput} placeholder="At least 8 characters" placeholderTextColor={H.muted2} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} editable={!loading} />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={H.muted} /></TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirm new password</Text>
              <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor={H.muted2} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} editable={!loading} />

              <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper }, safeArea: { flex: 1 }, content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 8, left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: H.white, borderWidth: 1, borderColor: H.line },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: H.navy, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, color: H.muted, marginTop: 9, marginBottom: 24, lineHeight: 22 },
  card: { backgroundColor: H.white, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: H.lineSoft, ...HearthDesign.shadow.card },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: H.navy, marginBottom: 8 },
  input: { minHeight: 54, borderRadius: 16, backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: H.line, paddingHorizontal: 15, fontSize: 16, color: H.navy, marginBottom: 15 },
  passwordContainer: { minHeight: 54, borderRadius: 16, backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: H.line, flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  passwordInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, color: H.navy }, eyeButton: { paddingHorizontal: 14 },
  button: { minHeight: 54, borderRadius: 16, backgroundColor: H.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
