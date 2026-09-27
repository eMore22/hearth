import React, { useEffect, useMemo } from 'react';
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const { alerts, fetchAlerts } = useDocumentStore();
  const { bills, fetchBills, fetchMonthlyReport } = useBillStore();
  const { shoppingList, inventory, fetchInventory } = useGroceryStore();
  const { events, fetchEvents, fetchStatus } = useAutomationStore();
  const { tasks, fetchTasks, completeTask } = useTaskStore();

  const load = () => {
    if (!household) fetchHousehold();
    fetchAlerts();
    fetchBills();
    fetchMonthlyReport().catch(() => undefined);
    fetchInventory();
    fetchEvents();
    fetchStatus();
    fetchTasks();
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
              <Text style={styles.brandText}>Hearth</Text>
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
              <View style={[styles.secondaryAction, { backgroundColor: '#F8EAD5' }]}><Text style={[styles.secondaryActionText, { color: '#6F4312' }]}>View</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </TouchableOpacity>
          ) : null}

          {attentionCount === 0 && (
            <View style={styles.allClear}>
              <View style={styles.allClearIcon}><Ionicons name="checkmark" size={18} color={H.green} /></View>
              <View style={styles.flex}><Text style={styles.allClearTitle}>Everything looks good</Text><Text style={styles.allClearSub}>Hearth is monitoring your household.</Text></View>
            </View>
          )}

          <View style={[styles.sectionHead, { marginTop: 26 }]}>
            <Text style={styles.sectionTitle}>Today</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/activity')} activeOpacity={0.7}><Text style={styles.viewAll}>View schedule  ›</Text></TouchableOpacity>
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

          <TouchableOpacity style={styles.ask} activeOpacity={0.9} onPress={() => router.push('/(tabs)/chief-of-staff')}>
            <LinearGradient colors={['#0B1738', '#171B50', '#3B1D8B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.askGradient}>
              <View style={styles.askTop}>
                <View style={styles.spark}><Ionicons name="sparkles" size={22} color="#C8B9FF" /></View>
                <View style={styles.flex}><Text style={styles.askTitle}>Ask Hearth</Text><Text style={styles.askSub}>Your household AI — ask anything</Text></View>
              </View>
              <View style={styles.askInput}>
                <Text style={styles.askPlaceholder}>What do you need help with?</Text>
                <View style={styles.send}><Ionicons name="arrow-up" size={20} color="#fff" /></View>
              </View>
              <View style={styles.promptRow}>
                <View style={styles.promptChip}><Ionicons name="calendar-outline" size={12} color="#D6CCFF" /><Text style={styles.promptText}>What needs my attention this week?</Text></View>
                <View style={styles.promptChip}><Ionicons name="card-outline" size={12} color="#D6CCFF" /><Text style={styles.promptText}>Which bills are due soon?</Text></View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  allClear: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: H.lineSoft, padding: 16 },
  allClearIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: H.greenBg, alignItems: 'center', justifyContent: 'center' },
  allClearTitle: { color: H.navy, fontSize: 14.5, fontWeight: '800' },
  allClearSub: { color: H.muted, fontSize: 12.5, marginTop: 2 },
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
  ask: { borderRadius: 24, overflow: 'hidden', marginTop: 10, marginBottom: 8, ...HearthDesign.shadow.floating },
  askGradient: { padding: 15, minHeight: 215 },
  askTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spark: { width: 49, height: 49, borderRadius: 16, backgroundColor: 'rgba(130,104,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(210,198,255,0.12)' },
  askTitle: { color: '#fff', fontFamily: 'serif', fontSize: 24, fontWeight: '700' },
  askSub: { color: '#9FA9DE', fontSize: 12.5, marginTop: 2 },
  askInput: { marginTop: 17, height: 57, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.98)', flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6 },
  askPlaceholder: { flex: 1, color: '#7D8597', fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center' },
  promptRow: { flexDirection: 'row', gap: 7, marginTop: 11 },
  promptChip: { flex: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  promptText: { color: '#D7D9EF', fontSize: 9.5, flex: 1 },
});
