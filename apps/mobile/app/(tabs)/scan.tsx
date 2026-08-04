import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, Alert, Animated, Easing
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useRef, useEffect } from 'react'
import api from '../../src/services/api'

const NAVY    = '#0A1628'
const SURFACE = '#162035'
const ACCENT  = '#4FC3F7'
const PURPLE  = '#C77DFF'
const WHITE   = '#F8FAFF'
const MUTED   = '#8899AA'
const SUCCESS = '#06D6A0'
const WARNING = '#FFD166'

// Destination colours matching each module
const DEST_COLORS: Record<string, string> = {
  Documents: '#4FC3F7',
  Bills:     '#C77DFF',
  Health:    '#FF6B6B',
}

const DEST_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Documents: 'document-text',
  Bills:     'card',
  Health:    'heart',
}

interface ScanResult {
  success: boolean
  category: string
  destination: string
  destination_message: string
  title: string
  document_type: string
  expiry_date?: string
  summary?: string
  toast: string
}

export default function ScanScreen() {
  const [scanning, setScanning]     = useState(false)
  const [result, setResult]         = useState<ScanResult | null>(null)
  const toastAnim  = useRef(new Animated.Value(0)).current
  const pulseAnim  = useRef(new Animated.Value(1)).current

  // Pulse animation for the scan icon while processing
  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [scanning])

  // Toast slide-in when result arrives
  useEffect(() => {
    if (result) {
      Animated.spring(toastAnim, {
        toValue: 1, useNativeDriver: true,
        friction: 6, tension: 80,
      }).start()
    } else {
      toastAnim.setValue(0)
    }
  }, [result])

  const runScan = async (asset: any) => {
    setScanning(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', {
        uri:  asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'scan.jpg',
      } as any)

      const res = await api.post('/api/intake/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })

      setResult(res.data)
    } catch (err: any) {
      Alert.alert(
        'Scan failed',
        err.response?.data?.detail || 'Could not process the image. Please try again.'
      )
    } finally {
      setScanning(false)
    }
  }

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to scan documents.')
      return
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 })
    if (!res.canceled) await runScan(res.assets[0])
  }

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    })
    if (!res.canceled) await runScan(res.assets[0])
  }

  const handleNavigateToDestination = () => {
    if (!result) return
    const routes: Record<string, string> = {
      Documents: '/(tabs)/documents',
      Bills:     '/(tabs)/bills',
      Health:    '/(tabs)/health',
    }
    const route = routes[result.destination] || '/(tabs)/documents'
    setResult(null)
    router.push(route as any)
  }

  const destColor = result ? (DEST_COLORS[result.destination] || ACCENT) : ACCENT
  const destIcon  = result ? (DEST_ICONS[result.destination]  || 'document-text') : 'document-text'

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[NAVY, '#112240']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Scan Anything</Text>
          <Text style={styles.headerSubtitle}>Hearth routes it automatically</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <View style={styles.body}>

        {/* ── Central scan zone ── */}
        {!scanning && !result && (
          <>
            <View style={styles.scanZone}>
              <View style={styles.scanFrame}>
                {/* Corner markers */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.scanIconBox}>
                  <Ionicons name="scan-outline" size={56} color={ACCENT} />
                </View>
              </View>
              <Text style={styles.scanHint}>
                Point your camera at any document, bill, receipt, or medical record
              </Text>
            </View>

            {/* What gets recognised */}
            <View style={styles.routingRow}>
              <RoutingChip icon="document-text" color="#4FC3F7" label="Passports / IDs" />
              <RoutingChip icon="card"          color="#C77DFF" label="Bills / Invoices" />
              <RoutingChip icon="heart"         color="#FF6B6B" label="Medical records" />
              <RoutingChip icon="shield"        color="#06D6A0" label="Insurance" />
            </View>

            {/* Action buttons */}
            <TouchableOpacity style={styles.cameraBtn} onPress={handleCamera}>
              <Ionicons name="camera-outline" size={22} color={NAVY} />
              <Text style={styles.cameraBtnText}>Scan with Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
              <Ionicons name="image-outline" size={20} color={ACCENT} />
              <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Processing state ── */}
        {scanning && (
          <View style={styles.processingBox}>
            <Animated.View style={[styles.processingIcon, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="sparkles-outline" size={48} color={ACCENT} />
            </Animated.View>
            <Text style={styles.processingTitle}>Reading document...</Text>
            <Text style={styles.processingSubtitle}>
              Claude Vision is extracting data and figuring out where this belongs
            </Text>
            <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
          </View>
        )}

        {/* ── Result / routing toast ── */}
        {result && !scanning && (
          <Animated.View style={[
            styles.resultCard,
            {
              opacity: toastAnim,
              transform: [{ scale: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            }
          ]}>
            {/* Destination badge */}
            <View style={[styles.destBadge, { backgroundColor: destColor + '22', borderColor: destColor + '55' }]}>
              <Ionicons name={destIcon} size={18} color={destColor} />
              <Text style={[styles.destBadgeText, { color: destColor }]}>
                → {result.destination}
              </Text>
            </View>

            <Text style={styles.resultTitle}>{result.title}</Text>

            {result.summary ? (
              <Text style={styles.resultSummary} numberOfLines={3}>{result.summary}</Text>
            ) : null}

            {result.expiry_date ? (
              <View style={styles.expiryRow}>
                <Ionicons name="calendar-outline" size={14} color={WARNING} />
                <Text style={styles.expiryText}>
                  Expires {new Date(result.expiry_date).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </Text>
              </View>
            ) : null}

            <Text style={styles.resultMessage}>{result.destination_message}</Text>

            {/* CTA buttons */}
            <TouchableOpacity
              style={[styles.viewBtn, { backgroundColor: destColor }]}
              onPress={handleNavigateToDestination}
            >
              <Text style={styles.viewBtnText}>View in {result.destination}</Text>
              <Ionicons name="arrow-forward" size={16} color={NAVY} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanAgainBtn} onPress={() => setResult(null)}>
              <Ionicons name="camera-outline" size={16} color={MUTED} />
              <Text style={styles.scanAgainText}>Scan another document</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  )
}

const RoutingChip = ({ icon, color, label }: { icon: any; color: string; label: string }) => (
  <View style={[styles.chip, { borderColor: color + '40' }]}>
    <Ionicons name={icon} size={14} color={color} />
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn:        { padding: 6 },
  headerCenter:   { flex: 1, alignItems: 'center' },
  headerTitle:    { fontSize: 20, fontWeight: '700', color: WHITE },
  headerSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },

  // Scan zone
  scanZone: { alignItems: 'center', marginBottom: 32 },
  scanFrame: {
    width: 220, height: 220,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, position: 'relative',
  },
  corner: {
    position: 'absolute', width: 28, height: 28,
    borderColor: ACCENT,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanIconBox: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(79,195,247,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)',
  },
  scanHint: {
    fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21,
    paddingHorizontal: 16,
  },

  // Routing chips
  routingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipText: { fontSize: 12, fontWeight: '500' },

  // Buttons
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: ACCENT, borderRadius: 16,
    paddingVertical: 16, marginBottom: 12,
  },
  cameraBtnText: { color: NAVY, fontWeight: '700', fontSize: 16 },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(79,195,247,0.3)',
    backgroundColor: 'rgba(79,195,247,0.05)',
  },
  galleryBtnText: { color: ACCENT, fontWeight: '600', fontSize: 15 },

  // Processing
  processingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  processingIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(79,195,247,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)',
  },
  processingTitle:    { fontSize: 20, fontWeight: '700', color: WHITE, marginBottom: 10 },
  processingSubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21, paddingHorizontal: 20 },

  // Result card
  resultCard: {
    backgroundColor: SURFACE, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  destBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, marginBottom: 16,
  },
  destBadgeText: { fontSize: 13, fontWeight: '700' },
  resultTitle:   { fontSize: 20, fontWeight: '700', color: WHITE, marginBottom: 8 },
  resultSummary: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 12 },
  expiryRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  expiryText:    { fontSize: 13, color: WARNING, fontWeight: '600' },
  resultMessage: { fontSize: 13, color: '#B8D4E8', marginBottom: 20 },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14, marginBottom: 12,
  },
  viewBtnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  scanAgainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10,
  },
  scanAgainText: { color: MUTED, fontSize: 14 },
})