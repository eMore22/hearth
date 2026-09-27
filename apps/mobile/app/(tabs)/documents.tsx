import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDocumentStore } from '../../src/stores/documentStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { EmptyMessage, IconBadge, ScreenHeader } from '../../src/components/ui/PremiumKit';

const filters = ['All', 'IDs', 'Travel', 'Home', 'Insurance'];

const filterFor = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('passport') || t.includes('travel') || t.includes('visa')) return 'Travel';
  if (t.includes('insurance')) return 'Insurance';
  if (t.includes('license') || t.includes('licence') || t.includes('birth') || t.includes('id')) return 'IDs';
  if (t.includes('rent') || t.includes('lease') || t.includes('home') || t.includes('property')) return 'Home';
  return 'All';
};

const docIcon = (type: string): { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string } => {
  const f = filterFor(type);
  if (f === 'Travel') return { icon: 'globe-outline', bg: H.redBg, fg: H.red };
  if (f === 'Insurance') return { icon: 'shield-checkmark-outline', bg: H.blueBg, fg: H.blue };
  if (f === 'IDs') return { icon: 'id-card-outline', bg: H.violetBg, fg: H.violet };
  if (f === 'Home') return { icon: 'home-outline', bg: H.amberBg, fg: H.amber };
  return { icon: 'document-text-outline', bg: '#F1F3F6', fg: H.navy };
};

const formatDate = (iso?: string | null) => {
  if (!iso) return 'No expiry';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { documents, alerts, fetchDocuments, fetchAlerts } = useDocumentStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => { fetchDocuments(); fetchAlerts(); }, []);

  const expiredIds = new Set(alerts.filter(a => a.urgency === 'expired' || a.urgency === 'critical').map(a => a.document_id).filter(Boolean));
  const expiredAlert = alerts.find(a => {
    if (!(a.urgency === 'expired' || a.urgency === 'critical')) return false;
    if (filter === 'All') return true;
    const linked = documents.find(d => d.id === a.document_id);
    const type = linked?.document_type || linked?.title || a.title || '';
    return filterFor(type) === filter;
  });

  const visible = useMemo(() => documents.filter(d => {
    const matchesSearch = `${d.title} ${d.document_type} ${d.member_name || ''}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'All' || filterFor(d.document_type || d.title) === filter;
    return matchesSearch && matchesFilter;
  }), [documents, query, filter]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Documents" subtitle="Everything important, organised." />

        <View style={styles.body}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={H.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Search documents..." placeholderTextColor={H.muted2} style={styles.searchInput} />
            </View>
            <TouchableOpacity style={styles.filterButton} activeOpacity={0.75}><Ionicons name="options-outline" size={19} color={H.navy} /></TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {filters.map(f => <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]} activeOpacity={0.75}><Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text></TouchableOpacity>)}
          </ScrollView>

          {expiredAlert && (
            <TouchableOpacity style={styles.alert} activeOpacity={0.86}>
              <IconBadge icon="document-text" bg={H.redIcon} color={H.red} size={50} />
              <View style={styles.flex}><Text style={styles.alertTitle}>{expiredAlert.title || 'Passport expired'}</Text><Text style={styles.alertSub}>{expiredAlert.message || 'Renew to avoid travel issues.'}</Text><Text style={styles.alertMeta}>Expired · review now</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted} />
            </TouchableOpacity>
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your documents</Text>
            <TouchableOpacity style={styles.plus} onPress={() => router.push('/(tabs)/scan')} activeOpacity={0.75}><Ionicons name="add" size={22} color={H.navy} /></TouchableOpacity>
          </View>

          {visible.length === 0 ? <EmptyMessage icon="document-text-outline" title={filter === 'All' ? 'No documents here yet' : `No ${filter.toLowerCase()} documents yet`} subtitle={filter === 'All' ? 'Scan or upload a document and Hearth will organise it for you.' : `Add a ${filter.toLowerCase()} document and Hearth will organise it here.`} /> : visible.map(doc => {
            const icon = docIcon(doc.document_type || doc.title);
            const expired = expiredIds.has(doc.id) || (!!doc.expiry_date && new Date(doc.expiry_date) < new Date());
            return (
              <TouchableOpacity key={doc.id} style={styles.row} activeOpacity={0.82}>
                <IconBadge icon={icon.icon} bg={icon.bg} color={icon.fg} size={44} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={[styles.rowMeta, expired && { color: H.red }]}>{expired ? 'Expired' : doc.expiry_date ? 'Valid' : 'Added'} · {formatDate(doc.expiry_date || doc.created_at)}</Text>
                </View>
                {doc.expiry_date ? <View style={[styles.statusPill, { backgroundColor: expired ? '#FCE5E8' : H.greenBg }]}><Text style={[styles.statusText, { color: expired ? H.red : H.green }]}>{expired ? 'Expired' : 'Valid'}</Text></View> : null}
                <Ionicons name="chevron-forward" size={18} color={H.muted2} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  body: { paddingHorizontal: 18 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchBox: { flex: 1, height: 47, borderRadius: 17, backgroundColor: '#F1F1F2', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: H.navy, fontSize: 14, paddingVertical: 0 },
  filterButton: { width: 45, height: 45, borderRadius: 16, backgroundColor: '#F1F1F2', alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingVertical: 14 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F1F1F2' },
  filterChipActive: { backgroundColor: H.navy },
  filterText: { color: H.navy, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  alert: { backgroundColor: H.redBg, borderWidth: 1, borderColor: '#F8D9DE', borderRadius: 21, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22, ...HearthDesign.shadow.card },
  alertTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800' },
  alertSub: { color: H.muted, fontSize: 12, marginTop: 2 },
  alertMeta: { color: H.red, fontSize: 11, fontWeight: '700', marginTop: 6 },
  flex: { flex: 1, minWidth: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: H.navy, fontSize: 20, fontWeight: '800' },
  plus: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#D9DCE3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 72, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderRadius: 18, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card },
  rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' },
  rowMeta: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  statusText: { fontSize: 10.5, fontWeight: '800' },
});
