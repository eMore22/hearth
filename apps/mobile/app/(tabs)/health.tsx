import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useHealthStore } from '../../src/stores/healthStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { EmptyMessage, IconBadge, ScreenHeader } from '../../src/components/ui/PremiumKit';

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const { medications, triageHistory, fetchMedications, triageSymptoms, isLoading } = useHealthStore();
  const [showTriage, setShowTriage] = useState(false);
  const [symptoms, setSymptoms] = useState('');

  useEffect(() => { fetchMedications(); }, []);

  const triage = async () => {
    if (!symptoms.trim()) return;
    Keyboard.dismiss();
    try {
      const result = await triageSymptoms(symptoms.trim());
      setShowTriage(false);
      setSymptoms('');
      Alert.alert('Hearth health guidance', `${result.recommendation}\n\n${result.disclaimer}`);
    } catch (e: any) {
      Alert.alert('Could not complete triage', e?.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Family Health" subtitle="Your household health in one place." />
        <View style={styles.body}>
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={H.muted} />
            <Text style={styles.noticeText}>For informational purposes only. Always consult a healthcare professional.</Text>
          </View>

          <TouchableOpacity style={styles.triageCard} onPress={() => setShowTriage(true)} activeOpacity={0.84}>
            <IconBadge icon="heart-outline" bg={H.redIcon} color={H.red} size={52} />
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>HEALTH TRIAGE</Text>
              <Text style={styles.triageTitle}>Describe symptoms</Text>
              <Text style={styles.triageSub}>Get a structured recommendation for what to do next.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={H.muted2} />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Quick overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{medications.length}</Text><Text style={styles.statLabel}>Medications</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{triageHistory.length}</Text><Text style={styles.statLabel}>Recent triage</Text></View>
            <View style={styles.stat}><Text style={[styles.statValue, { color: H.green }]}>✓</Text><Text style={styles.statLabel}>Monitoring</Text></View>
          </View>

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Medications</Text><TouchableOpacity><Text style={styles.sectionMeta}>Manage</Text></TouchableOpacity></View>
          {medications.length === 0 ? <EmptyMessage icon="medical-outline" title="No medications added" subtitle="Health information you add will stay organised here." /> : medications.map((med, index) => (
            <View key={med.id || `${med.name}-${index}`} style={styles.row}>
              <IconBadge icon="medical-outline" bg={H.redBg} color={H.red} size={44} />
              <View style={styles.flex}><Text style={styles.rowTitle}>{med.name}</Text><Text style={styles.rowMeta}>{med.dosage} · {med.frequency}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </View>
          ))}

          {triageHistory.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent health activity</Text>
              {triageHistory.slice(0, 3).map((item, index) => (
                <View key={`${item.date}-${index}`} style={styles.row}>
                  <IconBadge icon="pulse-outline" bg={H.violetBg} color={H.violet} size={44} />
                  <View style={styles.flex}><Text style={styles.rowTitle} numberOfLines={1}>{item.symptoms}</Text><Text style={styles.rowMeta}>{item.result.triage_level.replace('_', ' ')} · {new Date(item.date).toLocaleDateString('en-CA', { day: 'numeric', month: 'short' })}</Text></View>
                  <Ionicons name="chevron-forward" size={18} color={H.muted2} />
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showTriage} transparent animationType="fade" onRequestClose={() => setShowTriage(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTriage(false)} />
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 18) + 20 }]}>
            <Text style={styles.modalTitle}>Describe symptoms</Text>
            <Text style={styles.modalSub}>Include age, symptoms, how long they’ve lasted, and anything else that may be relevant.</Text>
            <TextInput value={symptoms} onChangeText={setSymptoms} placeholder="e.g. 6-year-old with fever for 2 days" placeholderTextColor={H.muted2} multiline style={styles.textarea} />
            <TouchableOpacity style={[styles.save, isLoading && { opacity: 0.6 }]} onPress={triage} disabled={isLoading}><Text style={styles.saveText}>{isLoading ? 'Checking…' : 'Get triage recommendation'}</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper }, body: { paddingHorizontal: 18 }, flex: { flex: 1, minWidth: 0 },
  notice: { borderRadius: 17, backgroundColor: '#F2F1F0', padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' }, noticeText: { flex: 1, color: H.muted, fontSize: 11.5, lineHeight: 17 },
  triageCard: { marginTop: 14, borderRadius: 22, backgroundColor: H.redBg, borderWidth: 1, borderColor: '#F7DCE0', padding: 15, flexDirection: 'row', gap: 12, alignItems: 'center', ...HearthDesign.shadow.card }, eyebrow: { color: H.red, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 }, triageTitle: { color: H.navy, fontSize: 15, fontWeight: '800', marginTop: 3 }, triageSub: { color: H.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  sectionTitle: { color: H.navy, fontSize: 20, fontWeight: '800', marginTop: 25, marginBottom: 12 }, statsRow: { flexDirection: 'row', gap: 9 }, stat: { flex: 1, borderRadius: 19, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 14, ...HearthDesign.shadow.card }, statValue: { color: H.navy, fontSize: 23, fontWeight: '800' }, statLabel: { color: H.muted, fontSize: 10.5, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }, sectionMeta: { color: H.purple, fontSize: 12, fontWeight: '700' }, row: { minHeight: 70, borderRadius: 18, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card }, rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' }, rowMeta: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', justifyContent: 'flex-end', paddingHorizontal: 14 }, modalCard: { borderRadius: 28, backgroundColor: H.paper, padding: 20 }, modalTitle: { color: H.navy, fontSize: 23, fontWeight: '800' }, modalSub: { color: H.muted, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 15 }, textarea: { minHeight: 130, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, padding: 14, color: H.navy, fontSize: 15, textAlignVertical: 'top' }, save: { height: 52, borderRadius: 17, backgroundColor: H.red, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
