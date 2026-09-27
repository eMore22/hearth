import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

const features = [
  { icon: 'document-text-outline' as const, title: 'Keep important documents in view', text: 'Track expiries, renewals and household records.' },
  { icon: 'card-outline' as const, title: 'Know what is due next', text: 'Bring bills, subscriptions and recurring costs together.' },
  { icon: 'sparkles-outline' as const, title: 'Let Hearth connect the dots', text: 'Get one household briefing instead of checking five different places.' },
]

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Ionicons name="home-outline" size={22} color={H.navy} /></View>
          <Text style={styles.brand}>Hearth</Text>
          <Text style={styles.step}>1 of 3</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Ionicons name="sparkles" size={25} color="#fff" /></View>
          <Text style={styles.kicker}>YOUR HOUSEHOLD, ORGANISED</Text>
          <Text style={styles.title}>A chief of staff for everyday home life.</Text>
          <Text style={styles.subtitle}>Hearth keeps an eye on what matters and brings the right thing forward at the right time.</Text>
        </View>

        <View style={styles.features}>
          {features.map((item) => (
            <View key={item.title} style={styles.featureRow}>
              <View style={styles.featureIcon}><Ionicons name={item.icon} size={21} color={H.purple} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/create-household')} activeOpacity={0.86}>
            <Text style={styles.buttonText}>Set up my household</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.footerText}>Takes about a minute. You can change everything later.</Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper }, safeArea: { flex: 1, paddingHorizontal: 22, paddingTop: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: H.white, borderWidth: 1, borderColor: H.line, alignItems: 'center', justifyContent: 'center', ...HearthDesign.shadow.card },
  brand: { marginLeft: 10, color: H.navy, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  step: { marginLeft: 'auto', color: H.muted, fontSize: 12, fontWeight: '700' },
  heroCard: { backgroundColor: H.navy, borderRadius: 28, padding: 24, marginBottom: 22, ...HearthDesign.shadow.floating },
  heroIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  kicker: { color: '#BFB2FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  title: { color: '#fff', fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: '#C8CEDA', fontSize: 14.5, lineHeight: 21, marginTop: 12 },
  features: { gap: 12 },
  featureRow: { flexDirection: 'row', gap: 13, backgroundColor: H.white, borderWidth: 1, borderColor: H.lineSoft, borderRadius: 19, padding: 14, ...HearthDesign.shadow.card },
  featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800', marginBottom: 3 },
  featureText: { color: H.muted, fontSize: 12.5, lineHeight: 18 },
  footer: { marginTop: 'auto', paddingTop: 18, paddingBottom: 14 },
  button: { minHeight: 56, borderRadius: 18, backgroundColor: H.purple, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footerText: { color: H.muted2, fontSize: 11.5, textAlign: 'center', marginTop: 10 },
})
