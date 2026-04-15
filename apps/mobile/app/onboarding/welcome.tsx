import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS, TYPOGRAPHY, SPACING } from '../../src/utils/theme'

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={styles.title}>Hearth</Text>
          <Text style={styles.subtitle}>Your household's AI chief of staff</Text>
        </View>

        <View style={styles.features}>
          <FeatureItem icon="📄" text="Document Vault with expiry alerts" />
          <FeatureItem icon="💰" text="Bill & subscription intelligence" />
          <FeatureItem icon="🥑" text="Meal planning & grocery lists" />
          <FeatureItem icon="🔧" text="Home maintenance reminders" />
          <FeatureItem icon="🏥" text="Family health triage" />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/onboarding/create-household')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)/dashboard')}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.heading1,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    textAlign: 'center',
  },
  features: {
    marginTop: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
    width: 32,
  },
  featureText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
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
    marginBottom: SPACING.md,
  },
  buttonText: {
    ...TYPOGRAPHY.body,
    color: '#fff',
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.muted,
  },
})