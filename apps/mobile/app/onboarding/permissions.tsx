import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useCameraPermissions } from 'expo-camera'
import { COLORS, TYPOGRAPHY, SPACING } from '../../src/utils/theme'

// Notifications temporarily disabled in Expo Go
// import * as Notifications from 'expo-notifications'

interface PermissionItem {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  granted: boolean | null
  loading: boolean
}

export default function PermissionsScreen() {
  const [cameraPerms, requestCameraPerms] = useCameraPermissions()
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      id: 'camera',
      icon: 'camera',
      title: 'Camera',
      description: 'Scan documents and receipts',
      granted: cameraPerms?.granted ?? null,
      loading: false,
    },
    // Notifications disabled for Expo Go testing
    // {
    //   id: 'notifications',
    //   icon: 'notifications',
    //   title: 'Notifications',
    //   description: 'Get alerts for expiries, bills, and reminders',
    //   granted: null,
    //   loading: false,
    // },
  ])

  const requestPermission = async (id: string) => {
    setPermissions(prev => prev.map(p => (p.id === id ? { ...p, loading: true } : p)))

    try {
      if (id === 'camera') {
        const result = await requestCameraPerms()
        setPermissions(prev =>
          prev.map(p =>
            p.id === id
              ? { ...p, granted: result?.granted ?? false, loading: false }
              : p
          )
        )
      }
      // Notifications disabled
      // else if (id === 'notifications') {
      //   const { status } = await Notifications.requestPermissionsAsync()
      //   setPermissions(prev =>
      //     prev.map(p =>
      //       p.id === id
      //         ? { ...p, granted: status === 'granted', loading: false }
      //         : p
      //     )
      //   )
      // }
    } catch (error) {
      Alert.alert('Error', 'Could not request permission')
      setPermissions(prev => prev.map(p => (p.id === id ? { ...p, loading: false } : p)))
    }
  }

  const handleFinish = () => {
    router.replace('/(tabs)/dashboard')
  }

  const allGranted = permissions.every(p => p.granted === true)
  const anyLoading = permissions.some(p => p.loading)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>Step 3 of 3</Text>
        <Text style={styles.title}>Enable permissions</Text>
        <Text style={styles.description}>
          Hearth works best with these permissions. You can always change them later in settings.
        </Text>
      </View>

      <View style={styles.permissionsList}>
        {permissions.map(perm => (
          <View key={perm.id} style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name={`${perm.icon}-outline`} size={28} color={COLORS.primary} />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>{perm.title}</Text>
              <Text style={styles.permissionDescription}>{perm.description}</Text>
            </View>
            {perm.granted ? (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            ) : (
              <TouchableOpacity
                style={[styles.allowButton, perm.loading && styles.allowButtonDisabled]}
                onPress={() => requestPermission(perm.id)}
                disabled={perm.loading}
              >
                {perm.loading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.allowButtonText}>Allow</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, anyLoading && styles.buttonDisabled]}
          onPress={handleFinish}
          disabled={anyLoading}
        >
          <Text style={styles.buttonText}>
            {allGranted ? 'Finish Setup' : 'Continue to App'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          You can manage permissions anytime in your device settings.
        </Text>
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
    marginBottom: SPACING.xl,
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
  },
  permissionsList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  permissionDescription: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.muted,
  },
  allowButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  allowButtonDisabled: {
    opacity: 0.5,
  },
  allowButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '600',
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
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...TYPOGRAPHY.body,
    color: '#fff',
    fontWeight: '600',
  },
  footerNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
    textAlign: 'center',
  },
})