import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface AlertBannerProps {
  type: 'warning' | 'error' | 'info' | 'success'
  message: string
  onDismiss?: () => void
  onPress?: () => void
}

export default function AlertBanner({ type, message, onDismiss, onPress }: AlertBannerProps) {
  const getColors = () => {
    switch (type) {
      case 'warning': return { bg: '#FFF3CD', border: '#FFC107', icon: 'warning', text: '#856404' }
      case 'error': return { bg: '#F8D7DA', border: '#DC3545', icon: 'alert-circle', text: '#721C24' }
      case 'success': return { bg: '#D4EDDA', border: '#28A745', icon: 'checkmark-circle', text: '#155724' }
      default: return { bg: '#D1ECF1', border: '#17A2B8', icon: 'information-circle', text: '#0C5460' }
    }
  }

  const colors = getColors()

  const Content = (
    <View style={[styles.container, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}>
      <Ionicons name={colors.icon as any} size={20} color={colors.text} style={styles.icon} />
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{Content}</TouchableOpacity>
  }

  return Content
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    marginVertical: 4
  },
  icon: { marginRight: 10 },
  message: { flex: 1, fontSize: 14 },
  dismissButton: { padding: 4, marginLeft: 8 }
})
