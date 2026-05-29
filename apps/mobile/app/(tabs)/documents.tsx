import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal, ActivityIndicator, RefreshControl, StatusBar
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useDocumentStore } from '../../src/stores/documentStore'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#4FC3F7'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const DANGER = '#FF6B6B'
const WARNING = '#FF9F1C'
const SUCCESS = '#06D6A0'

export default function DocumentsScreen() {
  const { documents, alerts, fetchDocuments, fetchAlerts, uploadDocument, askQuestion, loading } = useDocumentStore()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [showAskModal, setShowAskModal] = useState(false)

  useEffect(() => {
    fetchDocuments()
    fetchAlerts()
  }, [])

  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload documents.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8
    })
    if (result.canceled) return
    setUploadLoading(true)
    try {
      await uploadDocument(result.assets[0])
      Alert.alert('✅ Document saved', 'Expiry dates and key fields extracted automatically.')
      fetchDocuments()
      fetchAlerts()
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Please try again.')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 })
    if (result.canceled) return
    setUploadLoading(true)
    try {
      await uploadDocument(result.assets[0])
      Alert.alert('✅ Document saved', 'Expiry dates and key fields extracted automatically.')
      fetchDocuments()
      fetchAlerts()
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Please try again.')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setAskLoading(true)
    try {
      const result = await askQuestion(question)
      setAnswer(result)
    } catch {
      setAnswer('Could not find an answer. Please try again.')
    } finally {
      setAskLoading(false)
    }
  }

  const urgencyConfig = (urgency: string) => {
    if (urgency === 'expired') return { color: DANGER, label: 'EXPIRED' }
    if (urgency === 'critical') return { color: DANGER, label: 'CRITICAL' }
    if (urgency === 'urgent') return { color: WARNING, label: 'URGENT' }
    return { color: ACCENT, label: 'UPCOMING' }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerLabel}>VAULT</Text>
            <Text style={styles.headerTitle}>Documents</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAskModal(true)} style={styles.askBtn}>
            <Ionicons name="sparkles" size={16} color={ACCENT} />
            <Text style={styles.askBtnText}>Ask AI</Text>
          </TouchableOpacity>
        </View>

        {/* Summary pills */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{documents.length}</Text>
            <Text style={styles.summaryLabel}>Stored</Text>
          </View>
          <View style={[styles.summaryPill, alerts.length > 0 && styles.summaryPillAlert]}>
            <Text style={[styles.summaryValue, alerts.length > 0 && { color: WARNING }]}>
              {alerts.length}
            </Text>
            <Text style={styles.summaryLabel}>Alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { fetchDocuments(); fetchAlerts() }}
            tintColor={ACCENT}
          />
        }
      >
        {/* Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiry Alerts</Text>
            {alerts.map((alert: any, i: number) => {
              const cfg = urgencyConfig(alert.urgency)
              return (
                <View key={i} style={[styles.alertCard, { borderLeftColor: cfg.color }]}>
                  <View style={[styles.alertBadge, { backgroundColor: cfg.color + '22' }]}>
                    <Text style={[styles.alertBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Documents</Text>

          {documents.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="document-text-outline" size={32} color={MUTED} />
              </View>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptySubtitle}>
                Photograph your passport, insurance, warranty — Hearth extracts expiry dates automatically.
              </Text>
            </View>
          )}

          {documents.map((doc: any, i: number) => (
            <View key={i} style={styles.docCard}>
              <View style={styles.docIconBox}>
                <Text style={styles.docIcon}>{docTypeIcon(doc.document_type)}</Text>
              </View>
              <View style={styles.docContent}>
                <Text style={styles.docTitle} numberOfLines={1}>{doc.title || 'Document'}</Text>
                {doc.member_name && (
                  <Text style={styles.docMember}>👤 {doc.member_name}</Text>
                )}
                {doc.expiry_date ? (
                  <View style={styles.expiryRow}>
                    <View style={[styles.expiryDot, { backgroundColor: isExpiringSoon(doc.expiry_date) ? WARNING : SUCCESS }]} />
                    <Text style={[styles.docExpiry, isExpiringSoon(doc.expiry_date) && { color: WARNING }]}>
                      {formatExpiry(doc.expiry_date)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.docNoExpiry}>No expiry</Text>
                )}
                {doc.summary && (
                  <Text style={styles.docSummary} numberOfLines={1}>{doc.summary}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </View>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Upload buttons */}
      <View style={styles.uploadRow}>
        <TouchableOpacity style={styles.galleryBtn} onPress={handleUpload} disabled={uploadLoading}>
          <Ionicons name="image-outline" size={20} color={ACCENT} />
          <Text style={styles.galleryBtnText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={handleCamera} disabled={uploadLoading}>
          {uploadLoading
            ? <ActivityIndicator color={WHITE} size="small" />
            : <>
                <Ionicons name="camera-outline" size={20} color={WHITE} />
                <Text style={styles.scanBtnText}>Scan Document</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Ask AI Modal */}
      <Modal visible={showAskModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Ask about your documents</Text>
              <Text style={styles.modalHint}>e.g. "When does my passport expire?"</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setShowAskModal(false); setAnswer(''); setQuestion('') }}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.questionInput}
            placeholder="Ask anything about your documents..."
            placeholderTextColor={MUTED}
            value={question}
            onChangeText={setQuestion}
            multiline
          />

          {answer ? (
            <View style={styles.answerBox}>
              <View style={styles.answerHeader}>
                <Text style={styles.answerIconText}>✦</Text>
                <Text style={styles.answerLabel}>Hearth says</Text>
              </View>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.askSubmitBtn, askLoading && { opacity: 0.6 }]}
            onPress={handleAsk}
            disabled={askLoading}
          >
            {askLoading
              ? <ActivityIndicator color={WHITE} />
              : <Text style={styles.askSubmitText}>Ask</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

function docTypeIcon(type: string) {
  const icons: Record<string, string> = {
    passport: '🛂', insurance: '🛡️', warranty: '🔧',
    lease: '🏠', medical: '🏥', vehicle_registration: '🚗', other: '📄'
  }
  return icons[type] || '📄'
}

function formatExpiry(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isExpiringSoon(dateStr: string) {
  const expiry = new Date(dateStr)
  const diff = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff < 90
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  headerLabel: { fontSize: 11, color: MUTED, letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: WHITE },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(79,195,247,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.25)'
  },
  askBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  summaryPillAlert: { backgroundColor: 'rgba(255,159,28,0.1)' },
  summaryValue: { fontSize: 15, fontWeight: '700', color: WHITE },
  summaryLabel: { fontSize: 12, color: MUTED },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 24, marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  alertCard: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    gap: 8
  },
  alertBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  alertBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  alertMessage: { fontSize: 13, color: '#D0E8F5', lineHeight: 19 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: WHITE, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(79,195,247,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  docIcon: { fontSize: 22 },
  docContent: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600', color: WHITE, marginBottom: 3 },
  docMember: { fontSize: 12, color: MUTED, marginBottom: 3 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expiryDot: { width: 6, height: 6, borderRadius: 3 },
  docExpiry: { fontSize: 12, color: SUCCESS },
  docNoExpiry: { fontSize: 12, color: MUTED },
  docSummary: { fontSize: 12, color: MUTED, marginTop: 3 },
  uploadRow: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10
  },
  galleryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.3)'
  },
  galleryBtnText: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  scanBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: ACCENT
  },
  scanBtnText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  modal: { flex: 1, backgroundColor: NAVY, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 20, marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: WHITE, marginBottom: 4 },
  modalHint: { fontSize: 13, color: MUTED },
  modalClose: { padding: 6, backgroundColor: SURFACE, borderRadius: 10 },
  questionInput: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14
  },
  answerBox: {
    backgroundColor: 'rgba(79,195,247,0.07)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.2)'
  },
  answerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  answerIconText: { fontSize: 14, color: ACCENT },
  answerLabel: { fontSize: 12, fontWeight: '600', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 },
  answerText: { fontSize: 14, color: '#D0E8F5', lineHeight: 22 },
  askSubmitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center'
  },
  askSubmitText: { color: NAVY, fontWeight: '700', fontSize: 16 }
})