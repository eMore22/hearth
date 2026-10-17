import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBillStore } from '../../src/stores/billStore';
import { H } from '../../src/theme/hearthDesign';
import PlaidSandboxPreview from '../../src/components/finance/PlaidSandboxPreview';

const monthlyEquivalent = (amount: number, cycle: string) => {
  switch ((cycle || '').toLowerCase()) {
    case 'weekly': return amount * 52 / 12;
    case 'monthly': case 'month': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': case 'annual': return amount / 12;
    default: return null;
  }
};

export default function HouseholdFinance() {
  const insets = useSafeAreaInsets();
  const bills = useBillStore(state => state.bills);
  const fetchBills = useBillStore(state => state.fetchBills);
  useEffect(() => { fetchBills(); }, [fetchBills]);

  const { amounts, upcoming, unknown } = useMemo(() => {
    const totals: Record<string, number> = {};
    let unknownCount = 0;
    const active = bills.filter(b => b.is_active !== false);
    for (const bill of active) {
      const amount = Number(bill.amount);
      const monthly = monthlyEquivalent(amount, bill.billing_cycle);
      const currency = String(bill.currency || 'Unspecified').toUpperCase();
      if (monthly === null || !Number.isFinite(monthly)) { unknownCount++; continue; }
      totals[currency] = (totals[currency] || 0) + monthly;
    }
    const next = active.filter(b => b.next_due_date && !Number.isNaN(Date.parse(b.next_due_date)))
      .sort((a, b) => Date.parse(a.next_due_date!) - Date.parse(b.next_due_date!)).slice(0, 6);
    return { amounts: Object.entries(totals), upcoming: next, unknown: unknownCount };
  }, [bills]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(insets.top, 14), paddingBottom: 42 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={23} color={H.navy} /></TouchableOpacity>
        <Text style={styles.title}>Household Finance</Text>
      </View>
      <Text style={styles.subtitle}>Your recorded bills and subscriptions, in one place.</Text>

      <View style={styles.card}>
        <View style={styles.status}><Ionicons name="lock-closed-outline" size={17} color={H.muted} /><Text style={styles.statusTitle}>Bank accounts are not connected</Text></View>
        <Text style={styles.body}>Hearth does not have access to your bank balance or transactions. Secure, consent-based read-only bank syncing is being prepared. You will always choose whether to connect a bank.</Text>
      </View>

      <PlaidSandboxPreview />

      <Text style={styles.heading}>Estimated monthly commitments</Text>
      <Text style={styles.note}>Calculated only from manually tracked bills. This is not an account balance or confirmed bank spending.</Text>
      <View style={styles.card}>
        {amounts.length ? amounts.map(([currency, amount]) => (
          <View key={currency} style={styles.amountRow}><Text style={styles.currency}>{currency}</Text><Text style={styles.amount}>{amount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</Text></View>
        )) : <Text style={styles.body}>No recurring bill amounts recorded yet.</Text>}
        {unknown > 0 && <Text style={styles.note}>{unknown} item(s) with unsupported billing cycles not included.</Text>}
      </View>

      <Text style={styles.heading}>Upcoming bill dates</Text>
      <View style={styles.card}>
        {upcoming.length ? upcoming.map(b => (
          <View key={b.id} style={styles.billRow}>
            <View style={{ flex: 1 }}><Text style={styles.billName}>{b.provider || 'Bill'}</Text><Text style={styles.note}>{b.next_due_date?.slice(0, 10)} · {b.billing_cycle}</Text></View>
            <Text style={styles.billAmount}>{b.currency || '—'} {Number(b.amount || 0).toLocaleString()}</Text>
          </View>
        )) : <Text style={styles.body}>No upcoming due dates saved in Hearth.</Text>}
      </View>

      <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/bills')}>
        <Text style={styles.ctaText}>Manage bills & subscriptions</Text>
        <Ionicons name="arrow-forward" size={19} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.footer}>Bank linking, transaction imports, reconciliation and spending intelligence will only appear here after an approved read-only integration is configured.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: '800', color: H.navy },
  subtitle: { marginHorizontal: 20, marginTop: 13, marginBottom: 20, fontSize: 13, color: H.muted },
  card: { marginHorizontal: 18, backgroundColor: '#fff', borderColor: H.lineSoft, borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  statusTitle: { color: H.navy, fontSize: 14, fontWeight: '800' },
  body: { color: H.muted, lineHeight: 21, fontSize: 12.5 },
  heading: { color: H.navy, marginHorizontal: 20, marginBottom: 9, marginTop: 7, fontSize: 17, fontWeight: '800' },
  note: { fontSize: 11.5, color: H.muted, lineHeight: 17, marginHorizontal: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  currency: { fontSize: 13, color: H.navy, fontWeight: '700' },
  amount: { fontSize: 20, color: H.navy, fontWeight: '800' },
  billRow: { paddingVertical: 10, flexDirection: 'row', gap: 10, alignItems: 'center', borderBottomColor: H.lineSoft, borderBottomWidth: 1 },
  billName: { fontSize: 13, fontWeight: '700', color: H.navy, marginBottom: 4 },
  billAmount: { fontSize: 12, color: H.navy, fontWeight: '700' },
  cta: { marginHorizontal: 18, borderRadius: 16, backgroundColor: H.purple, paddingHorizontal: 16, minHeight: 52, justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row', marginTop: 6 },
  ctaText: { fontSize: 13, color: '#fff', fontWeight: '800' },
  footer: { marginHorizontal: 21, marginTop: 16, color: H.muted, lineHeight: 18, fontSize: 11 },
});
