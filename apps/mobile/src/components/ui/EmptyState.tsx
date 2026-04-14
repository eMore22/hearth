import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../utils/theme'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ 
  icon = 'folder-open', 
  title, 
  message, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={`${icon}-outline` as any} size={64} color={COLORS.muted} />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center'
  },
  message: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 8,
    textAlign: 'center'
  },
  button: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15
  }
})