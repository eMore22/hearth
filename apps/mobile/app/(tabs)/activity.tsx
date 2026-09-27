import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutomationStore } from '../../src/stores/automationStore';
import { useDocumentStore } from '../../src/stores/documentStore';
import { useBillStore } from '../../src/stores/billStore';
import { useGroceryStore } from '../../src/stores/groceryStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

const filters = ['All', 'Alerts', 'Bills', 'Documents', 'Home'];

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { events, fetchEvents } = useAutomationStore();
  const { alerts, fetchAlerts } = useDocumentStore();
  const { bills, fetchBills } = useBillStore();
  const { shoppingList, fetchInventory } = useGroceryStore();
  const [filter, setFilter] = useState('All');

  useEffect(() => { fetchEvents(); fetchAlerts(); fetchBills(); fetchInventory(); }, []);

  const items = useMemo(() => {
    const all: Array<{ id: string; category: string; title: string; meta: string; icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = [];
    events.slice(0, 8).forEach(e => all.push({ id: `event-${e.id}`, category: 'Home', title: e.attributes?.friendly_name || e.attributes?.chief_message || 'Home activity', meta: e.created_at ? new Date(e.created_at).toLocaleString('en-CA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Recently', icon: 'home-outline', bg: H.amberBg, fg: H.amber }));
    alerts.slice(0, 5).forEach((a, i) => all.push({ id: `alert-${a.document_id || i}`, category: 'Documents', title: a.title || 'Document alert', meta: a.message || 'Document needs attention', icon: 'document-text-outline', bg: H.redBg, fg: H.red }));
    bills.slice(0, 3).forEach(b => all.push({ id: `bill-${b.id}`, category: 'Bills', title: `${b.provider} tracked`, meta: `${b.billing_cycle} bill`, icon: 'card-outline', bg: H.violetBg, fg: H.violet }));
    if (shoppingList) all.push({ id: 'grocery-list', category: 'Alerts', title: 'Grocery list ready', meta: `${shoppingList.total_items} items`, icon: 'basket-outline', bg: H.greenBg, fg: H.green });
    return filter === 'All' ? all : all.filter(i => i.category === filter || (filter === 'Alerts' && i.category === 'Documents'));
  }, [events, alerts, bills, shoppingList, filter]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Activity" subtitle="Everything Hearth has done for you." back={false} />
        <View style={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {filters.map(f => <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}><Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text></TouchableOpacity>)}
          </ScrollView>

          <Text style={styles.dayTitle}>Recent</Text>
          {items.length === 0 ? (
            <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="pulse-outline" size={22} color={H.purple} /></View><Text style={styles.emptyTitle}>No recent activity</Text><Text style={styles.emptySub}>When Hearth detects, reminds or organises something, it’ll show up here.</Text></View>
          ) : items.map(item => (
            <View key={item.id} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: item.bg }]}><Ionicons name={item.icon} size={20} color={item.fg} /></View>
              <View style={styles.flex}><Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.meta} numberOfLines={1}>{item.meta}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper }, body: { paddingHorizontal: 18 }, flex: { flex: 1, minWidth: 0 },
  filters: { gap: 8, paddingVertical: 6, paddingBottom: 18 }, filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F0F0F1' }, filterChipActive: { backgroundColor: H.navy }, filterText: { color: H.navy, fontSize: 12, fontWeight: '700' }, filterTextActive: { color: '#fff' },
  dayTitle: { color: H.navy, fontSize: 20, fontWeight: '800', marginBottom: 11 }, row: { minHeight: 70, borderRadius: 18, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card }, icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' }, meta: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 25 }, emptyIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: H.navy, fontSize: 16, fontWeight: '800', marginTop: 12 }, emptySub: { color: H.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
