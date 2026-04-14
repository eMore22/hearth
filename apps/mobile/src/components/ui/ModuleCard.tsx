import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../utils/theme'

interface ModuleCardProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  color: string
  active?: boolean
  onPress: () => void
}

export default function ModuleCard({ 
  icon, 
  title, 
  subtitle, 
  color, 
  active = true, 
  onPress 
}: ModuleCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, !active && styles.cardInactive]}
      onPress={onPress}
      disabled={!active}
    >
      <View style={[styles.iconContainer, { backgroundColor: active ? color : COLORS.border }]}>
        <Ionicons name={`${icon}-outline` as any} size={24} color="#fff" />
      </View>
      <Text style={[styles.title, !active && styles.titleInactive]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {!active && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Soon</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '46%',
    margin: '2%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardInactive: { opacity: 0.6 },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  titleInactive: { color: COLORS.muted },
  subtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  comingSoonText: { fontSize: 10, color: COLORS.muted }
})