import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { householdService } from '../../src/services/api'
import { useAuthStore } from '../../src/stores/authStore'
import { COLORS, TYPOGRAPHY, SPACING } from '../../src/utils/theme'

export default function CreateHouseholdScreen() {
  const [householdName, setHouseholdName] = useState('')
  const [country, setCountry] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuthStore()

  const handleCreate = async () => {
    if (!householdName.trim()) {
      Alert.alert('Missing Info', 'Please enter a household name')
      return
    }

    setIsLoading(true)
    try {
      await householdService.create(householdName.trim(), country.trim() || undefined)
      router.push('/onboarding/add-members')
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create household')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>Step 1 of 3</Text>
        <Text style={styles.title}>Create your household</Text>
        <Text style={styles.description}>
          Give your household a name. This is where all your family's information will live.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Household name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., The Smith Family"
            value={householdName}
            onChangeText={setHouseholdName}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Country (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., United States"
            value={country}
            onChangeText={setCountry}
            autoCapitalize="words"
          />
        </View>

        <Text style={styles.hint}>
          {user?.email ? `You'll be the owner: ${user.email}` : ''}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!householdName.trim() || isLoading) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!householdName.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  stepIndicator: {
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.heading2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  form: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.body,
  },
  hint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
    marginTop: SPACING.sm,
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...TYPOGRAPHY.body,
    color: '#fff',
    fontWeight: '600',
  },
})