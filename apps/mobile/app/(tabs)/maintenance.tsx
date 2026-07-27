import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, TextInput, Alert, RefreshControl } from 'react-native'
import { useEffect, useState } from 'react'
import { useMaintenanceStore } from '../../src/stores/maintenanceStore'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#FFD166'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const SUCCESS = '#06D6A0'
const WARNING = '#FF9F1C'
const DANGER = '#FF6B6B'

const DEFAULT_PROFILE = { property_type: 'house', appliances: ['furnace', 'water heater'], climate: 'temperate' }

const URGENCY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  emergency: { color: DANGER, bg: 'rgba(255,107,107,0.12)', label: 'EMERGENCY' },
  high: { color: WARNING, bg: 'rgba(255,159,28,0.12)', label: 'HIGH URGENCY' },
  medium: { color: ACCENT, bg: 'rgba(255,209,102,0.12)', label: 'MEDIUM URGENCY' },
  low: { color: SUCCESS, bg: 'rgba(6,214,160,0.12)', label: 'LOW URGENCY' },
}

export default function MaintenanceScreen() {
  const { tasks = [], isLoading, generateCalendar, diagnoseProblem, getDIYInstructions, fetchTasks, completeTask } = useMaintenanceStore()
  const [problemDesc, setProblemDesc] = useState('')
  const [diagnosis, setDiagnosis] = useState<any>(null)
  const [diagnosing, setDiagnosing] = useState(false)

  useEffect(() => {
    fetchTasks()
    if (tasks.length === 0) generateCalendar(DEFAULT_PROFILE)
  }, [])

  const handleDiagnose = async () => {
    if (!problemDesc.trim()) return
    setDiagnosing(true)
    try {
      const result = await diagnoseProblem(problemDesc)
      setDiagnosis(result)
    } catch { Alert.alert('Error', 'Could not diagnose. Please try again.') }
    finally { setDiagnosing(false) }
  }

  const handleDIY = async (taskName: string) => {
    try {
      const instructions = await getDIYInstructions(taskName)
      Alert.alert(taskName, instructions.steps?.join('\n') || 'No instructions available')
    } catch { Alert.alert('Error', 'Could not fetch instructions') }
  }

  const upcomingTasks = tasks.filter((t: any) => !t.completed).slice(0, 8)
  const urgencyCfg = diagnosis ? (URGENCY_CONFIG[diagnosis.urgency] || URGENCY_CONFIG.medium) : null

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <Text style={styles.headerLabel}>HOME</Text>
        <Text style={styles.headerTitle}>Maintenance</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{upcomingTasks.length}</Text>
            <Text style={styles.summaryLabel}>Upcoming</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{tasks.filter((t: any) => t.completed).length}</Text>
            <Text style={styles.summaryLabel}>Done</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={ACCENT} />}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
          {upcomingTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={40} color={SUCCESS} />
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySubtitle}>No maintenance tasks due</Text>
            </View>
          ) : (
            upcomingTasks.map((task: any, i: number) => (
              <View key={task.id || i} style={styles.taskCard}>
                <View style={styles.taskLeft}>
                  <Text style={styles.taskName}>{task.name || task.title}</Text>
                  <Text style={styles.taskDue}>Due: {task.due_date || task.next_due_date}</Text>
                </View>
                <View style={styles.taskActions}>
                  {task.diy_friendly && (
                    <TouchableOpacity style={styles.diyBtn} onPress={() => handleDIY(task.name || task.title)}>
                      <Text style={styles.diyBtnText}>DIY</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.doneBtn} onPress={() => completeTask(task.id)}>
                    <Ionicons name="checkmark" size={16} color={NAVY} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnose an Issue</Text>
          <View style={styles.diagnoseCard}>
            <TextInput
              style={styles.diagnoseInput}
              placeholder="e.g., 'Car AC not working'"
              placeholderTextColor={MUTED}
              value={problemDesc}
              onChangeText={setProblemDesc}
              multiline
            />
            <TouchableOpacity style={styles.diagnoseBtn} onPress={handleDiagnose} disabled={diagnosing}>
              <Text style={styles.diagnoseBtnText}>{diagnosing ? 'Diagnosing...' : 'Diagnose'}</Text>
            </TouchableOpacity>

            {diagnosis && (
              <View style={styles.diagnosisResult}>
                {urgencyCfg && (
                  <View style={[styles.urgencyBadge, { backgroundColor: urgencyCfg.bg, borderColor: urgencyCfg.color + '33' }]}>
                    <Text style={[styles.urgencyText, { color: urgencyCfg.color }]}>{urgencyCfg.label}</Text>
                  </View>
                )}

                <Text style={styles.diagnosisSubtitle}>Likely causes</Text>
                {diagnosis.likely_causes?.map((cause: string, i: number) => (
                  <Text key={i} style={styles.diagnosisCause}>• {cause}</Text>
                ))}

                {diagnosis.immediate_steps?.length > 0 && (
                  <>
                    <Text style={styles.diagnosisSubtitle}>What to do now</Text>
                    {diagnosis.immediate_steps.map((step: string, i: number) => (
                      <Text key={i} style={styles.diagnosisCause}>• {step}</Text>
                    ))}
                  </>
                )}

                <View style={styles.metaRow}>
                  {diagnosis.diy_possible !== undefined && (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{diagnosis.diy_possible ? '🔧 DIY possible' : '👷 Pro recommended'}</Text>
                    </View>
                  )}
                  {diagnosis.estimated_repair_cost && (
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>Est. cost: {diagnosis.estimated_repair_cost}</Text>
                    </View>
                  )}
                </View>

                {diagnosis.safety_warning && (
                  <View style={styles.safetyWarningBox}>
                    <Text style={styles.safetyWarningText}>⚠ {diagnosis.safety_warning}</Text>
                  </View>
                )}

                {diagnosis.disclaimer && (
                  <Text style={styles.diagnosisDisclaimer}>{diagnosis.disclaimer}</Text>
                )}
              </View>
            )}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerLabel: { fontSize: 11, color: MUTED, letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: WHITE, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  summaryValue: { fontSize: 15, fontWeight: '700', color: WHITE },
  summaryLabel: { fontSize: 12, color: MUTED },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: WHITE },
  emptySubtitle: { fontSize: 13, color: MUTED },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12 },
  taskLeft: { flex: 1 },
  taskName: { fontSize: 15, fontWeight: '600', color: WHITE, marginBottom: 3 },
  taskDue: { fontSize: 12, color: MUTED },
  taskActions: { flexDirection: 'row', gap: 8 },
  diyBtn: { backgroundColor: 'rgba(255,209,102,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,209,102,0.2)' },
  diyBtnText: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  doneBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#06D6A0', alignItems: 'center', justifyContent: 'center' },
  diagnoseCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  diagnoseInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, fontSize: 14, color: WHITE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
  diagnoseBtn: { backgroundColor: ACCENT, borderRadius: 12, padding: 14, alignItems: 'center' },
  diagnoseBtnText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  diagnosisResult: { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16, gap: 6 },
  urgencyBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, marginBottom: 8 },
  urgencyText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  diagnosisSubtitle: { fontSize: 12, fontWeight: '700', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  diagnosisCause: { fontSize: 13, color: '#B8D4E8' },
  diagnosisText: { fontSize: 13, color: '#B8D4E8', lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  metaChip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  metaChipText: { fontSize: 12, color: '#B8D4E8' },
  safetyWarningBox: { backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)' },
  safetyWarningText: { fontSize: 13, color: '#FFD0D0', lineHeight: 19 },
  diagnosisDisclaimer: { fontSize: 11, color: MUTED, marginTop: 10, fontStyle: 'italic' },
})
