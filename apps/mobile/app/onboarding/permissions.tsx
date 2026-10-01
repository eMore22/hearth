import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

export default function PermissionsScreen() {
  const [isLoading, setIsLoading] = useState(false)

  const handleEnable = async () => {
    setIsLoading(true)
    try {
      if (Constants.appOwnership !== 'expo') {
        const { registerForPushNotificationsAsync } = await import('../../src/services/notifications')
        await registerForPushNotificationsAsync()
      }
    } catch {}
    finally { setIsLoading(false); router.replace('/(tabs)') }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.top}><Text style={styles.step}>3 of 3</Text><Text style={styles.brand}>Hearth HQ</Text></View>

        <View style={styles.content}>
          <View style={styles.bellWrap}><View style={styles.bellInner}><Ionicons name="notifications-outline" size={34} color={H.purple} /></View></View>
          <Text style={styles.eyebrow}>STAY ONE STEP AHEAD</Text>
          <Text style={styles.title}>Let Hearth HQ nudge you when something matters.</Text>
          <Text style={styles.subtitle}>Get reminders for bills, expiring documents, home alerts and other household priorities.</Text>

          <View style={styles.previewCard}>
            <View style={styles.previewIcon}><Ionicons name="document-text-outline" size={20} color={H.red} /></View>
            <View style={{ flex: 1 }}><Text style={styles.previewTitle}>Passport expires soon</Text><Text style={styles.previewText}>Hearth HQ · in 30 days</Text></View>
          </View>
          <View style={styles.previewCard}>
            <View style={[styles.previewIcon, { backgroundColor: H.violetBg }]}><Ionicons name="card-outline" size={20} color={H.purple} /></View>
            <View style={{ flex: 1 }}><Text style={styles.previewTitle}>Electricity bill due Friday</Text><Text style={styles.previewText}>Hearth HQ · household reminder</Text></View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.enableButton} onPress={handleEnable} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.enableText}>Enable notifications</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}><Text style={styles.skipText}>Not now</Text></TouchableOpacity>
          <Text style={styles.note}>You can change this anytime in Settings.</Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper }, safeArea: { flex: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 18 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, step: { color: H.muted, fontSize: 12, fontWeight: '700' }, brand: { color: H.navy, fontSize: 21, fontWeight: '800' },
  content: { flex: 1, justifyContent: 'center' }, bellWrap: { width: 78, height: 78, borderRadius: 26, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, bellInner: { width: 58, height: 58, borderRadius: 20, backgroundColor: H.white, alignItems: 'center', justifyContent: 'center', ...HearthDesign.shadow.card },
  eyebrow: { color: H.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 }, title: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: H.navy, letterSpacing: -0.8 }, subtitle: { fontSize: 14.5, color: H.muted, lineHeight: 21, marginTop: 10, marginBottom: 24 },
  previewCard: { minHeight: 72, backgroundColor: H.white, borderRadius: 19, borderWidth: 1, borderColor: H.lineSoft, padding: 13, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10, ...HearthDesign.shadow.card }, previewIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: H.redBg, alignItems: 'center', justifyContent: 'center' }, previewTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800' }, previewText: { color: H.muted, fontSize: 12, marginTop: 4 },
  footer: { paddingTop: 14 }, enableButton: { minHeight: 56, borderRadius: 18, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center' }, enableText: { color: '#fff', fontSize: 16, fontWeight: '800' }, skipText: { color: H.navy, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 15 }, note: { color: H.muted2, fontSize: 11.5, textAlign: 'center', marginTop: 7 },
})
