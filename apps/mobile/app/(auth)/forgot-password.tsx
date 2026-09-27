import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const { forgotPassword } = useAuthStore()
  const router = useRouter()

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email.')
      return
    }
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      router.push({ pathname: '/(auth)/reset-password', params: { email: email.trim() } })
    } catch {
      Alert.alert('Could not send code', 'Please try again.')
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
            <View style={styles.icon}><Ionicons name="key-outline" size={26} color={H.purple} /></View>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>Enter your email and Hearth will send you a reset code.</Text>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={H.muted2} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!loading} />
              <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset code</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper }, safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 8, left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: H.white, borderWidth: 1, borderColor: H.line },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 30, fontWeight: '800', color: H.navy, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, color: H.muted, marginTop: 9, marginBottom: 24, lineHeight: 22 },
  card: { backgroundColor: H.white, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: H.lineSoft, ...HearthDesign.shadow.card },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: H.navy, marginBottom: 8 },
  input: { minHeight: 54, borderRadius: 16, backgroundColor: '#F8F7FA', borderWidth: 1, borderColor: H.line, paddingHorizontal: 15, fontSize: 16, color: H.navy, marginBottom: 16 },
  button: { minHeight: 54, borderRadius: 16, backgroundColor: H.navy, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
