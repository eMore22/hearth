import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, StatusBar
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useHouseholdStore } from '../../src/stores/householdStore';

const NAVY = '#0A1628';
const SURFACE = '#162035';
const ACCENT = '#4FC3F7';
const WHITE = '#F8FAFF';
const MUTED = '#8899AA';
const DANGER = '#FF6B6B';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const { household, isLoading, fetchHousehold, updateHousehold } = useHouseholdStore();

  const [editName, setEditName] = useState(household?.name || '');
  const [editAddress, setEditAddress] = useState(household?.address || '');
  const [editCountry, setEditCountry] = useState(household?.country || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    fetchHousehold();
  }, []);

  React.useEffect(() => {
    if (household) {
      setEditName(household.name || '');
      setEditAddress(household.address || '');
      setEditCountry(household.country || '');
    }
  }, [household]);

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Household name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await updateHousehold({
        name: editName.trim(),
        address: editAddress.trim() || undefined,
        country: editCountry.trim() || undefined,
      });
      setIsEditing(false);
      Alert.alert('Success', 'Household updated');
    } catch (err: any) {
      // updateHousehold applies the change locally even on network error,
      // so the UI stays consistent — just show the error message.
      Alert.alert('Note', err.message || 'Could not save to server — changes shown locally');
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Full name fallback chain:
  // 1. user_metadata.full_name (set correctly after today's auth.py fix + re-login)
  // 2. user.email prefix (e.g. "eugene" from eugene@hearth.com)
  // 3. "User" as last resort
  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  const email = user?.email || '';

  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile & Household</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Personal Profile (Read-only) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoName}>{displayName}</Text>
              <Text style={styles.infoEmail}>{email}</Text>
            </View>
          </View>
        </View>

        {/* Household Info (Editable) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Household</Text>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Ionicons name="pencil" size={18} color={ACCENT} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text style={{ color: MUTED, fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Household name"
                placeholderTextColor={MUTED}
              />
              <TextInput
                style={styles.input}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Address (optional)"
                placeholderTextColor={MUTED}
              />
              <TextInput
                style={styles.input}
                value={editCountry}
                onChangeText={setEditCountry}
                placeholder="Country"
                placeholderTextColor={MUTED}
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={WHITE} />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{household?.name || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Country</Text>
                <Text style={styles.infoValue}>{household?.country || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{household?.address || '—'}</Text>
              </View>
            </>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => {
            signOut();
            router.replace('/(auth)/login');
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={DANGER} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  content: { padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 30, marginTop: 20,
  },
  backBtn: { padding: 6 },
  title: { fontSize: 20, fontWeight: '700', color: WHITE },
  card: {
    backgroundColor: SURFACE, borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(79,195,247,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: ACCENT },
  infoName: { fontSize: 18, fontWeight: '600', color: WHITE },
  infoEmail: { fontSize: 13, color: MUTED, marginTop: 2 },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 11, color: MUTED, marginBottom: 2 },
  infoValue: { fontSize: 16, color: WHITE },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    fontSize: 15, color: WHITE, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  saveBtn: {
    backgroundColor: ACCENT, borderRadius: 12, padding: 14,
    alignItems: 'center', marginTop: 10,
  },
  saveBtnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)',
  },
  signOutText: { color: DANGER, fontSize: 15, fontWeight: '600' },
});