import { useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Animated, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/stores/authStore';
import { useDocumentStore } from '../../src/stores/documentStore';
import { useBillStore } from '../../src/stores/billStore';
import { useGroceryStore } from '../../src/stores/groceryStore';
import { useMaintenanceStore } from '../../src/stores/maintenanceStore';
import { useHealthStore } from '../../src/stores/healthStore';
import { useChiefOfStaffStore } from '../../src/stores/chiefOfStaffStore';

const COLORS = {
  bg: '#0A1628',
  surface: '#162035',
  accent: '#4FC3F7',
  white: '#F8FAFF',
  muted: '#8899AA',
  danger: '#FF6B6B',
  success: '#06D6A0',
};

const MODULE_INFO: Record<string, { bg: string; accent: string; icon: keyof typeof Ionicons.glyphMap }> = {
  documents: { bg: '#1A3A5C', accent: '#4FC3F7', icon: 'document-text' },
  bills: { bg: '#2D1B4E', accent: '#C77DFF', icon: 'card' },
  grocery: { bg: '#1A3A2A', accent: '#06D6A0', icon: 'basket' },
  maintenance: { bg: '#3A2A0A', accent: '#FFD166', icon: 'construct' },
  health: { bg: '#3A0A1A', accent: '#FF6B6B', icon: 'heart' },
};

export default function DashboardScreen() {
  const { user, signOut } = useAuthStore();
  const { documents = [], alerts = [], fetchDocuments, fetchAlerts } = useDocumentStore();
  const { bills = [], monthlyReport, fetchBills, fetchMonthlyReport } = useBillStore();
  const { inventory = [], fetchInventory } = useGroceryStore();
  const { tasks = [], fetchTasks } = useMaintenanceStore();
  const { triageHistory = [], fetchMedications } = useHealthStore();
  const { dashboardSummary, fetchDashboardSummary } = useChiefOfStaffStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const loading = false;

  useEffect(() => {
    loadAll();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadAll = () => {
    fetchDocuments(); fetchAlerts();
    fetchBills(); fetchMonthlyReport();
    fetchInventory(); fetchTasks();
    fetchMedications(); fetchDashboardSummary();
  };

  const urgentAlerts = alerts.filter((a: any) => a.urgency === 'critical' || a.urgency === 'expired');
  const pendingTasks = tasks.filter((t: any) => !t.completed).length;
  const monthlySpend = monthlyReport?.total_spent || 0;

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={COLORS.accent} />}
      >
        <LinearGradient colors={[COLORS.bg, '#112240']} style={styles.header}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.greeting}>{greeting()},</Text>
                <Text style={styles.userName}>{firstName} 👋</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
                  <Ionicons name="person-circle-outline" size={28} color={COLORS.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
            </View>
            {!!dashboardSummary?.chief_message && (
              <View style={styles.chiefMsg}>
                <Text style={styles.chiefMsgIcon}>✦</Text>
                <Text style={styles.chiefMsgText}>{dashboardSummary.chief_message}</Text>
              </View>
            )}
          </Animated.View>
        </LinearGradient>

        {urgentAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
            {urgentAlerts.map((alert: any, i: number) => (
              <TouchableOpacity key={i} style={styles.alertCard} onPress={() => router.push('/(tabs)/documents')}>
                <Ionicons name="warning-outline" size={16} color={COLORS.danger} />
                <Text style={styles.alertText} numberOfLines={2}>{alert.message}</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <StatItem value={documents.length} label="Documents" />
          <StatItem value={`$${monthlySpend.toFixed(0)}`} label="Monthly bills" />
          <StatItem value={pendingTasks} label="Tasks due" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Household</Text>
          <View style={styles.moduleGrid}>
            <ModuleCard
              module="documents" title="Documents"
              subtitle={`${documents.length} stored`}
              badge={urgentAlerts.length || undefined}
              onPress={() => router.push('/(tabs)/documents')}
            />
            <ModuleCard
              module="bills" title="Bills"
              subtitle={bills.length ? `${bills.length} active` : 'Add first bill'}
              onPress={() => router.push('/(tabs)/bills')}
            />
            <ModuleCard
              module="grocery" title="Grocery"
              subtitle={inventory.length ? `${inventory.length} items` : 'Plan meals'}
              onPress={() => router.push('/(tabs)/grocery')}
            />
            <ModuleCard
              module="maintenance" title="Maintenance"
              subtitle={pendingTasks > 0 ? `${pendingTasks} pending` : 'All clear'}
              onPress={() => router.push('/(tabs)/maintenance')}
            />
          </View>
          <TouchableOpacity style={styles.healthRow} onPress={() => router.push('/(tabs)/health')}>
            <View style={[styles.healthIcon, { backgroundColor: MODULE_INFO.health.bg }]}>
              <Ionicons name="heart" size={22} color={MODULE_INFO.health.accent} />
            </View>
            <View style={styles.healthText}>
              <Text style={styles.moduleTitle}>Health</Text>
              <Text style={styles.moduleSubtitle}>{triageHistory.length ? `${triageHistory.length} recent checks` : 'Family health triage'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.chiefCTA} onPress={() => router.push('/(tabs)/chief-of-staff')}>
          <LinearGradient colors={['#1A3A5C', '#2D1B4E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chiefGradient}>
            <View style={styles.chiefLeft}>
              <Text style={styles.chiefLeftIcon}>✦</Text>
              <View>
                <Text style={styles.chiefTitle}>Ask Chief of Staff</Text>
                <Text style={styles.chiefSub}>Your household AI — ask anything</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.accent} />
          </LinearGradient>
        </TouchableOpacity>

        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Expiries</Text>
            {alerts.slice(0, 3).map((alert: any, i: number) => (
              <View key={i} style={styles.expiryRow}>
                <View style={[styles.expiryDot, { backgroundColor: alert.urgency === 'expired' ? COLORS.danger : alert.urgency === 'critical' ? '#FF9F1C' : COLORS.accent }]} />
                <Text style={styles.expiryTitle} numberOfLines={1}>{alert.title}</Text>
                <Text style={[styles.expiryDays, { color: alert.urgency === 'expired' ? COLORS.danger : alert.urgency === 'critical' ? '#FF9F1C' : COLORS.muted }]}>
                  {alert.days_until_expiry < 0 ? 'Expired' : `${alert.days_until_expiry}d`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const StatItem = ({ value, label }: { value: string | number; label: string }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ModuleCard = ({ module, title, subtitle, badge, onPress }: any) => {
  const info = MODULE_INFO[module as keyof typeof MODULE_INFO];
  return (
    <TouchableOpacity style={styles.moduleCard} onPress={onPress}>
      <View style={[styles.moduleIcon, { backgroundColor: info.bg }]}>
        <Ionicons name={info.icon} size={22} color={info.accent} />
        {!!badge && <View style={styles.moduleBadge}><Text style={styles.moduleBadgeText}>{badge}</Text></View>}
      </View>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.moduleSubtitle} numberOfLines={1}>{subtitle}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 60, paddingBottom: 28, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 14, color: COLORS.muted, letterSpacing: 0.5 },
  userName: { fontSize: 28, fontWeight: '700', color: COLORS.white, marginTop: 2 },
  profileBtn: { padding: 4 },
  signOutBtn: { padding: 8, backgroundColor: COLORS.surface, borderRadius: 10 },
  chiefMsg: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(79,195,247,0.08)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(79,195,247,0.15)', gap: 10,
  },
  chiefMsgIcon: { fontSize: 14, color: COLORS.accent, marginTop: 1 },
  chiefMsgText: { flex: 1, fontSize: 13, color: '#B8D4E8', lineHeight: 19, fontStyle: 'italic' },
  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.08)',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)', gap: 10,
  },
  alertText: { flex: 1, fontSize: 13, color: '#FFB3B3' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 28, backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  statLabel: { fontSize: 11, color: COLORS.muted, letterSpacing: 0.3 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  moduleCard: {
    width: '47%', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  moduleIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, position: 'relative',
  },
  moduleBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.danger, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  moduleBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: '700' },
  moduleTitle: { fontSize: 14, fontWeight: '600', color: COLORS.white, marginBottom: 3 },
  moduleSubtitle: { fontSize: 12, color: COLORS.muted },
  healthRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 14,
  },
  healthIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  healthText: { flex: 1 },
  chiefCTA: { marginHorizontal: 20, marginBottom: 28, borderRadius: 16, overflow: 'hidden' },
  chiefGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  chiefLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chiefLeftIcon: { fontSize: 20, color: COLORS.accent },
  chiefTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginBottom: 2 },
  chiefSub: { fontSize: 12, color: COLORS.muted },
  expiryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 10,
    padding: 14, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  expiryDot: { width: 8, height: 8, borderRadius: 4 },
  expiryTitle: { flex: 1, fontSize: 14, color: COLORS.white },
  expiryDays: { fontSize: 13, fontWeight: '600' },
});