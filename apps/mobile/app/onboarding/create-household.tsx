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
} from 'react-native';
import { router } from 'expo-router';
import { householdService } from '../../src/services/api';
import { useHouseholdStore } from '../../src/stores/householdStore';

export default function CreateHouseholdScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [isLoading, setIsLoading] = useState(false);

  const { fetchHousehold } = useHouseholdStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    setIsLoading(true);

    try {
      await householdService.create({
        name: name.trim(),
        address: address.trim() || undefined,
        country: country.trim(),
      });

      await fetchHousehold();
      // Go back to the previous screen – this works both for onboarding and profile edit flows
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

        <Text style={styles.label}>Country</Text>
        <TextInput
          style={styles.input}
          placeholder="Nigeria"
          placeholderTextColor="#8899AA"
          value={country}
          onChangeText={setCountry}
          autoCapitalize="words"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  step: {
    color: '#8899AA',
    fontSize: 14,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#8899AA',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  label: {
    color: '#F8FAFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#162035',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A3F5F',
  },
  footer: {
    paddingBottom: 40,
  },
  button: {
    backgroundColor: '#C77DFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
