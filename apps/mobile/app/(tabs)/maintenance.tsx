import React, { useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaintenanceStore } from '../../src/stores/maintenanceStore';
import { useAutomationStore } from '../../src/stores/automationStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { EmptyMessage, IconBadge, ScreenHeader } from '../../src/components/ui/PremiumKit';

export default function MaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, fetchTasks, diagnoseProblem, isLoading } = useMaintenanceStore();
  const { events, devices, status, fetchEvents, fetchDevices, fetchStatus } = useAutomationStore();
  const [showDiagnose, setShowDiagnose] = useState(false);
  const [issue, setIssue] = useState('');

  useEffect(() => { fetchTasks(); fetchEvents(); fetchDevices(); fetchStatus(); }, []);

  const alertEvent = events.find(e => e.alert_sent && e.attributes?.chief_message);
  const pending = tasks.filter(t => !t.completed);

  const diagnose = async () => {
    if (!issue.trim()) return;
    try {
      const result = await diagnoseProblem(issue.trim());
      setShowDiagnose(false);
      setIssue('');
      Alert.alert(
        result.urgency === 'emergency' ? 'Urgent attention needed' : 'Hearth diagnosis',
        `${result.likely_causes?.[0] || 'Hearth reviewed the issue.'}\n\n${result.diy_check_steps?.slice(0, 2).join('\n') || ''}`,
      );
    } catch (e: any) { Alert.alert('Could not diagnose', e?.message || 'Please try again.'); }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Home & Maintenance" subtitle="Keep your home running smoothly." />
        <View style={styles.body}>
          <View style={styles.statusStrip}>
            <View style={[styles.statusDot, { backgroundColor: status.connected ? H.green : H.muted2 }]} />
            <Text style={styles.statusText}>{status.connected ? `${status.device_count || devices.length} smart-home devices connected` : 'Smart-home integration not connected'}</Text>
            <TouchableOpacity onPress={() => router.push(status.connected ? '/(tabs)/devices' : '/(tabs)/integrations')}><Text style={styles.statusLink}>{status.connected ? 'Devices' : 'Connect'}</Text></TouchableOpacity>
          </View>

          {alertEvent ? (
            <TouchableOpacity style={styles.alertCard} activeOpacity={0.84}>
              <IconBadge icon="home" bg={H.amberIcon} color={H.amber} size={52} />
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>HOME ALERT</Text>
                <Text style={styles.alertTitle}>Moisture detected in the kitchen</Text>
                <Text style={styles.alertSub} numberOfLines={2}>{alertEvent.attributes?.chief_message}</Text>
                <Text style={styles.alertMeta}>Detected · recently</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </TouchableOpacity>
          ) : (
            <View style={styles.clearCard}><View style={styles.clearIcon}><Ionicons name="checkmark" size={20} color={H.green} /></View><View><Text style={styles.clearTitle}>Home looks good</Text><Text style={styles.clearSub}>No smart-home alerts need your attention.</Text></View></View>
          )}

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quick} onPress={() => setShowDiagnose(true)} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.violetBg }]}><Ionicons name="sparkles-outline" size={20} color={H.violet} /></View><Text style={styles.quickText}>Diagnose issue</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quick} onPress={() => router.push('/(tabs)/devices')} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.blueBg }]}><Ionicons name="radio-outline" size={20} color={H.blue} /></View><Text style={styles.quickText}>Smart devices</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quick} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.amberBg }]}><Ionicons name="calendar-outline" size={20} color={H.amber} /></View><Text style={styles.quickText}>Care calendar</Text></TouchableOpacity>
          </View>

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Maintenance</Text><Text style={styles.sectionMeta}>{pending.length} upcoming</Text></View>
          {tasks.length === 0 ? <EmptyMessage icon="construct-outline" title="No maintenance tasks" subtitle="When Hearth finds recurring home-care jobs, they’ll appear here." /> : tasks.map((task, index) => (
            <View key={task.id || `${task.name}-${index}`} style={styles.row}>
              <IconBadge icon="construct-outline" bg={task.completed ? H.greenBg : H.amberBg} color={task.completed ? H.green : H.amber} size={44} />
              <View style={styles.flex}><Text style={styles.rowTitle}>{task.name}</Text><Text style={styles.rowMeta}>{task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString('en-CA', { day: 'numeric', month: 'short' })}` : 'Scheduled maintenance'}{task.diy_friendly ? ' · DIY friendly' : ''}</Text></View>
              <View style={[styles.statusPill, { backgroundColor: task.completed ? H.greenBg : '#FFF0D8' }]}><Text style={[styles.statusPillText, { color: task.completed ? H.green : H.amber }]}>{task.completed ? 'Done' : 'Upcoming'}</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showDiagnose} transparent animationType="fade" onRequestClose={() => setShowDiagnose(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowDiagnose(false)} />
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 18) + 20 }]}>
            <Text style={styles.modalTitle}>Diagnose a home issue</Text>
            <Text style={styles.modalSub}>Describe what you’re seeing, hearing or smelling.</Text>
            <TextInput value={issue} onChangeText={setIssue} placeholder="e.g. Kitchen sink is leaking underneath" placeholderTextColor={H.muted2} multiline style={styles.textarea} />
            <TouchableOpacity style={[styles.save, isLoading && { opacity: 0.6 }]} onPress={diagnose} disabled={isLoading}><Text style={styles.saveText}>{isLoading ? 'Checking…' : 'Ask Hearth'}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper }, body: { paddingHorizontal: 18 }, flex: { flex: 1, minWidth: 0 },
  statusStrip: { height: 44, borderRadius: 16, backgroundColor: '#F2F1F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  statusDot: { width: 7, height: 7, borderRadius: 4 }, statusText: { flex: 1, color: H.muted, fontSize: 11.5, fontWeight: '600' }, statusLink: { color: H.purple, fontSize: 11.5, fontWeight: '800' },
  alertCard: { backgroundColor: H.amberBg, borderWidth: 1, borderColor: '#F2DFC0', borderRadius: 22, padding: 15, flexDirection: 'row', gap: 12, alignItems: 'center', ...HearthDesign.shadow.card },
  eyebrow: { color: H.amber, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 }, alertTitle: { color: H.navy, fontSize: 15, fontWeight: '800', marginTop: 3 }, alertSub: { color: H.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, alertMeta: { color: H.amber, fontSize: 10.5, fontWeight: '700', marginTop: 6 },
  clearCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }, clearIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: H.greenBg, alignItems: 'center', justifyContent: 'center' }, clearTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800' }, clearSub: { color: H.muted, fontSize: 12, marginTop: 3 },
  sectionTitle: { color: H.navy, fontSize: 20, fontWeight: '800', marginTop: 25, marginBottom: 12 }, quickGrid: { flexDirection: 'row', gap: 9 }, quick: { flex: 1, minHeight: 94, borderRadius: 19, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 12, justifyContent: 'center', ...HearthDesign.shadow.card }, quickIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 }, quickText: { color: H.navy, fontSize: 11.2, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, sectionMeta: { color: H.muted, fontSize: 12 },
  row: { minHeight: 70, borderRadius: 18, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 12, marginBottom: 9, flexDirection: 'row', gap: 11, alignItems: 'center', ...HearthDesign.shadow.card }, rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' }, rowMeta: { color: H.muted, fontSize: 11.5, marginTop: 3 }, statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, statusPillText: { fontSize: 10.5, fontWeight: '800' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', justifyContent: 'flex-end', paddingHorizontal: 14 }, modalCard: { borderRadius: 28, backgroundColor: H.paper, padding: 20 }, modalTitle: { color: H.navy, fontSize: 23, fontWeight: '800' }, modalSub: { color: H.muted, fontSize: 13, marginTop: 4, marginBottom: 15 }, textarea: { minHeight: 120, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, padding: 14, color: H.navy, fontSize: 15, textAlignVertical: 'top' }, save: { height: 52, borderRadius: 17, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
