import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal, ActivityIndicator, RefreshControl
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useDocumentStore } from '../../src/stores/documentStore'
import { COLORS } from '../../src/utils/theme'

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
      Alert.alert('✅ Document added', 'Your document has been scanned and saved.')
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

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8
    })

    if (result.canceled) return

    setUploadLoading(true)
    try {
      await uploadDocument(result.assets[0])
      Alert.alert('✅ Document added', 'Your document has been scanned and saved.')
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
    } catch (err) {
      setAnswer('Sorry, I could not find an answer. Please try again.')
    } finally {
      setAskLoading(false)
    }
  }

  const urgencyColor = (urgency: string) => {
    if (urgency === 'expired') return COLORS.danger
    if (urgency === 'critical') return COLORS.warning
    if (urgency === 'urgent') return '#F59E0B'
    return COLORS.primary
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📄 Document Vault</Text>
        <TouchableOpacity onPress={() => setShowAskModal(true)} style={styles.askButton}>
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.accent} />
          <Text style={styles.askButtonText}>Ask AI</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => { fetchDocuments(); fetchAlerts() }} />
        }
      >
        {/* Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expiry Alerts</Text>
            {alerts.map((alert, i) => (
              <View key={i} style={[styles.alertCard, { borderLeftColor: urgencyColor(alert.urgency) }]}>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Document list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Documents ({documents.length})
          </Text>

          {documents.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No documents yet</Text>
              <Text style={styles.emptySubtitle}>
                Photograph your passport, insurance, warranty — Hearth extracts expiry dates automatically.
              </Text>
            </View>
          )}

          {documents.map((doc, i) => (
            <View key={i} style={styles.docCard}>
              <View style={styles.docCardLeft}>
                <Text style={styles.docIcon}>{docTypeIcon(doc.document_type)}</Text>
              </View>
              <View style={styles.docCardContent}>
                <Text style={styles.docTitle}>{doc.title || 'Document'}</Text>
                {doc.member_name && (
                  <Text style={styles.docMember}>👤 {doc.member_name}</Text>
                )}
                {doc.expiry_date ? (
                  <Text style={[
                    styles.docExpiry,
                    isExpiringSoon(doc.expiry_date) && { color: COLORS.warning }
                  ]}>
                    Expires {formatExpiry(doc.expiry_date)}
                  </Text>
                ) : (
                  <Text style={styles.docNoExpiry}>No expiry date</Text>
                )}
                {doc.summary && (
                  <Text style={styles.docSummary} numberOfLines={2}>{doc.summary}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Upload buttons */}
      <View style={styles.uploadRow}>
        <TouchableOpacity
          style={[styles.uploadBtn, styles.uploadBtnSecondary]}
          onPress={handleUpload}
          disabled={uploadLoading}
        >
          <Ionicons name="image-outline" size={20} color={COLORS.primary} />
          <Text style={styles.uploadBtnTextSecondary}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.uploadBtn, styles.uploadBtnPrimary]}
          onPress={handleCamera}
          disabled={uploadLoading}
        >
          {uploadLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="camera-outline" size={20} color="#fff" /><Text style={styles.uploadBtnTextPrimary}>Scan Document</Text></>
          }
        </TouchableOpacity>
      </View>

      {/* Ask AI Modal */}
      <Modal visible={showAskModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ask about your documents</Text>
            <TouchableOpacity onPress={() => { setShowAskModal(false); setAnswer(''); setQuestion('') }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>
            Try: "When does my passport expire?" or "What's my insurance policy number?"
          </Text>
          <TextInput
            style={styles.questionInput}
            placeholder="Ask anything about your documents..."
            placeholderTextColor={COLORS.muted}
            value={question}
            onChangeText={setQuestion}
            multiline
          />
          {answer ? (
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>Hearth says:</Text>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.askSubmitBtn, askLoading && { opacity: 0.6 }]}
            onPress={handleAsk}
            disabled={askLoading}
          >
            {askLoading
              ? <ActivityIndicator color="#fff" />
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
    passport: '🛂',
    insurance: '🛡️',
    warranty: '🔧',
    lease: '🏠',
    medical: '🏥',
    vehicle_registration: '🚗',
    other: '📄'
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.accent
  },
  askButtonText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  alertCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4
  },
  alertMessage: { fontSize: 13, color: COLORS.text },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  docCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  docCardLeft: { marginRight: 12, justifyContent: 'center' },
  docIcon: { fontSize: 28 },
  docCardContent: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  docMember: { fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  docExpiry: { fontSize: 12, color: COLORS.primary, marginBottom: 4 },
  docNoExpiry: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  docSummary: { fontSize: 12, color: COLORS.muted, lineHeight: 16 },
  uploadRow: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12
  },
  uploadBtnPrimary: { backgroundColor: COLORS.primary, flex: 2 },
  uploadBtnSecondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  uploadBtnTextPrimary: { color: '#fff', fontWeight: '600', fontSize: 15 },
  uploadBtnTextSecondary: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  modal: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  modalHint: { fontSize: 13, color: COLORS.muted, marginBottom: 16, lineHeight: 18 },
  questionInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12
  },
  answerBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent
  },
  answerLabel: { fontSize: 12, fontWeight: '600', color: COLORS.accent, marginBottom: 6 },
  answerText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  askSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center'
  },
  askSubmitText: { color: '#fff', fontWeight: '600', fontSize: 16 }
})
