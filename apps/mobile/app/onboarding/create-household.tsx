import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import api from '../../src/services/api';
import { useHouseholdStore } from '../../src/stores/householdStore';

export default function CreateHouseholdScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [isLoading, setIsLoading] = useState(false);

  const { fetchHousehold } = useHouseholdStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Household name is required');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/api/household/', {
        name: name.trim(),
        address: address.trim() || null,
        country: country.trim(),
      });

      await fetchHousehold();
      router.push('/onboarding/add-members');
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create household';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 1 of 3</Text>
        <Text style={styles.title}>Create Your Household</Text>
        <Text style={styles.description}>
          This is the central place for all your family’s information.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Household Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. The Uguomore Family"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#8899AA"
        />

        <Text style={styles.label}>Address (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Street address"
          value={address}
          onChangeText={setAddress}
          placeholderTextColor="#8899AA"
        />

        <Text style={styles.label}>Country</Text>
        <TextInput
          style={styles.input}
          placeholder="Nigeria"
          value={country}
          onChangeText={setCountry}
          placeholderTextColor="#8899AA"
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!name.trim() || isLoading) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
    backgroundColor: '#162035',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A3F5F',
  },
  footer: { paddingBottom: 40 },
  button: {
    backgroundColor: '#C77DFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});