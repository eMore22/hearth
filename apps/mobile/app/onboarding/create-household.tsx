import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Household</Text>

      <TextInput
        style={styles.input}
        placeholder="Household Name"
        value={name}
        onChangeText={setName}
        placeholderTextColor="#8899AA"
      />

      <TextInput
        style={styles.input}
        placeholder="Address (Optional)"
        value={address}
        onChangeText={setAddress}
        placeholderTextColor="#8899AA"
      />

      <TextInput
        style={styles.input}
        placeholder="Country"
        value={country}
        onChangeText={setCountry}
        placeholderTextColor="#8899AA"
      />

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={isLoading || !name.trim()}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#F8FAFF', marginBottom: 24 },
  input: {
    backgroundColor: '#162035',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A3F5F',
  },
  button: {
    backgroundColor: '#C77DFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});