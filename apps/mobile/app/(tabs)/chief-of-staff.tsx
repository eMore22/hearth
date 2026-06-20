import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, StatusBar, Animated
} from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { useChiefOfStaffStore } from '../../src/stores/chiefOfStaffStore'
import { useDocumentStore } from '../../src/stores/documentStore'
import { useBillStore } from '../../src/stores/billStore'
import { useGroceryStore } from '../../src/stores/groceryStore'
import { useMaintenanceStore } from '../../src/stores/maintenanceStore'
import { useHealthStore } from '../../src/stores/healthStore'
import { useAutomationStore } from '../../src/stores/automationStore'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const NAVY      = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE   = '#162035'
const ACCENT    = '#4FC3F7'
const WHITE     = '#F8FAFF'
const MUTED     = '#8899AA'
const USER_BUBBLE = '#1A3A5C'
const AI_BUBBLE   = '#162035'

const QUICK_PROMPTS = [
  'What needs attention today?',
  'Check my document expiries',
  'How are my finances this month?',
  'Any smart home alerts?',
]

export default function ChiefOfStaffScreen() {
  const router = useRouter()
  const { messages, isTyping, sendMessage, clearMessages } = useChiefOfStaffStore()

  // All data sources — Chief needs the full picture
  const { documents, alerts, fetchDocuments, fetchAlerts } = useDocumentStore()
  const { bills, monthlyReport, fetchBills, fetchMonthlyReport } = useBillStore()
  const { inventory, fetchInventory } = useGroceryStore()
  const { tasks, fetchTasks } = useMaintenanceStore()
  const { medications, fetchMedications } = useHealthStore()

  // ── HA events
  const { events: haEvents, status: haStatus, fetchEvents: fetchHAEvents, fetchStatus: fetchHAStatus } = useAutomationStore()

  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList>(null)
  const typingDot   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Load all data sources when Chief screen opens
    fetchDocuments(); fetchAlerts()
    fetchBills(); fetchMonthlyReport()
    fetchInventory(); fetchTasks()
    fetchMedications()
    fetchHAEvents(); fetchHAStatus()
  }, [])

  useEffect(() => {
    if (isTyping) {
      Animated.loop(Animated.sequence([
        Animated.timing(typingDot, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(typingDot, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])).start()
    } else {
      typingDot.stopAnimation()
    }
  }, [isTyping])

  const buildContext = () => {
    // ... identical to your current code ...
  }

  const handleSend = async (text?: string) => {
    // ... identical to your current code ...
  }

  const formatTime = (iso: string) => {
    // ... identical to your current code ...
  }

  const renderMessage = ({ item }: { item: any }) => {
    // ... identical to your current code ...
  }

  const activeAlertCount = haEvents.filter(e => e.alert_sent).length

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}   // <-- small improvement for Android
          keyboardVerticalOffset={Platform.OS === 'android' ? -40 : 0} // minor tweak to keep input visible
        >
          {/* The rest of the UI is identical to your current file */}
          {/* ... header, flatlist, typing indicator, input row ... */}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: NAVY },
  safeArea:     { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn:      { padding: 6, marginRight: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: WHITE },
  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#06D6A0' },
  statusText:   { fontSize: 11, color: '#06D6A0' },
  clearBtn:     { padding: 6 },
  messageList:  { padding: 16, paddingBottom: 8 },
  messageRow:   { marginBottom: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAI:   { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(79,195,247,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.3)',
  },
  aiAvatarText: { fontSize: 14, color: ACCENT },
  bubble:       { maxWidth: '78%', borderRadius: 18, padding: 14 },
  bubbleUser:   { backgroundColor: USER_BUBBLE, borderBottomRightRadius: 4, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)' },
  bubbleAI:     { backgroundColor: AI_BUBBLE, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bubbleText:   { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: WHITE },
  bubbleTextAI:   { color: '#D0E8F5' },
  messageTime:  { fontSize: 10, color: MUTED, marginTop: 6, textAlign: 'right' },
  suggestionsBox: { marginTop: 10, gap: 6 },
  suggestionChip: {
    backgroundColor: 'rgba(79,195,247,0.08)', borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)',
  },
  suggestionText: { fontSize: 12, color: ACCENT },
  typingRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  typingBubble: {
    flexDirection: 'row', backgroundColor: AI_BUBBLE, borderRadius: 16,
    padding: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  typingDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: MUTED },
  inputContainer: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: NAVY,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1, backgroundColor: SURFACE, borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 12, fontSize: 14, color: WHITE,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', maxHeight: 100,
  },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(79,195,247,0.2)' },
  emptyState:      { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(79,195,247,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)',
  },
  emptyIconText: { fontSize: 24, color: ACCENT },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: WHITE, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,209,102,0.1)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.25)',
    marginBottom: 16,
  },
  alertBannerText: { fontSize: 13, color: '#FFD166', fontWeight: '600' },
  quickPromptsGrid: { width: '100%', gap: 8 },
  quickPromptChip: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  quickPromptText: { fontSize: 13, color: '#B8D4E8' },
})