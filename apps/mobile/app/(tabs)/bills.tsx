import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBillStore } from '../../src/stores/billStore';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { getCurrencySymbol } from '../../src/utils/currency';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { EmptyMessage, IconBadge, ScreenHeader } from '../../src/components/ui/PremiumKit';

const filters = ['All', 'Bills', 'Subscriptions', 'Housing', 'Other'];

const categoryFor = (category = '', provider = '') => {
  const text = `${category} ${provider}`.toLowerCase();
  if (text.includes('rent') || text.includes('mortgage') || text.includes('housing')) return 'Housing';
  if (text.includes('subscription') || ['spotify', 'netflix', 'youtube', 'apple', 'prime'].some(x => text.includes(x))) return 'Subscriptions';
  if (text.includes('utility') || text.includes('electric') || text.includes('internet') || text.includes('water')) return 'Bills';
  return 'Other';
};

const metaFor = (category = '', provider = '') => {
  const c = categoryFor(category, provider);
  if (c === 'Subscriptions') return { icon: 'play-circle-outline' as const, bg: H.greenBg, fg: H.green };
  if (c === 'Housing') return { icon: 'home-outline' as const, bg: H.amberBg, fg: H.amber };
  if (c === 'Bills') return { icon: 'flash-outline' as const, bg: H.violetBg, fg: H.violet };
  return { icon: 'card-outline' as const, bg: H.blueBg, fg: H.blue };
};

export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const { bills, monthlyReport, unusedSubscriptions, fetchBills, fetchMonthlyReport, createBill, deleteBill, detectUnused, generateNegotiationScript } = useBillStore();
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const [filter, setFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUnused, setShowUnused] = useState(false);
  const [negotiation, setNegotiation] = useState<any | null>(null);

  useEffect(() => {
    if (!household) fetchHousehold();
    fetchBills();
    fetchMonthlyReport().catch(() => undefined);
  }, []);

  const currency = getCurrencySymbol(household?.currency);
  const total = monthlyReport?.total_spent ?? bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const visible = useMemo(() => filter === 'All' ? bills : bills.filter(b => categoryFor(b.category, b.provider) === filter), [bills, filter]);
  const upcoming = bills.find(b => Number(b.amount || 0) > 0);

  const add = async () => {
    if (!provider.trim() || !amount.trim()) {
      Alert.alert('Missing details', 'Add a provider and amount.');
      return;
    }
    const n = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Invalid amount', 'Enter a valid bill amount.');
      return;
    }
    setSaving(true);
    try {
      await createBill({ provider: provider.trim(), amount: n, billing_cycle: 'monthly', category: 'utility' });
      setProvider(''); setAmount(''); setShowAdd(false);
    } catch (e: any) {
      Alert.alert('Could not add bill', e?.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  const findUnused = async () => {
    const result = await detectUnused();
    setShowUnused(true);
    if (!result.length) Alert.alert('Subscription check', 'No obvious unused subscriptions found.');
  };

  const removeBill = (bill: any) => Alert.alert('Delete bill?', `Remove ${bill.provider} from Hearth?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteBill(bill.id); } catch (e: any) { Alert.alert('Could not delete', e?.message || 'Please try again.'); } } },
  ]);

  const getScript = async (provider: string) => {
    try { const result = await generateNegotiationScript(provider, 'current plan'); setNegotiation(result); }
    catch (e: any) { Alert.alert('Could not generate script', e?.message || 'Please try again.'); }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Bills & Subscriptions" subtitle="Track and never miss a payment." right={<TouchableOpacity style={styles.plus} onPress={() => setShowAdd(true)}><Ionicons name="add" size={22} color={H.navy} /></TouchableOpacity>} />
        <View style={styles.body}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Monthly total</Text>
              <Text style={styles.summaryAmount}>{currency}{Number(total || 0).toLocaleString()}</Text>
              <Text style={styles.summarySub}>{bills.length} active</Text>
            </View>
            <TouchableOpacity style={styles.scanCard} onPress={findUnused} activeOpacity={0.82}>
              <View style={styles.scanIcon}><Ionicons name="sparkles-outline" size={20} color={H.purple} /></View>
              <Text style={styles.scanTitle}>Find unused</Text>
              <Text style={styles.scanSub}>subscriptions</Text>
            </TouchableOpacity>
          </View>

          {showUnused && unusedSubscriptions.length > 0 && (
            <View style={styles.savingsWrap}>
              <Text style={styles.savingsTitle}>Potential savings</Text>
              {unusedSubscriptions.map((sub, index) => <View key={`${sub.provider}-${index}`} style={styles.savingCard}>
                <View style={styles.flex}><Text style={styles.rowTitle}>{sub.provider}</Text><Text style={styles.rowMeta}>{sub.reason}</Text></View>
                <View style={styles.savingRight}><Text style={styles.savingAmount}>-{currency}{Number(sub.monthly_savings || 0).toLocaleString()}/mo</Text><TouchableOpacity onPress={() => getScript(sub.provider)}><Text style={styles.scriptLink}>Get script</Text></TouchableOpacity></View>
              </View>)}
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {filters.map(f => <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]} activeOpacity={0.75}><Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text></TouchableOpacity>)}
          </ScrollView>

          {upcoming && (
            <View style={styles.upcomingCard}>
              <IconBadge icon="flash-outline" bg={H.violetBg} color={H.violet} size={48} />
              <View style={styles.flex}><Text style={styles.eyebrow}>UPCOMING PAYMENT</Text><Text style={styles.upcomingTitle}>{upcoming.provider}</Text><Text style={styles.upcomingSub}>{upcoming.billing_cycle} · {currency}{Number(upcoming.amount || 0).toLocaleString()}</Text></View>
              <View style={styles.pay}><Text style={styles.payText}>View</Text></View>
            </View>
          )}

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>All bills</Text><TouchableOpacity style={styles.plus} onPress={() => setShowAdd(true)}><Ionicons name="add" size={22} color={H.navy} /></TouchableOpacity></View>

          {visible.length === 0 ? <EmptyMessage icon="card-outline" title="No bills yet" subtitle="Add recurring bills and subscriptions so Hearth can keep an eye on them." /> : visible.map(bill => {
            const m = metaFor(bill.category, bill.provider);
            return (
              <View key={bill.id} style={styles.row}>
                <IconBadge icon={m.icon} bg={m.bg} color={m.fg} size={44} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{bill.provider}</Text>
                  <Text style={styles.rowMeta}>{currency}{Number(bill.amount || 0).toLocaleString()} · {bill.billing_cycle}</Text>
                </View>
                <View style={[styles.status, { backgroundColor: categoryFor(bill.category, bill.provider) === 'Subscriptions' ? H.greenBg : '#F0EBFF' }]}><Text style={[styles.statusText, { color: categoryFor(bill.category, bill.provider) === 'Subscriptions' ? H.green : H.purple }]}>Active</Text></View>
                <TouchableOpacity onPress={() => removeBill(bill)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={H.red} /></TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!negotiation} transparent animationType="fade" onRequestClose={() => setNegotiation(null)}>
        <View style={styles.modalRoot}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setNegotiation(null)} /><View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 18) + 20 }]}><Text style={styles.modalTitle}>Negotiation script</Text><Text style={styles.modalSub}>Use this as a starting point when contacting the provider.</Text><ScrollView style={{ maxHeight: 320 }}><Text style={styles.scriptBody}>{negotiation?.script || negotiation?.opening_line || JSON.stringify(negotiation, null, 2)}</Text></ScrollView><TouchableOpacity style={styles.save} onPress={() => setNegotiation(null)}><Text style={styles.saveText}>Done</Text></TouchableOpacity></View></View>
      </Modal>

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAdd(false)} />
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 18) + 20 }]}>
            <Text style={styles.modalTitle}>Add a bill</Text>
            <Text style={styles.modalSub}>Hearth will add it to your household overview.</Text>
            <TextInput value={provider} onChangeText={setProvider} placeholder="Provider" placeholderTextColor={H.muted2} style={styles.input} />
            <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={H.muted2} keyboardType="decimal-pad" style={styles.input} />
            <TouchableOpacity style={[styles.save, saving && { opacity: 0.6 }]} onPress={add} disabled={saving}><Text style={styles.saveText}>{saving ? 'Adding…' : 'Add bill'}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  body: { paddingHorizontal: 18 },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F0EF', alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1.4, borderRadius: 22, padding: 17, backgroundColor: H.navy, ...HearthDesign.shadow.card },
  summaryLabel: { color: '#9FA9C8', fontSize: 11.5, fontWeight: '700' },
  summaryAmount: { color: '#fff', fontSize: 27, fontWeight: '800', marginTop: 5, letterSpacing: -0.5 },
  summarySub: { color: '#B5BDD6', fontSize: 11.5, marginTop: 3 },
  scanCard: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: '#E6E0FF', backgroundColor: '#F7F4FF', padding: 15, justifyContent: 'center', ...HearthDesign.shadow.card },
  scanIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EDE6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  scanTitle: { color: H.navy, fontSize: 13.5, fontWeight: '800' },
  scanSub: { color: H.muted, fontSize: 11.5, marginTop: 2 },
  savingsWrap: { marginTop: 16 }, savingsTitle: { color: H.navy, fontSize: 16, fontWeight: '900', marginBottom: 8 }, savingCard: { minHeight: 72, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, savingRight: { alignItems: 'flex-end', maxWidth: 115 }, savingAmount: { color: H.green, fontSize: 11.5, fontWeight: '900' }, scriptLink: { color: H.purple, fontSize: 10.5, fontWeight: '800', marginTop: 6 },
  filters: { gap: 8, paddingVertical: 16 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F0F0F1' },
  filterChipActive: { backgroundColor: H.navy },
  filterText: { color: H.navy, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  upcomingCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8E1FE', backgroundColor: '#F8F5FF', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3, color: H.violet },
  upcomingTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800', marginTop: 3 },
  upcomingSub: { color: H.muted, fontSize: 11.5, marginTop: 2 },
  pay: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, backgroundColor: '#EDE7FF' },
  payText: { color: H.purple, fontSize: 11.5, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: H.navy, fontSize: 20, fontWeight: '800' },
  row: { minHeight: 70, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderRadius: 18, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card },
  rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' },
  rowMeta: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', justifyContent: 'flex-end', paddingHorizontal: 14 },
  modalCard: { borderRadius: 28, backgroundColor: H.paper, padding: 20 },
  modalTitle: { color: H.navy, fontSize: 23, fontWeight: '800' },
  modalSub: { color: H.muted, fontSize: 13, marginTop: 4, marginBottom: 18 },
  input: { height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, paddingHorizontal: 14, color: H.navy, fontSize: 15, marginBottom: 10 },
  save: { height: 52, borderRadius: 17, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  scriptBody: { color: H.navy, fontSize: 13, lineHeight: 20, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: H.lineSoft, padding: 13 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
