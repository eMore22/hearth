import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useDocumentStore } from '../../src/stores/documentStore';
import { useBillStore } from '../../src/stores/billStore';
import { useGroceryStore } from '../../src/stores/groceryStore';
import { useAutomationStore } from '../../src/stores/automationStore';
import { useTaskStore } from '../../src/stores/taskStore';
import { useChiefOfStaffStore } from '../../src/stores/chiefOfStaffStore';
import type { HADevice, SuggestedAction } from '../../src/stores/automationStore';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { getCurrencySymbol } from '../../src/utils/currency';
import { H, HearthDesign } from '../../src/theme/hearthDesign';

const hero = require('../../assets/hearth-hero.jpg');

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const dateLabel = () => new Date().toLocaleDateString('en-CA', {
  weekday: 'short', day: 'numeric', month: 'short',
});

const dueLabel = (iso?: string) => {
  if (!iso) return 'Today';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'short' });
};


const isDeviceOn = (state = '') => ['on', 'open', 'unlocked', 'home', 'true'].includes(state.toLowerCase());

const deviceIcon = (device: HADevice): keyof typeof Ionicons.glyphMap => {
  if (device.domain === 'lock') return 'lock-closed-outline';
  if (device.domain === 'light') return 'bulb-outline';
  if (device.domain === 'cover') return 'home-outline';
  if (device.domain === 'climate') return 'thermometer-outline';
  if (device.domain === 'fan') return 'reorder-three-outline';
  if (device.domain === 'water_heater') return 'water-outline';
  return 'toggle-outline';
};

const deviceStateLabel = (device: HADevice) => {
  const state = (device.last_state || 'unknown').toLowerCase();
  if (device.domain === 'lock') return state === 'locked' ? 'Locked' : state === 'unlocked' ? 'Unlocked' : device.last_state || 'Unknown';
  if (device.domain === 'cover') return state === 'open' ? 'Open' : state === 'closed' ? 'Closed' : device.last_state || 'Unknown';
  if (state === 'on') return 'On';
  if (state === 'off') return 'Off';
  return device.last_state ? device.last_state.charAt(0).toUpperCase() + device.last_state.slice(1) : 'Unknown';
};

const deviceActionLabel = (device: HADevice) => {
  const on = isDeviceOn(device.last_state);
  if (device.domain === 'lock') return on ? 'Lock' : 'Unlock';
  if (device.domain === 'cover') return on ? 'Close' : 'Open';
  return on ? 'Turn off' : 'Turn on';
};

const devicePriority = (device: HADevice) => {
  const name = `${device.friendly_name} ${device.entity_id}`.toLowerCase();
  if (name.includes('water') || name.includes('valve')) return 100;
  if (device.domain === 'lock') return 90;
  if (device.domain === 'light') return 80;
  if (name.includes('garage') || device.domain === 'cover') return 70;
  if (device.domain === 'climate') return 60;
  return 20;
};

const dueOptions = [
  { key: 'none', label: 'No due date' },
  { key: '1hour', label: 'In 1 hour' },
  { key: 'tonight', label: 'Tonight, 6 PM' },
  { key: 'tomorrow', label: 'Tomorrow, 9 AM' },
];

const dueFromOption = (option: string) => {
  const now = new Date();
  if (option === '1hour') return new Date(now.getTime() + 3600000).toISOString();
  if (option === 'tonight') { const d = new Date(now); d.setHours(18,0,0,0); if (d <= now) d.setDate(d.getDate()+1); return d.toISOString(); }
  if (option === 'tomorrow') { const d = new Date(now); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d.toISOString(); }
  return undefined;
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const { alerts, fetchAlerts } = useDocumentStore();
  const { bills, fetchBills, fetchMonthlyReport } = useBillStore();
  const { shoppingList, inventory, fetchInventory } = useGroceryStore();
  const { events, devices, status, fetchEvents, fetchStatus, fetchDevices, executeAction } = useAutomationStore();
  const { tasks, fetchTasks, completeTask, createTask } = useTaskStore();
  const { dashboardSummary, fetchDashboardSummary } = useChiefOfStaffStore();
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [dueOption, setDueOption] = useState('none');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    if (!household) fetchHousehold();
    fetchAlerts();
    fetchBills();
    fetchMonthlyReport().catch(() => undefined);
    fetchInventory();
    fetchEvents();
    fetchStatus();
    fetchDevices();
    fetchTasks();
    fetchDashboardSummary().catch(() => undefined);
  };

  useEffect(() => { load(); }, []);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const currency = getCurrencySymbol(household?.currency);
  const urgentDoc = alerts.find(a => ['expired', 'critical', 'urgent'].includes(a.urgency));
  const homeEvent = events.find((e: any) => e.alert_sent && e.attributes?.chief_message);
  const nextTask = tasks.find(t => !t.is_completed);
  const nextBill = bills.find(b => Number(b.amount || 0) > 0);
  const groceryCount = shoppingList?.total_items || inventory.length;
  const attentionCount = (urgentDoc ? 1 : 0) + (homeEvent ? 1 : 0);

  const quickDevices = useMemo(
    () => [...devices].filter(device => device.is_actionable).sort((a, b) => devicePriority(b) - devicePriority(a)).slice(0, 4),
    [devices],
  );


  const addTask = async () => {
    if (!taskTitle.trim()) { Alert.alert('Task needed', 'Enter what needs doing.'); return; }
    Keyboard.dismiss();
    try {
      await createTask(taskTitle.trim(), undefined, dueFromOption(dueOption));
      setTaskTitle(''); setDueOption('none'); setShowAddTask(false);
    } catch (e: any) { Alert.alert('Could not add task', e?.message || 'Please try again.'); }
  };

  const runQuickDeviceAction = (device: HADevice) => {
    const action = isDeviceOn(device.last_state) ? 'turn_off' : 'turn_on';
    const run = async () => {
      const key = `quick_${device.entity_id}`;
      setActionLoading(key);
      try { await executeAction(device.entity_id, action); }
      catch (e: any) { Alert.alert('Action failed', e?.message || 'Please try again.'); }
      finally { setActionLoading(null); }
    };

    const name = `${device.friendly_name} ${device.entity_id}`.toLowerCase();
    if ((name.includes('water') || name.includes('valve')) && action === 'turn_off') {
      Alert.alert(
        'Shut off water?',
        `Turn off ${device.friendly_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Shut off', style: 'destructive', onPress: run },
        ],
      );
      return;
    }
    run();
  };

  const runHAAction = async (action: SuggestedAction) => {
    if (action.action === 'draft_claim') { router.push('/(tabs)/documents'); return; }
    if (action.action === 'call_emergency') { Alert.alert('Emergency', 'Please call your local emergency services immediately.'); return; }
    if (!action.entity_id) return;
    const key = `${action.entity_id}_${action.action}`; setActionLoading(key);
    try { await executeAction(action.entity_id, action.action); Alert.alert('Done', `${action.label} completed.`); }
    catch (e: any) { Alert.alert('Action failed', e?.message || 'Please try again.'); }
    finally { setActionLoading(null); }
  };

  const locationLabel = useMemo(() => {
    const address = household?.address?.trim();
    if (address) {
      const parts = address.split(',').map(p => p.trim()).filter(Boolean);
      return parts.slice(-2).join(', ');
    }
    if (household?.country === 'CA') return 'Canada';
    return 'Your household';
  }, [household?.address, household?.country]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={H.purple} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={{ paddingBottom: 26 }}
      >
        <ImageBackground source={hero} style={[styles.hero, { paddingTop: Math.max(insets.top, 18) + 10 }]} imageStyle={styles.heroImage} resizeMode="cover">
          <LinearGradient
            colors={['rgba(252,250,247,0.98)', 'rgba(252,250,247,0.82)', 'rgba(252,250,247,0.06)']}
            locations={[0, 0.52, 1]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(251,250,247,0)', H.paper]}
            locations={[0.62, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topbar}>
            <View style={styles.brand}>
              <Ionicons name="home-outline" size={21} color={H.navy} />
              <Text style={styles.brandText}>Hearth HQ</Text>
            </View>
            <View style={styles.topActions}>
              <TouchableOpacity style={styles.roundButton} activeOpacity={0.75}>
                <Ionicons name="notifications-outline" size={20} color={H.navy} />
                {attentionCount > 0 && <View style={styles.notificationDot} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.75}>
                <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{firstName} <Text style={styles.wave}>👋</Text></Text>
            <Text style={styles.meta}>{dateLabel()}  ·  {locationLabel}</Text>
            <Text style={styles.heroSub}>
              {attentionCount ? `Here’s what needs your attention today.` : `Everything looks good. You’re all caught up.`}
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>Needs your attention</Text>
              {attentionCount > 0 && <View style={styles.count}><Text style={styles.countText}>{attentionCount}</Text></View>}
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/activity')} activeOpacity={0.7}>
              <Text style={styles.viewAll}>{attentionCount ? 'View all' : 'Activity'}  ›</Text>
            </TouchableOpacity>
          </View>

          {urgentDoc ? (
            <TouchableOpacity style={[styles.attentionCard, styles.urgentCard]} onPress={() => router.push('/(tabs)/documents')} activeOpacity={0.86}>
              <View style={[styles.attentionIcon, { backgroundColor: H.redIcon }]}><Ionicons name="document-text" size={24} color={H.red} /></View>
              <View style={styles.flex}>
                <Text style={[styles.eyebrow, { color: H.red }]}>URGENT</Text>
                <Text style={styles.attentionTitle}>{urgentDoc.title || 'Document needs attention'}</Text>
                <Text style={styles.attentionSub} numberOfLines={2}>{urgentDoc.message}</Text>
                <View style={[styles.miniChip, { backgroundColor: '#FCE5E8' }]}>
                  <Ionicons name="calendar-outline" size={12} color={H.red} />
                  <Text style={[styles.miniChipText, { color: H.red }]}>Expired · review now</Text>
                </View>
              </View>
              <View style={[styles.primaryAction, { backgroundColor: H.red }]}><Text style={styles.primaryActionText}>Renew</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </TouchableOpacity>
          ) : null}

          {homeEvent ? (
            <TouchableOpacity style={[styles.attentionCard, styles.homeCard]} onPress={() => router.push('/(tabs)/maintenance')} activeOpacity={0.86}>
              <View style={[styles.attentionIcon, { backgroundColor: H.amberIcon }]}><Ionicons name="home" size={24} color={H.amber} /></View>
              <View style={styles.flex}>
                <Text style={[styles.eyebrow, { color: H.amber }]}>HOME</Text>
                <Text style={styles.attentionTitle}>Moisture detected in the kitchen</Text>
                <Text style={styles.attentionSub} numberOfLines={2}>{(homeEvent as any).attributes?.chief_message || 'Check the kitchen for a possible leak.'}</Text>
                <View style={[styles.miniChip, { backgroundColor: '#FFF0D8' }]}>
                  <Ionicons name="water-outline" size={12} color={H.amber} />
                  <Text style={[styles.miniChipText, { color: H.amber }]}>Detected · just now</Text>
                </View>
              </View>
              {(homeEvent as any).attributes?.suggested_actions?.length ? (
                <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: '#F8EAD5' }]} onPress={(e) => { e.stopPropagation?.(); runHAAction((homeEvent as any).attributes.suggested_actions[0]); }} disabled={!!actionLoading}>
                  <Text style={[styles.secondaryActionText, { color: '#6F4312' }]}>{actionLoading ? 'Working…' : (homeEvent as any).attributes.suggested_actions[0].label || 'Take action'}</Text>
                </TouchableOpacity>
              ) : <View style={[styles.secondaryAction, { backgroundColor: '#F8EAD5' }]}><Text style={[styles.secondaryActionText, { color: '#6F4312' }]}>View</Text></View>}
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </TouchableOpacity>
          ) : null}

          {!!dashboardSummary?.chief_message && (
            <TouchableOpacity style={styles.briefCard} onPress={() => router.push('/(tabs)/chief-of-staff')} activeOpacity={0.82}>
              <View style={styles.briefIcon}><Ionicons name="sparkles" size={17} color={H.purple} /></View>
              <View style={styles.flex}><Text style={styles.briefLabel}>HEARTH HQ BRIEF</Text><Text style={styles.briefText} numberOfLines={3}>{dashboardSummary.chief_message}</Text></View>
              <Ionicons name="chevron-forward" size={17} color={H.muted2} />
            </TouchableOpacity>
          )}

          {attentionCount === 0 && (
            <View style={styles.allClear}>
              <View style={styles.allClearIcon}><Ionicons name="checkmark" size={18} color={H.green} /></View>
              <View style={styles.flex}><Text style={styles.allClearTitle}>Everything looks good</Text><Text style={styles.allClearSub}>Hearth HQ is monitoring your household.</Text></View>
            </View>
          )}

          {status.connected && quickDevices.length > 0 && (
            <View style={styles.quickHomeSection}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionTitleWrap}>
                  <Text style={styles.sectionTitle}>Quick home controls</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/devices')} activeOpacity={0.7}>
                  <Text style={styles.viewAll}>Manage  �</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.quickHomeHint}>Large, simple controls for the devices you may need most.</Text>
              <View style={styles.quickHomeList}>
                {quickDevices.map(device => {
                  const on = isDeviceOn(device.last_state);
                  const key = `quick_${device.entity_id}`;
                  return (
                    <View key={device.entity_id} style={styles.quickDeviceRow}>
                      <View style={[styles.quickDeviceIcon, { backgroundColor: on ? H.greenBg : '#F3F2F1' }]}>
                        <Ionicons name={deviceIcon(device)} size={22} color={on ? H.green : H.muted} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.quickDeviceName} numberOfLines={1}>{device.friendly_name}</Text>
                        <Text style={styles.quickDeviceState}>{deviceStateLabel(device)}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.quickDeviceButton, on && styles.quickDeviceButtonOn, actionLoading === key && { opacity: 0.55 }]}
                        onPress={() => runQuickDeviceAction(device)}
                        disabled={actionLoading === key}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`${deviceActionLabel(device)} ${device.friendly_name}`}
                      >
                        <Text style={[styles.quickDeviceButtonText, on && styles.quickDeviceButtonTextOn]}>{actionLoading === key ? 'Working�' : deviceActionLabel(device)}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={[styles.sectionHead, { marginTop: 26 }]}>
            <Text style={styles.sectionTitle}>Today</Text>
            <View style={styles.todayActions}><TouchableOpacity onPress={() => setShowAddTask(true)} style={styles.addTaskMini}><Ionicons name="add" size={16} color={H.purple} /><Text style={styles.addTaskMiniText}>Task</Text></TouchableOpacity><TouchableOpacity onPress={() => router.push('/(tabs)/activity')} activeOpacity={0.7}><Text style={styles.viewAll}>View schedule  ›</Text></TouchableOpacity></View>
          </View>

          <View style={styles.timelineWrap}>
            <View style={styles.timelineLine} />
            {nextTask && (
              <TouchableOpacity style={styles.todayRow} onPress={() => completeTask(nextTask.id)} activeOpacity={0.86}>
                <View style={[styles.timelineDot, { backgroundColor: H.blue }]} />
                <Text style={[styles.sideTime, { color: H.blue }]}>{dueLabel(nextTask.due_at)}</Text>
                <View style={[styles.todayIcon, { backgroundColor: H.blueBg }]}><Ionicons name="calendar-outline" size={20} color={H.blue} /></View>
                <View style={styles.flex}><Text style={styles.todayTitle}>{nextTask.title}</Text><Text style={styles.todaySub}>{nextTask.notes || 'Household task'}</Text></View>
                <View style={styles.checkCircle} />
                <Ionicons name="chevron-forward" size={18} color={H.muted2} />
              </TouchableOpacity>
            )}

            {nextBill && (
              <TouchableOpacity style={styles.todayRow} onPress={() => router.push('/(tabs)/bills')} activeOpacity={0.86}>
                <View style={[styles.timelineDot, { backgroundColor: H.purple }]} />
                <View style={styles.sideTimeSpacer} />
                <View style={[styles.todayIcon, { backgroundColor: H.violetBg }]}><Ionicons name="card-outline" size={20} color={H.violet} /></View>
                <View style={styles.flex}><Text style={styles.todayTitle}>{nextBill.provider}</Text><Text style={styles.todaySub}>{nextBill.billing_cycle} · {currency}{Number(nextBill.amount || 0).toLocaleString()}</Text></View>
                <View style={[styles.softAction, { backgroundColor: '#EFEAFF' }]}><Text style={[styles.softActionText, { color: H.purple }]}>View</Text></View>
                <Ionicons name="chevron-forward" size={18} color={H.muted2} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.todayRow} onPress={() => router.push('/(tabs)/grocery')} activeOpacity={0.86}>
              <View style={[styles.timelineDot, { backgroundColor: H.green }]} />
              <View style={styles.sideTimeSpacer} />
              <View style={[styles.todayIcon, { backgroundColor: H.greenBg }]}><Ionicons name="basket-outline" size={20} color={H.green} /></View>
              <View style={styles.flex}><Text style={styles.todayTitle}>Grocery plan</Text><Text style={styles.todaySub}>{groceryCount ? `${groceryCount} items ready` : 'Ready when you are'}</Text></View>
              <View style={[styles.softAction, { backgroundColor: H.greenBg }]}><Text style={[styles.softActionText, { color: H.green }]}>View list</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.scanCta} activeOpacity={0.9} onPress={() => router.push('/(tabs)/scan')}>
            <LinearGradient colors={['#0B1738', '#171B50', '#3B1D8B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scanGradient}>
              <View style={styles.scanIcon}><Ionicons name="scan-outline" size={27} color="#D9D0FF" /></View>
              <View style={styles.flex}>
                <Text style={styles.scanTitle}>Scan anything</Text>
                <Text style={styles.scanSub}>Passport, bill, receipt, insurance or medical record</Text>
                <Text style={styles.scanMeta}>Hearth HQ reads it and routes it to the right place.</Text>
              </View>
              <View style={styles.scanArrow}><Ionicons name="arrow-forward" size={20} color="#fff" /></View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showAddTask} transparent animationType="fade" onRequestClose={() => setShowAddTask(false)}>
        <KeyboardAvoidingView style={styles.taskModalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAddTask(false)} />
          <View style={styles.taskModalCard}>
            <Text style={styles.taskModalTitle}>Add household task</Text>
            <TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="What needs doing?" placeholderTextColor={H.muted2} style={styles.taskInput} />
            <Text style={styles.taskLabel}>Due</Text>
            <View style={styles.dueWrap}>{dueOptions.map(opt => <TouchableOpacity key={opt.key} style={[styles.dueChip, dueOption === opt.key && styles.dueChipActive]} onPress={() => setDueOption(opt.key)}><Text style={[styles.dueChipText, dueOption === opt.key && styles.dueChipTextActive]}>{opt.label}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity style={styles.taskSave} onPress={addTask}><Text style={styles.taskSaveText}>Add task</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  hero: { minHeight: 330, paddingHorizontal: 22, paddingBottom: 44, overflow: 'hidden' },
  heroImage: { opacity: 1 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { fontFamily: 'serif', fontSize: 25, color: H.navy, fontWeight: '700' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.82)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)' },
  notificationDot: { position: 'absolute', right: 8, top: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF5364', borderWidth: 1.5, borderColor: '#fff' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8E5F5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: H.navy, fontWeight: '800', fontSize: 15 },
  heroCopy: { marginTop: 34, maxWidth: '74%' },
  greeting: { fontFamily: 'serif', color: H.navy, fontSize: 26, lineHeight: 31 },
  name: { color: H.navy, fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.1 },
  wave: { fontSize: 30 },
  meta: { color: '#4F5D75', fontSize: 14, marginTop: 10, fontWeight: '500' },
  heroSub: { color: '#536078', fontSize: 14.5, lineHeight: 21, marginTop: 7 },
  body: { paddingHorizontal: 18, marginTop: -4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sectionTitle: { color: H.navy, fontSize: 23, fontWeight: '800', letterSpacing: -0.45 },
  count: { minWidth: 25, height: 25, paddingHorizontal: 7, borderRadius: 13, backgroundColor: '#FF5B66', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  viewAll: { color: H.muted, fontSize: 13, fontWeight: '600' },
  attentionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 118, borderRadius: 23, borderWidth: 1, marginBottom: 12, ...HearthDesign.shadow.card },
  urgentCard: { backgroundColor: H.redBg, borderColor: '#F7D9DE' },
  homeCard: { backgroundColor: H.amberBg, borderColor: '#F1E1C7' },
  attentionIcon: { width: 55, height: 55, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.65, marginBottom: 4 },
  attentionTitle: { fontSize: 15.5, color: H.navy, fontWeight: '800', letterSpacing: -0.2 },
  attentionSub: { color: H.muted, fontSize: 12.5, lineHeight: 17.5, marginTop: 3 },
  miniChip: { marginTop: 7, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniChipText: { fontSize: 10.5, fontWeight: '700' },
  primaryAction: { borderRadius: 999, paddingHorizontal: 17, paddingVertical: 10 },
  primaryActionText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  secondaryAction: { borderRadius: 999, paddingHorizontal: 17, paddingVertical: 10 },
  secondaryActionText: { fontSize: 12.5, fontWeight: '800' },
  briefCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7F4FF', borderWidth: 1, borderColor: '#E7E0FF', borderRadius: 18, padding: 13, marginBottom: 12 },
  briefIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center' },
  briefLabel: { color: H.purple, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 }, briefText: { color: H.navy, fontSize: 12.2, lineHeight: 17, marginTop: 3 },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: H.lineSoft, padding: 16 },
  allClearIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: H.greenBg, alignItems: 'center', justifyContent: 'center' },
  allClearTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800' },
  allClearSub: { color: H.muted, fontSize: 12.5, marginTop: 2 },
  quickHomeSection: { marginTop: 26 },
  quickHomeHint: { color: H.muted, fontSize: 12.5, lineHeight: 18, marginTop: -4, marginBottom: 10 },
  quickHomeList: { gap: 9 },
  quickDeviceRow: { minHeight: 76, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderRadius: 20, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card },
  quickDeviceIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickDeviceName: { color: H.navy, fontSize: 14.5, fontWeight: '900' },
  quickDeviceState: { color: H.muted, fontSize: 12, fontWeight: '700', marginTop: 3, textTransform: 'capitalize' },
  quickDeviceButton: { minWidth: 86, minHeight: 46, paddingHorizontal: 13, borderRadius: 15, backgroundColor: H.navy, alignItems: 'center', justifyContent: 'center' },
  quickDeviceButtonOn: { backgroundColor: H.greenBg, borderWidth: 1, borderColor: '#CDEBD9' },
  quickDeviceButtonText: { color: '#fff', fontSize: 12.5, fontWeight: '900' },
  quickDeviceButtonTextOn: { color: H.green },
  todayActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, addTaskMini: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: H.violetBg }, addTaskMiniText: { color: H.purple, fontSize: 11, fontWeight: '800' },
  timelineWrap: { position: 'relative' },
  timelineLine: { position: 'absolute', left: 70, top: 27, bottom: 25, width: 1, backgroundColor: '#E4E8EF' },
  todayRow: { minHeight: 88, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, ...HearthDesign.shadow.card },
  timelineDot: { width: 7, height: 7, borderRadius: 4, marginLeft: -16 },
  sideTime: { width: 54, fontSize: 11.5, fontWeight: '700', textAlign: 'right', marginRight: 1 },
  sideTimeSpacer: { width: 54 },
  todayIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  todayTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800' },
  todaySub: { color: H.muted, fontSize: 12.5, marginTop: 3 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.8, borderColor: H.navy },
  softAction: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999 },
  softActionText: { fontWeight: '800', fontSize: 12 },
  scanCta: { borderRadius: 24, overflow: 'hidden', marginTop: 10, marginBottom: 8, ...HearthDesign.shadow.floating },
  scanGradient: { minHeight: 122, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  scanIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(130,104,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(220,212,255,0.14)' },
  scanTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  scanSub: { color: '#C7CBE7', fontSize: 11.8, lineHeight: 17, marginTop: 3 },
  scanMeta: { color: '#929CCF', fontSize: 10.3, marginTop: 5 },
  scanArrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center' },
  taskModalRoot: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', justifyContent: 'flex-end', paddingHorizontal: 14 }, taskModalCard: { borderRadius: 28, backgroundColor: H.paper, padding: 20, marginBottom: 20 }, taskModalTitle: { color: H.navy, fontSize: 22, fontWeight: '900', marginBottom: 14 }, taskInput: { height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, paddingHorizontal: 14, color: H.navy, fontSize: 15 }, taskLabel: { color: H.muted, fontSize: 11, fontWeight: '800', marginTop: 14, marginBottom: 8 }, dueWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, dueChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F0F0F1' }, dueChipActive: { backgroundColor: H.navy }, dueChipText: { color: H.navy, fontSize: 11, fontWeight: '700' }, dueChipTextActive: { color: '#fff' }, taskSave: { height: 50, borderRadius: 16, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, taskSaveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
