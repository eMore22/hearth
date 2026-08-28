import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { householdService } from '../../src/services/api';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { COUNTRIES } from '../../src/utils/country';

export default function CreateHouseholdScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { fetchHousehold } = useHouseholdStore();

  const selectedCountry = COUNTRIES.find(c => c.value === country);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }
    if (!country) {
      Alert.alert('Error', 'Please select a country');
      return;
    }

    setIsLoading(true);

    try {
      await householdService.create({
        name: name.trim(),
        address: address.trim() || undefined,
        country,
        currency: selectedCountry?.currency,
        timezone: selectedCountry?.defaultTimezone,
      });

      await fetchHousehold();
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 1 of 3</Text>
        <Text style={styles.title}>Create Your Household</Text>
        <Text style={styles.description}>
          This is where all your family’s information will live.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Household Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. The Uguomore Family"
          placeholderTextColor="#8899AA"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
        />

        <Text style={styles.label}>Address (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Plot 106, Ekenwan Layout"
          placeholderTextColor="#8899AA"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Country *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowCountryModal(true)}>
          <Text style={{ color: country ? '#F8FAFF' : '#8899AA', fontSize: 16 }}>
            {selectedCountry ? selectedCountry.label : 'Select country'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!name.trim() || !country || isLoading) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || !country || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showCountryModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {COUNTRIES.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.countryOption,
                    country === item.value && styles.countryOptionSelected,
                  ]}
                  onPress={() => {
                    setCountry(item.value);
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={[
                    styles.countryOptionText,
                    country === item.value && styles.countryOptionTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCountryModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', padding: 24 },
  header: { marginBottom: 32 },
  step: { color: '#8899AA', fontSize: 14, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFF', marginBottom: 8 },
  description: { fontSize: 15, color: '#8899AA', lineHeight: 22 },
  form: { flex: 1 },
  label: { color: '#F8FAFF', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#162035', borderRadius: 12, padding: 16,
    color: '#F8FAFF', fontSize: 16, borderWidth: 1, borderColor: '#2A3F5F',
    justifyContent: 'center',
  },
  footer: { paddingBottom: 40 },
  button: { backgroundColor: '#C77DFF', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#162035', borderRadius: 16, padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFF', marginBottom: 20 },
  countryOption: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  countryOptionSelected: { backgroundColor: 'rgba(79,195,247,0.08)' },
  countryOptionText: { fontSize: 15, color: '#F8FAFF' },
  countryOptionTextSelected: { color: '#4FC3F7', fontWeight: '600' },
  modalCancelBtn: {
    marginTop: 20, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelText: { color: '#8899AA', fontSize: 15 },
});