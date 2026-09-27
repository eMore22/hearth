import React, { useEffect } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDocumentStore } from '../../src/stores/documentStore';
import { useBillStore } from '../../src/stores/billStore';
import { useGroceryStore } from '../../src/stores/groceryStore';
import { useMaintenanceStore } from '../../src/stores/maintenanceStore';
import { useHealthStore } from '../../src/stores/healthStore';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { getCurrencySymbol } from '../../src/utils/currency';
import { H, HearthDesign } from '../../src/theme/hearthDesign';

const moduleMeta = [
  { key: 'documents', title: 'Documents', icon: 'document-text-outline' as const, route: '/(tabs)/documents', bg: H.blueBg, fg: H.blue },
  { key: 'bills', title: 'Bills & Subscriptions', icon: 'card-outline' as const, route: '/(tabs)/bills', bg: H.violetBg, fg: H.violet },
  { key: 'grocery', title: 'Grocery & Meals', icon: 'basket-outline' as const, route: '/(tabs)/grocery', bg: H.greenBg, fg: H.green },
  { key: 'maintenance', title: 'Home & Maintenance', icon: 'construct-outline' as const, route: '/(tabs)/maintenance', bg: H.amberBg, fg: H.amber },
  { key: 'health', title: 'Family Health', icon: 'heart-outline' as const, route: '/(tabs)/health', bg: H.redBg, fg: H.red },
] as const;

export default function HouseholdScreen() {
  const insets = useSafeAreaInsets();
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const documents = useDocumentStore(s => s.documents);
  const alerts = useDocumentStore(s => s.alerts);
  const fetchDocuments = useDocumentStore(s => s.fetchDocuments);
  const fetchAlerts = useDocumentStore(s => s.fetchAlerts);
  const bills = useBillStore(s => s.bills);
  const fetchBills = useBillStore(s => s.fetchBills);
  const inventory = useGroceryStore(s => s.inventory);
  const fetchInventory = useGroceryStore(s => s.fetchInventory);
  const maintenanceTasks = useMaintenanceStore(s => s.tasks);
  const fetchTasks = useMaintenanceStore(s => s.fetchTasks);
  const medications = useHealthStore(s => s.medications);
  const fetchMedications = useHealthStore(s => s.fetchMedications);

  useEffect(() => {
    if (!household) fetchHousehold();
    fetchDocuments(); fetchAlerts(); fetchBills(); fetchInventory(); fetchTasks(); fetchMedications();
  }, []);

  const currency = getCurrencySymbol(household?.currency);
  const billTotal = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const openMaintenance = maintenanceTasks.filter(t => !t.completed).length;
  const statuses: Record<string, { line1: string; line2: string }> = {
    documents: { line1: `${documents.length} stored`, line2: alerts.length ? `${alerts.length} need attention` : 'Everything organised' },
    bills: { line1: `${bills.length} active`, line2: bills.length ? `${currency}${billTotal.toLocaleString()} tracked` : 'No bills added' },
    grocery: { line1: `${inventory.length} pantry items`, line2: 'Meals and shopping' },
    maintenance: { line1: openMaintenance ? `${openMaintenance} open tasks` : 'All clear', line2: 'Home care & devices' },
    health: { line1: medications.length ? `${medications.length} medications` : 'No active items', line2: 'Family health records' },
  };

  const attentionCount = alerts.length + openMaintenance;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 14 }]}>
        <View style={styles.topline}>
          <View>
            <Text style={styles.eyebrow}>HEARTH</Text>
            <Text style={styles.title}>Your Household</Text>
            <Text style={styles.sub}>Everything Hearth manages, in one place.</Text>
          </View>
          <TouchableOpacity style={styles.settings} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.75}>
            <Ionicons name="settings-outline" size={20} color={H.navy} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, { backgroundColor: attentionCount ? '#FFF0D8' : H.greenBg }]}>
            <Ionicons name={attentionCount ? 'alert-outline' : 'checkmark'} size={21} color={attentionCount ? H.amber : H.green} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>{attentionCount ? `${attentionCount} household item${attentionCount === 1 ? '' : 's'} need attention` : 'Everything looks good'}</Text>
            <Text style={styles.statusSub}>Hearth is monitoring your documents, home, bills, food and health.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Manage your household</Text>
        <View style={styles.grid}>
          {moduleMeta.map(m => (
            <TouchableOpacity key={m.key} style={styles.moduleCard} onPress={() => router.push(m.route as any)} activeOpacity={0.84}>
              <View style={[styles.moduleIcon, { backgroundColor: m.bg }]}><Ionicons name={m.icon} size={23} color={m.fg} /></View>
              <Text style={styles.moduleTitle}>{m.title}</Text>
              <Text style={styles.moduleLine}>{statuses[m.key].line1}</Text>
              <Text style={styles.moduleSub}>{statuses[m.key].line2}</Text>
              <View style={styles.moduleArrow}><Ionicons name="chevron-forward" size={17} color={H.muted} /></View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.chiefCard} onPress={() => router.push('/(tabs)/chief-of-staff')} activeOpacity={0.87}>
          <View style={styles.chiefIcon}><Ionicons name="sparkles" size={22} color="#CBBEFF" /></View>
          <View style={styles.flex}><Text style={styles.chiefTitle}>Ask Hearth about your household</Text><Text style={styles.chiefSub}>Get answers across every area, without hunting through tabs.</Text></View>
          <Ionicons name="arrow-forward" size={19} color="#CBBEFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  content: { paddingHorizontal: 18, paddingBottom: 34 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 10.5, fontWeight: '900', letterSpacing: 2, color: H.purple },
  title: { color: H.navy, fontSize: 33, lineHeight: 39, fontWeight: '800', marginTop: 5, letterSpacing: -0.8 },
  sub: { color: H.muted, fontSize: 14, marginTop: 5 },
  settings: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F1EFEE', alignItems: 'center', justifyContent: 'center' },
  statusCard: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: H.lineSoft, padding: 16, ...HearthDesign.shadow.card },
  statusIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { color: H.navy, fontWeight: '800', fontSize: 14.5 },
  statusSub: { color: H.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  flex: { flex: 1, minWidth: 0 },
  sectionTitle: { color: H.navy, fontSize: 21, fontWeight: '800', marginTop: 28, marginBottom: 13, letterSpacing: -0.35 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moduleCard: { width: '48.5%', minHeight: 174, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: H.lineSoft, padding: 15, position: 'relative', ...HearthDesign.shadow.card },
  moduleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  moduleTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800', lineHeight: 19, paddingRight: 18 },
  moduleLine: { color: H.navy, fontSize: 12.5, fontWeight: '700', marginTop: 9 },
  moduleSub: { color: H.muted, fontSize: 11.5, marginTop: 2 },
  moduleArrow: { position: 'absolute', right: 12, bottom: 12, width: 29, height: 29, borderRadius: 15, backgroundColor: '#F7F6F6', alignItems: 'center', justifyContent: 'center' },
  chiefCard: { marginTop: 20, borderRadius: 22, backgroundColor: H.navy2, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, ...HearthDesign.shadow.floating },
  chiefIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(118,80,232,0.24)', alignItems: 'center', justifyContent: 'center' },
  chiefTitle: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  chiefSub: { color: '#AEB6D7', fontSize: 11.5, lineHeight: 16.5, marginTop: 3 },
});
