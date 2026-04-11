import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../src/utils/theme'

export default function ComingSoonScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔒</Text>
      <Text style={styles.title}>Coming Soon</Text>
      <Text style={styles.subtitle}>This module is being built. Stay tuned.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: 32 },
  emoji: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.muted, textAlign: 'center' }
})
