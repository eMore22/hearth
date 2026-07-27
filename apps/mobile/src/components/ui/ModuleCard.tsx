import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const SURFACE = '#162035'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const BORDER = 'rgba(255,255,255,0.08)'

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
      <View style={[styles.iconContainer, { backgroundColor: active ? color : BORDER }]}>
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
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER
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
  title: { fontSize: 15, fontWeight: '600', color: WHITE },
  titleInactive: { color: MUTED },
  subtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  comingSoonText: { fontSize: 10, color: MUTED }
})
