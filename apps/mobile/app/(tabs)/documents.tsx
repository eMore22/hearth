import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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
  const { documents, alerts, fetchDocuments, fetchAlerts, uploadDocument, askQuestion } = useDocumentStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

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

  const saveFile = async (asset: any) => {
    setUploading(true);
    try {
      await uploadDocument(asset);
      setShowAdd(false);
      Alert.alert('Document saved', 'Hearth analysed the file and added it to your document vault.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.response?.data?.detail || e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const chooseGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to upload an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, allowsEditing: false, quality: 0.85 });
    if (!result.canceled) await saveFile(result.assets[0]);
  };

  const askDocuments = async () => {
    if (!question.trim()) return;
    setAsking(true);
    try { setAnswer(await askQuestion(question.trim())); }
    catch (e: any) { Alert.alert('Could not answer', e?.message || 'Please try again.'); }
    finally { setAsking(false); }
  };

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!result.canceled) await saveFile(result.assets[0]);
  };

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
            <TouchableOpacity style={styles.filterButton} onPress={() => setShowAsk(true)} activeOpacity={0.75}><Ionicons name="sparkles-outline" size={19} color={H.purple} /></TouchableOpacity>
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
            <TouchableOpacity style={styles.plus} onPress={() => setShowAdd(true)} activeOpacity={0.75}><Ionicons name="add" size={22} color={H.navy} /></TouchableOpacity>
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

      <Modal visible={showAsk} transparent animationType="fade" onRequestClose={() => setShowAsk(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAsk(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Ask about your documents</Text>
            <Text style={styles.sheetSub}>Ask Hearth about dates, names, policy details or anything extracted from your document vault.</Text>
            <TextInput value={question} onChangeText={setQuestion} placeholder="e.g. When does my passport expire?" placeholderTextColor={H.muted2} style={styles.askInput} multiline />
            <TouchableOpacity style={[styles.askButton, (!question.trim() || asking) && { opacity: .45 }]} onPress={askDocuments} disabled={!question.trim() || asking}><Text style={styles.askButtonText}>{asking ? 'Checking…' : 'Ask Hearth'}</Text></TouchableOpacity>
            {!!answer && <View style={styles.answerCard}><Text style={styles.answerLabel}>ANSWER</Text><Text style={styles.answerText}>{answer}</Text></View>}
          </View>
        </View>
      </Modal>

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => !uploading && setShowAdd(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !uploading && setShowAdd(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add to Documents</Text>
            <Text style={styles.sheetSub}>Scan a paper document, choose an image, or upload a PDF/file.</Text>
            {uploading ? (
              <View style={styles.uploading}><ActivityIndicator color={H.purple} /><Text style={styles.uploadingText}>Hearth is analysing your document…</Text></View>
            ) : (
              <>
                <TouchableOpacity style={styles.addAction} onPress={() => { setShowAdd(false); router.push('/(tabs)/scan'); }}><View style={[styles.actionIcon,{backgroundColor:H.violetBg}]}><Ionicons name="scan-outline" size={22} color={H.purple}/></View><View style={styles.flex}><Text style={styles.actionTitle}>Scan with camera</Text><Text style={styles.actionSub}>Use Hearth’s intelligent scanner and routing</Text></View><Ionicons name="chevron-forward" size={18} color={H.muted2}/></TouchableOpacity>
                <TouchableOpacity style={styles.addAction} onPress={chooseGallery}><View style={[styles.actionIcon,{backgroundColor:H.blueBg}]}><Ionicons name="images-outline" size={22} color={H.blue}/></View><View style={styles.flex}><Text style={styles.actionTitle}>Choose from gallery</Text><Text style={styles.actionSub}>Upload an existing photo of a document</Text></View><Ionicons name="chevron-forward" size={18} color={H.muted2}/></TouchableOpacity>
                <TouchableOpacity style={styles.addAction} onPress={chooseFile}><View style={[styles.actionIcon,{backgroundColor:H.greenBg}]}><Ionicons name="document-attach-outline" size={22} color={H.green}/></View><View style={styles.flex}><Text style={styles.actionTitle}>Upload PDF or file</Text><Text style={styles.actionSub}>PDF and image files are supported</Text></View><Ionicons name="chevron-forward" size={18} color={H.muted2}/></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  modalRoot: { flex: 1, backgroundColor: 'rgba(7,12,25,0.46)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: H.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D9D7D4', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: H.navy, fontSize: 21, fontWeight: '900' },
  sheetSub: { color: H.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  addAction: { minHeight: 74, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: H.navy, fontSize: 13.5, fontWeight: '900' },
  actionSub: { color: H.muted, fontSize: 10.8, marginTop: 2 },
  uploading: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 12 },
  uploadingText: { color: H.muted, fontSize: 12.5, fontWeight: '700' },
  askInput: { minHeight: 88, borderRadius: 17, borderWidth: 1, borderColor: H.line, backgroundColor: '#fff', padding: 13, color: H.navy, fontSize: 14, textAlignVertical: 'top' },
  askButton: { height: 50, borderRadius: 16, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, askButtonText: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
  answerCard: { marginTop: 12, borderRadius: 17, backgroundColor: H.violetBg, borderWidth: 1, borderColor: '#E4DCFF', padding: 13 }, answerLabel: { color: H.purple, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 }, answerText: { color: H.navy, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
});
