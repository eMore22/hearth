import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Keyboard, KeyboardAvoidingView, Platform, Modal, ScrollView, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { householdService } from '../../src/services/api'
import { useHouseholdStore } from '../../src/stores/householdStore'
import { COUNTRIES } from '../../src/utils/country'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

export default function CreateHouseholdScreen() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [country, setCountry] = useState('')
  const [showCountryModal, setShowCountryModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { fetchHousehold } = useHouseholdStore()
  const selectedCountry = COUNTRIES.find(c => c.value === country)

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Household name', 'Please enter a household name.'); return }
    if (!country) { Alert.alert('Country', 'Please select a country.'); return }
    Keyboard.dismiss()
    setIsLoading(true)
    try {
      await householdService.create({
        name: name.trim(), address: address.trim() || undefined, country,
        currency: selectedCountry?.currency, timezone: selectedCountry?.defaultTimezone,
      })
      await fetchHousehold()
      router.replace('/onboarding/add-members')
    } catch (error: any) {
      Alert.alert('Could not create household', error.response?.data?.detail || 'Please try again.')
    } finally { setIsLoading(false) }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
            <View style={styles.topRow}>
              <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={21} color={H.navy} /></TouchableOpacity>
              <View style={styles.progress}><View style={[styles.progressFill, { width: '66%' }]} /></View>
              <Text style={styles.step}>2 of 3</Text>
            </View>

            <Text style={styles.eyebrow}>SET UP YOUR HOME BASE</Text>
            <Text style={styles.title}>Tell Hearth about your household.</Text>
            <Text style={styles.description}>This helps Hearth personalise currency, timezone and household reminders.</Text>

            <View style={styles.formCard}>
              <Text style={styles.label}>Household name</Text>
              <TextInput style={styles.input} placeholder="e.g. Eugene Family" placeholderTextColor={H.muted2} value={name} onChangeText={setName} autoCapitalize="words" autoFocus />

              <Text style={styles.label}>Address <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput style={styles.input} placeholder="Street or neighbourhood" placeholderTextColor={H.muted2} value={address} onChangeText={setAddress} autoCapitalize="words" returnKeyType="done" blurOnSubmit onSubmitEditing={() => Keyboard.dismiss()} />

              <Text style={styles.label}>Country</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setShowCountryModal(true)} activeOpacity={0.8}>
                <Text style={[styles.selectText, !country && { color: H.muted2 }]}>{selectedCountry ? selectedCountry.label : 'Select country'}</Text>
                <Ionicons name="chevron-down" size={18} color={H.muted} />
              </TouchableOpacity>

              {!!selectedCountry && (
                <View style={styles.detectedRow}>
                  <Ionicons name="checkmark-circle" size={18} color={H.green} />
                  <Text style={styles.detectedText}>{selectedCountry.currency} · {selectedCountry.defaultTimezone}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.button, (!name.trim() || !country || isLoading) && styles.buttonDisabled]} onPress={handleCreate} disabled={!name.trim() || !country || isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.buttonText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showCountryModal} transparent animationType="fade" onRequestClose={() => setShowCountryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Select country</Text><TouchableOpacity onPress={() => setShowCountryModal(false)}><Ionicons name="close" size={22} color={H.navy} /></TouchableOpacity></View>
            <ScrollView style={{ maxHeight: 360 }}>
              {COUNTRIES.map(item => (
                <TouchableOpacity key={item.value} style={[styles.countryOption, country === item.value && styles.countryOptionSelected]} onPress={() => { setCountry(item.value); setShowCountryModal(false) }}>
                  <View><Text style={[styles.countryOptionText, country === item.value && styles.countryOptionTextSelected]}>{item.label}</Text><Text style={styles.countryMeta}>{item.currency}</Text></View>
                  {country === item.value && <Ionicons name="checkmark-circle" size={20} color={H.purple} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper }, safeArea: { flex: 1 }, scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: H.white, borderWidth: 1, borderColor: H.line, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, height: 7, backgroundColor: '#ECEAF0', borderRadius: 99, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: H.purple, borderRadius: 99 }, step: { color: H.muted, fontSize: 12, fontWeight: '700' },
  eyebrow: { color: H.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 }, title: { fontSize: 31, lineHeight: 36, fontWeight: '800', color: H.navy, letterSpacing: -0.8 }, description: { fontSize: 14.5, color: H.muted, lineHeight: 21, marginTop: 10, marginBottom: 24 },
  formCard: { backgroundColor: H.white, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: H.lineSoft, ...HearthDesign.shadow.card }, label: { color: H.navy, fontSize: 12.5, fontWeight: '800', marginBottom: 8, marginTop: 4 }, optional: { color: H.muted2, fontWeight: '600' },
  input: { minHeight: 54, backgroundColor: '#F8F7FA', borderRadius: 16, paddingHorizontal: 15, color: H.navy, fontSize: 16, borderWidth: 1, borderColor: H.line, marginBottom: 15 },
  selectInput: { minHeight: 54, backgroundColor: '#F8F7FA', borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: H.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectText: { color: H.navy, fontSize: 16 },
  detectedRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }, detectedText: { color: H.muted, fontSize: 12.5 },
  button: { marginTop: 'auto', minHeight: 56, borderRadius: 18, backgroundColor: H.purple, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,21,51,0.42)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: H.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, modalTitle: { fontSize: 21, fontWeight: '800', color: H.navy },
  countryOption: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 15, marginBottom: 6, backgroundColor: H.white, borderWidth: 1, borderColor: H.lineSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, countryOptionSelected: { backgroundColor: H.violetBg, borderColor: '#D8CDFD' }, countryOptionText: { fontSize: 15, color: H.navy, fontWeight: '700' }, countryOptionTextSelected: { color: H.purple }, countryMeta: { fontSize: 11.5, color: H.muted, marginTop: 2 },
})
