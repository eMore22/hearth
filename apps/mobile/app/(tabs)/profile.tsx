import React, { useEffect } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { useAutomationStore } from '../../src/stores/automationStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

const rowMeta = [
  { key: 'members', label: 'Household members', sub: 'Manage the people in your household', icon: 'people-outline' as const, route: '/(tabs)/members' },
  { key: 'integrations', label: 'Integrations', sub: 'Smart home and connected services', icon: 'link-outline' as const, route: '/(tabs)/integrations' },
  { key: 'preferences', label: 'Preferences', sub: 'Country, currency and timezone', icon: 'options-outline' as const, route: '/(tabs)/preferences' },
  { key: 'privacy', label: 'Privacy & security', sub: 'Password and household data controls', icon: 'lock-closed-outline' as const, route: '/(tabs)/privacy' },
  { key: 'help', label: 'Help & support', sub: 'Get help with Hearth', icon: 'help-circle-outline' as const, route: '/(tabs)/help' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const status = useAutomationStore(s => s.status);
  const fetchStatus = useAutomationStore(s => s.fetchStatus);

  useEffect(() => { fetchHousehold(); fetchStatus(); }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Hearth member';
  const email = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();
  const location = household?.address || household?.country || 'Household location not set';

  const logout = () => Alert.alert('Sign out?', 'You can sign back in anytime.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
  ]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Profile" subtitle="Manage your account and household." back={false} />
        <View style={styles.body}>
          <TouchableOpacity style={styles.identityCard} onPress={() => router.push('/(tabs)/profile-edit')} activeOpacity={0.78}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            <View style={styles.flex}><Text style={styles.name}>{displayName}</Text><Text style={styles.role}>Primary member</Text><Text style={styles.location} numberOfLines={1}>{location}</Text></View>
            <View style={styles.editPill}><Ionicons name="pencil-outline" size={15} color={H.purple} /><Text style={styles.editText}>Edit</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.houseCard} onPress={() => router.push('/(tabs)/preferences')} activeOpacity={0.8}>
            <View style={styles.houseTop}>
              <View style={styles.houseIcon}><Ionicons name="home-outline" size={20} color={H.navy} /></View>
              <View style={styles.flex}><Text style={styles.houseName}>{household?.name || 'My Household'}</Text><Text style={styles.houseSub}>{status.connected ? 'Smart home connected' : 'Household workspace'}</Text></View>
              <View style={[styles.onlineDot, { backgroundColor: status.connected ? H.green : H.muted2 }]} />
            </View>
            <View style={styles.houseStats}>
              <View style={styles.houseStat}><Text style={styles.houseStatValue}>{household?.currency || '—'}</Text><Text style={styles.houseStatLabel}>Currency</Text></View>
              <View style={styles.divider} />
              <View style={styles.houseStat}><Text style={styles.houseStatValue}>{household?.country || '—'}</Text><Text style={styles.houseStatLabel}>Country</Text></View>
              <View style={styles.divider} />
              <View style={styles.houseStat}><Text style={styles.houseStatValue}>{status.device_count || 0}</Text><Text style={styles.houseStatLabel}>Devices</Text></View>
            </View>
          </TouchableOpacity>

          {!status.connected && (
            <TouchableOpacity style={styles.connectBanner} onPress={() => router.push('/(tabs)/integrations')} activeOpacity={0.8}>
              <View style={styles.connectIcon}><Ionicons name="home-outline" size={19} color={H.blue} /></View>
              <View style={styles.flex}><Text style={styles.connectTitle}>Connect your smart home</Text><Text style={styles.connectSub}>Home Assistant is ready to connect.</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </TouchableOpacity>
          )}

          <Text style={styles.section}>Settings</Text>
          <View style={styles.settingsCard}>
            {rowMeta.map((row, index) => (
              <TouchableOpacity key={row.key} style={[styles.settingRow, index < rowMeta.length - 1 && styles.settingBorder]} onPress={() => router.push(row.route as any)} activeOpacity={0.72}>
                <View style={styles.settingIcon}><Ionicons name={row.icon} size={19} color={H.navy} /></View>
                <View style={styles.flex}><Text style={styles.settingTitle}>{row.label}</Text><Text style={styles.settingSub}>{row.sub}</Text></View>
                {row.key === 'integrations' && status.connected && <View style={styles.connectedPill}><Text style={styles.connectedText}>Connected</Text></View>}
                <Ionicons name="chevron-forward" size={18} color={H.muted2} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.logout} onPress={logout} activeOpacity={0.75}><Ionicons name="log-out-outline" size={19} color={H.red} /><Text style={styles.logoutText}>Sign out</Text></TouchableOpacity>
          {!!email && <Text style={styles.email}>{email}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper }, body: { paddingHorizontal: 18 }, flex: { flex: 1, minWidth: 0 },
  identityCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, ...HearthDesign.shadow.card }, avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E9E5FF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: H.purple, fontSize: 20, fontWeight: '800' }, name: { color: H.navy, fontSize: 15.5, fontWeight: '800' }, role: { color: H.muted, fontSize: 11.5, marginTop: 2 }, location: { color: H.muted, fontSize: 11.5, marginTop: 2 }, editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: H.violetBg }, editText: { color: H.purple, fontSize: 10.5, fontWeight: '800' },
  houseCard: { marginTop: 12, borderRadius: 22, backgroundColor: '#F7F4FF', borderWidth: 1, borderColor: '#E7E0FF', padding: 15 }, houseTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, houseIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, houseName: { color: H.navy, fontSize: 14.5, fontWeight: '800' }, houseSub: { color: H.muted, fontSize: 11.5, marginTop: 2 }, onlineDot: { width: 8, height: 8, borderRadius: 4 }, houseStats: { flexDirection: 'row', marginTop: 15, borderTopWidth: 1, borderTopColor: '#E6DFF8', paddingTop: 13 }, houseStat: { flex: 1, alignItems: 'center' }, houseStatValue: { color: H.navy, fontSize: 14, fontWeight: '800' }, houseStatLabel: { color: H.muted, fontSize: 10, marginTop: 2 }, divider: { width: 1, backgroundColor: '#E1DBF1' },
  connectBanner: { marginTop: 12, minHeight: 70, borderRadius: 19, backgroundColor: H.blueBg, borderWidth: 1, borderColor: '#D9E8FF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, connectIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, connectTitle: { color: H.navy, fontSize: 13.5, fontWeight: '800' }, connectSub: { color: H.muted, fontSize: 10.8, marginTop: 2 },
  section: { color: H.navy, fontSize: 20, fontWeight: '800', marginTop: 25, marginBottom: 11 }, settingsCard: { borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, overflow: 'hidden', ...HearthDesign.shadow.card }, settingRow: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, settingBorder: { borderBottomWidth: 1, borderBottomColor: '#F0EEF2' }, settingIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#F4F3F3', alignItems: 'center', justifyContent: 'center' }, settingTitle: { color: H.navy, fontSize: 13.5, fontWeight: '800' }, settingSub: { color: H.muted, fontSize: 10.8, marginTop: 2 }, connectedPill: { backgroundColor: H.greenBg, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }, connectedText: { color: H.green, fontSize: 8.8, fontWeight: '800' },
  logout: { height: 50, marginTop: 18, borderRadius: 17, backgroundColor: H.redBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, logoutText: { color: H.red, fontSize: 13.5, fontWeight: '800' }, email: { color: H.muted2, fontSize: 10.5, textAlign: 'center', marginTop: 9 },
});
