import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { H } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

type Utility = {
  name: string;
  category: string;
  currency: string | null;
  amount: string | null;
  next_due_date: string | null;
  days_until_due: number | null;
  provider_connected: boolean;
};
type Overview = {
  utilities: Utility[];
  source: string;
  payments_enabled: boolean;
};
const CATEGORIES = ['electricity', 'water', 'internet', 'gas', 'television'];

export default function UtilitiesScreen() {
  const insets = useSafeAreaInsets();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meterMessage, setMeterMessage] = useState<string | null>(null);
  const [vtpassAvailable, setVtpassAvailable] = useState(false);
  const [vtpassMessage, setVtpassMessage] = useState<string | null>(null);
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const load = useCallback(async () => {
    try {
      const result = await api.get<Overview>('/api/utilities/overview');
      setOverview(result.data);
      setError(null);
    } catch {
      setError('Unable to read household utilities right now.');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get<{meter_verification_available: boolean}>('/api/utilities/sandbox/vtpass/capabilities')
      .then(r => setVtpassAvailable(r.data.meter_verification_available))
      .catch(() => setVtpassAvailable(false));
  }, []);
  const verifyVtpass = async () => {
    setChecking(true); setVtpassMessage(null);
    try {
      const { data } = await api.post('/api/utilities/sandbox/vtpass/verify-meter', {
        service_id: 'enugu-electric',
        meter_type: meterType,
        meter_number: meterType === 'prepaid' ? '1111111111111' : '1010101010101',
      });
      setVtpassMessage(data.provider_verified && data.valid
        ? 'VTpass Sandbox successfully verified this TEST meter. No real meter or utility payment is involved.'
        : 'VTpass Sandbox did not verify the simulated meter.');
    } catch (e: any) {
      setVtpassMessage(e?.response?.status === 404
        ? 'VTpass Sandbox test is not enabled for this account.'
        : 'VTpass did not complete the Sandbox verification. You can retry.');
    } finally { setChecking(false); }
  };

  const tryMeter = async () => {
    setChecking(true);
    setMeterMessage(null);
    try {
      const { data } = await api.post('/api/utilities/sandbox/check-meter', {
        service_id: 'enugu-electric', meter_type: 'prepaid', meter_number: '1111111111111',
      });
      setMeterMessage(data.valid
        ? 'Local test passed. This is a simulated meter, not a verified provider account.'
        : 'Local simulated meter was not recognized.');
    } catch (e: any) {
      setMeterMessage(e?.response?.status === 404
        ? 'Utility test access is not enabled for this account yet.'
        : 'Could not run the local utility test.');
    } finally { setChecking(false); }
  };

  return <View style={s.page}>
    <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
    <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 42 }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { setBusy(true); load(); }} />}>
      <ScreenHeader backTo="/(tabs)/integrations" title="Household utilities"
        subtitle="Electricity, water, internet and recurring services." />
      <View style={s.body}>
        <View style={s.info}>
          <Ionicons name="information-circle-outline" color={H.purple} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Manual bills, not provider balances</Text>
            <Text style={s.note}>Hearth uses bills already saved in your household. Live meter readings, provider verification and payments are not enabled.</Text>
          </View>
        </View>
        {error ? <Text style={s.warning}>{error}</Text> : null}
        <Text style={s.heading}>Your tracked utilities</Text>
        {busy && !overview ? <ActivityIndicator color={H.purple} /> : null}
        {!busy && overview?.utilities?.length === 0
          ? <Text style={s.note}>No utilities have been recorded yet. Add one under Household Bills to see it here.</Text>
          : overview?.utilities?.map((item, i) =>
            <View key={i} style={s.bill}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>{item.category.toUpperCase()} · {item.next_due_date ? `Due ${item.next_due_date}` : 'Due date not recorded'}</Text>
                <Text style={s.meta}>Saved record, not payment confirmation</Text>
              </View>
              <Text style={s.amount}>{item.amount === null ? 'Not set' : `${item.currency || '?'} ${item.amount}`}</Text>
            </View>)}
        <TouchableOpacity style={s.action} onPress={() => router.push('/(tabs)/bills')}>
          <Text style={s.actionText}>Manage household bills</Text><Ionicons name="arrow-forward" color="#fff" size={18} />
        </TouchableOpacity>
        <Text style={s.heading}>Utility integrations</Text>
        {CATEGORIES.map(c => <View key={c} style={s.service}>
          <Ionicons name={c === 'electricity' ? 'flash-outline' : c === 'water' ? 'water-outline' :
            c === 'internet' ? 'wifi-outline' : c === 'gas' ? 'flame-outline' : 'tv-outline'} size={21} color={H.muted}/>
          <Text style={s.serviceName}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
          <Text style={s.coming}>Provider connection pending</Text>
        </View>)}
        <Text style={s.heading}>Simulated electricity test</Text>
        <Text style={s.note}>Optional local test only. Uses a fictional prepaid meter example. It does not call VTpass or pay a utility bill.</Text>
        <TouchableOpacity disabled={checking} style={[s.soft, checking && { opacity: .5 }]} onPress={tryMeter}>
          {checking ? <ActivityIndicator color={H.purple} /> : <Text style={s.softText}>Run local meter test</Text>}
        </TouchableOpacity>
        {!!meterMessage && <Text style={s.note}>{meterMessage}</Text>}
        <Text style={s.heading}>VTpass electricity Sandbox</Text>
        <Text style={s.note}>This checks a documented TEST meter with the actual VTpass Sandbox API. It does not use your personal meter number, vend electricity or make a payment.</Text>
        <View style={{flexDirection:'row', gap:9, marginTop:12}}>
          {(['prepaid','postpaid'] as const).map(t => <TouchableOpacity key={t} onPress={()=>setMeterType(t)}
            style={[s.soft,{flex:1,marginTop:0},meterType===t && {borderWidth:1,borderColor:H.purple}]}>
            <Text style={s.softText}>{t==='prepaid'?'Prepaid test':'Postpaid test'}</Text>
          </TouchableOpacity>)}
        </View>
        <TouchableOpacity disabled={checking || !vtpassAvailable}
          style={[s.action,(!vtpassAvailable||checking) && {opacity:.45}]}
          onPress={verifyVtpass}>
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={s.actionText}>Verify with VTpass Sandbox</Text>}
          <Ionicons name="shield-checkmark-outline" size={20} color="#fff"/>
        </TouchableOpacity>
        {!vtpassAvailable && <Text style={s.note}>VTpass provider test is unavailable until authorized Sandbox credentials and tester access are confirmed.</Text>}
        {!!vtpassMessage && <Text style={s.note}>{vtpassMessage}</Text>}
      </View>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: H.paper }, body: { paddingHorizontal: 18 },
  info: { backgroundColor: '#F0EBFF', borderRadius: 20, padding: 15, flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontWeight: '800', color: H.navy }, note: { fontSize: 12, color: H.muted, lineHeight: 19, marginTop: 4 },
  heading: { fontSize: 18, fontWeight: '800', color: H.navy, marginTop: 24, marginBottom: 12 },
  bill: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: H.lineSoft,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { fontSize: 13, fontWeight: '800', color: H.navy }, meta: { fontSize: 11, color: H.muted, marginTop: 5 },
  amount: { color: H.navy, fontSize: 12, fontWeight: '800' },
  action: { backgroundColor: H.purple, marginTop: 12, borderRadius: 15, minHeight: 48, paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { fontWeight: '800', color: '#fff', fontSize: 13 },
  service: { backgroundColor: '#fff', paddingHorizontal: 14, minHeight: 60, marginBottom: 7,
    alignItems: 'center', flexDirection: 'row', gap: 10, borderRadius: 15 },
  serviceName: { color: H.navy, fontWeight: '700', flex: 1, fontSize: 13 },
  coming: { color: H.muted, fontSize: 10 },
  soft: { backgroundColor: '#EDE8FF', padding: 14, borderRadius: 14, marginTop: 12, alignItems: 'center' },
  softText: { fontSize: 13, color: H.purple, fontWeight: '800' },
  warning: { color: H.red, marginTop: 12 },
});
