import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, StatusBar,
  Modal, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { useAutomationStore } from '../../src/stores/automationStore';
import { CURRENCIES } from '../../src/utils/currency';
import { COUNTRIES, getCurrencyForCountry, getTimezoneForCountry } from '../../src/utils/country';
import { TIMEZONES, getTimezoneLabel } from '../../src/utils/timezone';
import { useTheme } from '../../src/theme/ThemeContext';

const NAVY    = '#0A1628';
const SURFACE = '#162035';
const ACCENT  = '#4FC3F7';
const WHITE   = '#F8FAFF';
const MUTED   = '#8899AA';
const DANGER  = '#FF6B6B';
const WARNING = '#FFD166';
const SUCCESS = '#06D6A0';

export default function ProfileScreen() {
  const user     = useAuthStore(s => s.user);
  const signOut  = useAuthStore(s => s.signOut);
  const household        = useHouseholdStore(s => s.household);
  const isLoading        = useHouseholdStore(s => s.isLoading) ?? false;
  const fetchHousehold   = useHouseholdStore(s => s.fetchHousehold);
  const updateHousehold  = useHouseholdStore(s => s.updateHousehold);
  const haStatus         = useAutomationStore(s => s.status);
  const connectHA        = useAutomationStore(s => s.connectHA);
  const fetchHAStatus    = useAutomationStore(s => s.fetchStatus);
  const { mode, toggleTheme } = useTheme();

  const currency = household?.currency || 'NGN';

  const [editName,    setEditName]    = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [isEditing,   setIsEditing]   = useState(false);
  const [saving,      setSaving]      = useState(false);

  const [showHAModal,  setShowHAModal]  = useState(false);
  const [haUrl,        setHaUrl]        = useState('http://192.168.1.10:8123');
  const [haToken,      setHaToken]      = useState('');
  const [haConnecting, setHaConnecting] = useState(false);

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);

  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  useEffect(() => {
    try { fetchHousehold(); } catch {}
    try { fetchHAStatus();  } catch {}
  }, []);

  useEffect(() => {
    if (household) {
      setEditName(household.name    || '');
      setEditAddress(household.address || '');
      setEditCountry(household.country || '');
    }
  }, [household]);

  const handleSave = async () => {
    if (!editName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setSaving(true);

    const countryChanged = editCountry !== (household?.country || '');
    const derivedCurrency = countryChanged ? getCurrencyForCountry(editCountry) : undefined;
    const derivedTimezone = countryChanged ? getTimezoneForCountry(editCountry) : undefined;

    try {
      await updateHousehold({
        name:    editName.trim(),
        address: editAddress.trim() || undefined,
        country: editCountry || undefined,
        ...(derivedCurrency ? { currency: derivedCurrency } : {}),
        ...(derivedTimezone ? { timezone: derivedTimezone } : {}),
      });
      setIsEditing(false);
      Alert.alert(
        'Saved',
        derivedCurrency
          ? `Household updated. Currency and timezone set to match ${editCountry}.`
          : 'Household updated.'
      );
    } catch (err: any) {
      Alert.alert('Note', err?.message || 'Saved locally.');
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectHA = async () => {
    if (!haUrl.trim())   { Alert.alert('Error', 'Please enter your HA URL');   return; }
    if (!haToken.trim()) { Alert.alert('Error', 'Please enter your HA token'); return; }
    setHaConnecting(true);
    try {
      const result = await connectHA(haUrl.trim(), haToken.trim());
      setShowHAModal(false);
      setHaToken('');
      Alert.alert('🏠 Connected!', result?.message || 'Home Assistant connected.');
    } catch (err: any) {
      Alert.alert('Failed', err?.message || 'Could not reach Home Assistant.');
    } finally {
      setHaConnecting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {
      router.replace('/(auth)/login');
    }
  };

  const handleCurrencySelect = async (newCurrency: string) => {
    setSavingCurrency(true);
    try {
      await updateHousehold({ currency: newCurrency });
    } catch {
      // updateHousehold already falls back to an optimistic local update.
    } finally {
      setSavingCurrency(false);
      setShowCurrencyModal(false);
    }
  };

  const handleTimezoneSelect = async (newTimezone: string) => {
    setSavingTimezone(true);
    try {
      await updateHousehold({ timezone: newTimezone });
    } catch {
      // updateHousehold already falls back to an optimistic local update.
    } finally {
      setSavingTimezone(false);
      setShowTimezoneModal(false);
    }
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0]     ||
    'User';

  const avatarLetter = displayName.charAt(0).toUpperCase();
  const email        = user?.email || '';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => { try { router.back(); } catch { router.replace('/(tabs)/dashboard'); } }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile & Household</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Personal Information</Text>
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

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Household</Text>
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
              <TextInput style={styles.input} value={editName}
                onChangeText={setEditName} placeholder="Household name"
                placeholderTextColor={MUTED} />
              <TextInput style={styles.input} value={editAddress}
                onChangeText={setEditAddress} placeholder="Address (optional)"
                placeholderTextColor={MUTED} />
              <TouchableOpacity style={styles.input} onPress={() => setShowCountryModal(true)}>
                <Text style={{ color: editCountry ? WHITE : MUTED, fontSize: 15 }}>
                  {editCountry
                    ? (COUNTRIES.find(c => c.value === editCountry)?.label || editCountry)
                    : 'Select country'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={WHITE} />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <InfoRow label="Name"    value={household?.name    || '—'} />
              <InfoRow
                label="Country"
                value={COUNTRIES.find(c => c.value === household?.country)?.label || household?.country || '—'}
              />
              <InfoRow label="Address" value={household?.address || '—'} />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <TouchableOpacity style={styles.currencyRow} onPress={() => setShowCurrencyModal(true)} disabled={savingCurrency}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="cash-outline" size={20} color={WARNING} />
              <View>
                <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600' }}>Currency</Text>
                <Text style={{ color: MUTED, fontSize: 13 }}>Applies across the whole household</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {savingCurrency ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <>
                  <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>
                    {CURRENCIES.find(c => c.value === currency)?.label || currency}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={MUTED} />
                </>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.currencyRow} onPress={() => setShowTimezoneModal(true)} disabled={savingTimezone}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="time-outline" size={20} color={ACCENT} />
              <View>
                <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600' }}>Timezone</Text>
                <Text style={{ color: MUTED, fontSize: 13 }}>Controls when reminders arrive</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {savingTimezone ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <>
                  <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>
                    {getTimezoneLabel(household?.timezone)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={MUTED} />
                </>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.currencyRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={20} color={mode === 'dark' ? ACCENT : WARNING} />
              <View>
                <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600' }}>Dark Mode</Text>
                <Text style={{ color: MUTED, fontSize: 13 }}>{mode === 'dark' ? 'Enabled' : 'Disabled'}</Text>
              </View>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(79,195,247,0.4)' }}
              thumbColor={mode === 'dark' ? ACCENT : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Smart Home</Text>
          {haStatus?.connected ? (
            <>
              <View style={styles.haConnectedRow}>
                <View style={styles.haConnectedDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.haConnectedText}>Home Assistant Connected</Text>
                  <Text style={styles.haConnectedSub}>
                    {haStatus.device_count ?? 0} devices · Autopilot active
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={SUCCESS} />
              </View>
              <TouchableOpacity
                style={styles.viewDevicesBtn}
                onPress={() => router.push('/(tabs)/devices')}
              >
                <Ionicons name="grid-outline" size={16} color={ACCENT} />
                <Text style={styles.viewDevicesBtnText}>View all devices</Text>
                <Ionicons name="chevron-forward" size={16} color={MUTED} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              {haStatus.ha_instance_url ? (
                <InfoRow label="Instance URL" value={haStatus.ha_instance_url} />
              ) : null}
              <TouchableOpacity style={styles.reconnectBtn} onPress={() => setShowHAModal(true)}>
                <Text style={styles.reconnectBtnText}>Reconnect / Change Instance</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.haDescription}>
                Connect Home Assistant to give your Chief of Staff eyes and ears in
                the physical home — detect leaks, lock doors, and get cross-domain alerts.
              </Text>
              <TouchableOpacity style={styles.connectHABtn} onPress={() => setShowHAModal(true)}>
                <Ionicons name="home-outline" size={18} color={NAVY} />
                <Text style={styles.connectHABtnText}>🔌 Connect Smart Home</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={DANGER} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showHAModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Connect Smart Home</Text>
              <Text style={styles.modalHint}>Home Assistant instance</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setShowHAModal(false); setHaToken(''); }}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Home Assistant URL</Text>
          <TextInput style={styles.input} value={haUrl} onChangeText={setHaUrl}
            placeholder="http://192.168.1.10:8123" placeholderTextColor={MUTED}
            autoCapitalize="none" keyboardType="url" />

          <Text style={styles.fieldLabel}>Long-lived Access Token</Text>
          <TextInput style={[styles.input, { minHeight: 80 }]}
            value={haToken} onChangeText={setHaToken}
            placeholder="Paste your HA long-lived access token here"
            placeholderTextColor={MUTED} secureTextEntry multiline />

          <View style={styles.haHelpBox}>
            <Ionicons name="information-circle-outline" size={16} color={MUTED} />
            <Text style={styles.haHelpText}>
              In Home Assistant: Profile → Security → Long-lived access tokens → Create Token
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.connectHABtn, { marginTop: 24 }, haConnecting && { opacity: 0.6 }]}
            onPress={handleConnectHA}
            disabled={haConnecting}
          >
            {haConnecting
              ? <ActivityIndicator color={NAVY} />
              : <>
                  <Ionicons name="wifi-outline" size={18} color={NAVY} />
                  <Text style={styles.connectHABtnText}>Test & Connect</Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCurrencyModal} transparent animationType="fade">
        <View style={styles.currencyModalOverlay}>
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>Select Currency</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {CURRENCIES.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.currencyOption,
                    currency === item.value && styles.currencyOptionSelected,
                  ]}
                  onPress={() => handleCurrencySelect(item.value)}
                >
                  <Text style={[
                    styles.currencyOptionText,
                    currency === item.value && styles.currencyOptionTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                  {currency === item.value && (
                    <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.currencyCancelBtn}
              onPress={() => setShowCurrencyModal(false)}
            >
              <Text style={styles.currencyCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCountryModal} transparent animationType="fade">
        <View style={styles.currencyModalOverlay}>
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>Select Country</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {COUNTRIES.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.currencyOption,
                    editCountry === item.value && styles.currencyOptionSelected,
                  ]}
                  onPress={() => {
                    setEditCountry(item.value);
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={[
                    styles.currencyOptionText,
                    editCountry === item.value && styles.currencyOptionTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                  {editCountry === item.value && (
                    <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.currencyCancelBtn}
              onPress={() => setShowCountryModal(false)}
            >
              <Text style={styles.currencyCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimezoneModal} transparent animationType="fade">
        <View style={styles.currencyModalOverlay}>
          <View style={styles.currencyModalCard}>
            <Text style={styles.currencyModalTitle}>Select Timezone</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {TIMEZONES.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.currencyOption,
                    household?.timezone === item.value && styles.currencyOptionSelected,
                  ]}
                  onPress={() => handleTimezoneSelect(item.value)}
                >
                  <Text style={[
                    styles.currencyOptionText,
                    household?.timezone === item.value && styles.currencyOptionTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                  {household?.timezone === item.value && (
                    <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.currencyCancelBtn}
              onPress={() => setShowTimezoneModal(false)}
            >
              <Text style={styles.currencyCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ fontSize: 11, color: '#8899AA', marginBottom: 2 }}>{label}</Text>
    <Text style={{ fontSize: 16, color: '#F8FAFF' }} numberOfLines={2}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  content:   { padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 30, marginTop: 20,
  },
  backBtn: { padding: 6 },
  title:   { fontSize: 20, fontWeight: '700', color: WHITE },
  card: {
    backgroundColor: SURFACE, borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(79,195,247,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 22, fontWeight: '700', color: ACCENT },
  infoName:    { fontSize: 18, fontWeight: '600', color: WHITE },
  infoEmail:   { fontSize: 13, color: MUTED, marginTop: 2 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    fontSize: 15, color: WHITE, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  saveBtn:     { backgroundColor: ACCENT, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  haConnectedRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  haConnectedDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: SUCCESS },
  haConnectedText: { fontSize: 15, fontWeight: '600', color: WHITE },
  haConnectedSub:  { fontSize: 12, color: MUTED, marginTop: 2 },
  reconnectBtn: {
    marginTop: 10, paddingVertical: 10, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  viewDevicesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(79,195,247,0.06)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(79,195,247,0.15)',
  },
  viewDevicesBtnText: { fontSize: 13, color: ACCENT, fontWeight: '600' },
  reconnectBtnText: { color: MUTED, fontSize: 13 },
  haDescription: { fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 16 },
  connectHABtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: WARNING, borderRadius: 14, padding: 16,
  },
  connectHABtnText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)',
  },
  signOutText: { color: DANGER, fontSize: 15, fontWeight: '600' },
  modal:       { flex: 1, backgroundColor: NAVY, padding: 24 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginTop: 20, marginBottom: 24,
  },
  modalTitle:  { fontSize: 24, fontWeight: '700', color: WHITE, marginBottom: 4 },
  modalHint:   { fontSize: 13, color: MUTED },
  modalClose:  { padding: 6, backgroundColor: SURFACE, borderRadius: 10 },
  fieldLabel:  {
    fontSize: 12, fontWeight: '600', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16,
  },
  haHelpBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, marginTop: 4,
  },
  haHelpText: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 18 },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  currencyModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  currencyModalCard: {
    backgroundColor: SURFACE, borderRadius: 16, padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  currencyModalTitle: {
    fontSize: 18, fontWeight: '700', color: WHITE, marginBottom: 20,
  },
  currencyOption: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
  },
  currencyOptionSelected: {
    backgroundColor: 'rgba(79,195,247,0.08)',
  },
  currencyOptionText: {
    fontSize: 15, color: WHITE,
  },
  currencyOptionTextSelected: {
    color: ACCENT, fontWeight: '600',
  },
  currencyCancelBtn: {
    marginTop: 20, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  currencyCancelText: {
    color: MUTED, fontSize: 15,
  },
});
