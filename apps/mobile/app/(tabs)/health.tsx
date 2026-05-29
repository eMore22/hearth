import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, TextInput, Alert } from 'react-native'
import { useState } from 'react'
import { useHealthStore } from '../../src/stores/healthStore'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#FF6B6B'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const SUCCESS = '#06D6A0'
const WARNING = '#FF9F1C'
const DANGER = '#FF6B6B'

const TRIAGE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  emergency: { color: DANGER, bg: 'rgba(255,107,107,0.12)', label: 'EMERGENCY', icon: 'warning' },
  urgent_care: { color: WARNING, bg: 'rgba(255,159,28,0.12)', label: 'URGENT CARE', icon: 'medkit' },
  gp_visit: { color: '#FFD166', bg: 'rgba(255,209,102,0.12)', label: 'GP VISIT', icon: 'person' },
  home_care: { color: SUCCESS, bg: 'rgba(6,214,160,0.12)', label: 'HOME CARE', icon: 'home' },
}

export default function HealthScreen() {
  const { triageHistory, isLoading, triageSymptoms } = useHealthStore()
  const [symptoms, setSymptoms] = useState('')
  const [lastTriage, setLastTriage] = useState<any>(null)

  const handleTriage = async () => {
    if (!symptoms.trim()) return
    try {
      const result = await triageSymptoms(symptoms)
      setLastTriage(result)
      setSymptoms('')
    } catch {
      Alert.alert('Error', 'Could not complete triage. Please try again.')
    }
  }

  const cfg = lastTriage ? (TRIAGE_CONFIG[lastTriage.triage_level] || TRIAGE_CONFIG.home_care) : null

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <Text style={styles.headerLabel}>WELLNESS</Text>
        <Text style={styles.headerTitle}>Health Triage</Text>
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={MUTED} />
          <Text style={styles.disclaimerText}>For informational purposes only. Always consult a healthcare professional.</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Triage result */}
        {lastTriage && cfg && (
          <View style={styles.section}>
            <View style={[styles.triageCard, { backgroundColor: cfg.bg, borderColor: cfg.color + '33' }]}>
              <View style={styles.triageHeader}>
                <View style={[styles.triageIconBox, { backgroundColor: cfg.color + '22' }]}>
                  <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                </View>
                <Text style={[styles.triageLevel, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
              <Text style={styles.triageRec}>{lastTriage.recommendation}</Text>
              {lastTriage.home_care_tips?.length > 0 && (
                <View style={styles.tipsBox}>
                  <Text style={styles.tipsTitle}>Home care tips</Text>
                  {lastTriage.home_care_tips.map((tip: string, i: number) => (
                    <Text key={i} style={styles.tip}>• {tip}</Text>
                  ))}
                </View>
              )}
              {lastTriage.disclaimer && (
                <Text style={styles.triageDisclaimer}>{lastTriage.disclaimer}</Text>
              )}
            </View>
          </View>
        )}

        {/* Symptom input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Symptoms</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="e.g., '6-year-old with fever 101°F for 2 days'"
              placeholderTextColor={MUTED}
              value={symptoms}
              onChangeText={setSymptoms}
              multiline
            />
            <TouchableOpacity
              style={[styles.triageBtn, (!symptoms.trim() || isLoading) && styles.triageBtnDisabled]}
              onPress={handleTriage}
              disabled={!symptoms.trim() || isLoading}
            >
              <Text style={styles.triageBtnText}>
                {isLoading ? 'Analyzing...' : 'Get Triage Recommendation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* History */}
        {triageHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Checks</Text>
            {triageHistory.slice(0, 5).map((item: any, i: number) => {
              const itemCfg = TRIAGE_CONFIG[item.result?.triage_level] || TRIAGE_CONFIG.home_care
              return (
                <View key={i} style={styles.historyCard}>
                  <View style={[styles.historyDot, { backgroundColor: itemCfg.color }]} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDate}>
                      {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={styles.historySymptoms} numberOfLines={1}>{item.symptoms}</Text>
                    <Text style={[styles.historyLevel, { color: itemCfg.color }]}>
                      {item.result?.triage_level?.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerLabel: { fontSize: 11, color: MUTED, letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: WHITE, marginBottom: 12 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10 },
  disclaimerText: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 17 },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  triageCard: { borderRadius: 16, padding: 18, borderWidth: 1 },
  triageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  triageIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  triageLevel: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  triageRec: { fontSize: 14, color: '#D0E8F5', lineHeight: 21, marginBottom: 12 },
  tipsBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, gap: 4 },
  tipsTitle: { fontSize: 12, fontWeight: '600', color: WHITE, marginBottom: 6 },
  tip: { fontSize: 13, color: '#B8D4E8', lineHeight: 20 },
  triageDisclaimer: { fontSize: 11, color: MUTED, marginTop: 10, fontStyle: 'italic' },
  inputCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, fontSize: 14, color: WHITE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 70, textAlignVertical: 'top', marginBottom: 12 },
  triageBtn: { backgroundColor: ACCENT, borderRadius: 12, padding: 14, alignItems: 'center' },
  triageBtnDisabled: { opacity: 0.4 },
  triageBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },
  historyCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  historyInfo: { flex: 1 },
  historyDate: { fontSize: 11, color: MUTED, marginBottom: 3 },
  historySymptoms: { fontSize: 14, color: WHITE, marginBottom: 3 },
  historyLevel: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
})