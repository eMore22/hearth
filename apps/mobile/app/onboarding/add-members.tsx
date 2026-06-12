import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';

interface Member {
  name: string;
  email?: string;
  relationship?: string;
}

export default function AddMembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addMember = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    const newMember: Member = {
      name: name.trim(),
      email: email.trim() || undefined,
      relationship: relationship.trim() || undefined,
    };

    setMembers([...members, newMember]);
    setName('');
    setEmail('');
    setRelationship('');
  };

  const removeMember = (index: number) => {
    const updated = members.filter((_, i) => i !== index);
    setMembers(updated);
  };

  const handleContinue = async () => {
    setIsLoading(true);

    try {
      // TODO: Call backend to save members if needed
      // For now we just proceed
      router.push('/onboarding/permissions');
    } catch (error) {
      Alert.alert('Error', 'Failed to save members');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Family Members</Text>
      <Text style={styles.subtitle}>
        Add people who should have access to this household (optional).
      </Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#8899AA"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email (optional)"
          placeholderTextColor="#8899AA"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Relationship (e.g. Wife, Son)"
          placeholderTextColor="#8899AA"
          value={relationship}
          onChangeText={setRelationship}
        />

        <TouchableOpacity style={styles.addButton} onPress={addMember}>
          <Text style={styles.addButtonText}>+ Add Member</Text>
        </TouchableOpacity>
      </View>

      {members.length > 0 && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>Added Members ({members.length})</Text>
          <FlatList
            data={members}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.memberItem}>
                <View>
                  <Text style={styles.memberName}>{item.name}</Text>
                  {item.relationship && (
                    <Text style={styles.memberDetail}>{item.relationship}</Text>
                  )}
                  {item.email && (
                    <Text style={styles.memberDetail}>{item.email}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => removeMember(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, isLoading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/onboarding/permissions')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#F8FAFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8899AA', marginBottom: 24 },
  form: { marginBottom: 20 },
  input: {
    backgroundColor: '#162035',
    borderRadius: 12,
    padding: 16,
    color: '#F8FAFF',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3F5F',
  },
  addButton: {
    backgroundColor: '#2A3F5F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#C77DFF', fontWeight: '600', fontSize: 16 },
  listContainer: { flex: 1, marginTop: 10 },
  listTitle: { color: '#F8FAFF', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  memberItem: {
    backgroundColor: '#162035',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: { color: '#F8FAFF', fontSize: 16, fontWeight: '600' },
  memberDetail: { color: '#8899AA', fontSize: 14, marginTop: 2 },
  removeText: { color: '#FF6B6B', fontWeight: '600' },
  footer: { paddingBottom: 40 },
  continueButton: {
    backgroundColor: '#C77DFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  continueText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipText: { color: '#8899AA', textAlign: 'center', fontSize: 16 },
});