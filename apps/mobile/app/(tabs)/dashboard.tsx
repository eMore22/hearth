import { useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Animated, StatusBar } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthStore } from '../../src/stores/authStore'
import { useDocumentStore } from '../../src/stores/documentStore'
import { useBillStore } from '../../src/stores/billStore'
import { useGroceryStore } from '../../src/stores/groceryStore'
import { useMaintenanceStore } from '../../src/stores/maintenanceStore'
import { useHealthStore } from '../../src/stores/healthStore'
import { useChiefOfStaffStore } from '../../src/stores/chiefOfStaffStore'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const ACCENT = '#4FC3F7'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const SURFACE = '#162035'
const DANGER = '#FF6B6B'
const SUCCESS = '#06D6A0'

const MODULE_COLORS = {
  documents: { bg: '#1A3A5C', accent: '#4FC3F7', icon: 'document-text' },
  bills: { bg: '#2D1B4E', accent: '#C77DFF', icon: 'card' },
  grocery: { bg: '#1A3A2A', accent: '#06D6A0', icon: 'basket' },
  maintenance: { bg: '#3A2A0A', accent: '#FFD166', icon: 'construct' },
  health: { bg: '#3A0A1A', accent: '#FF6B6B', icon: 'heart' },
}

export default function DashboardScreen() {
  const { user, signOut } = useAuthStore()
  const { documents, alerts, fetchDocuments, fetchAlerts, loading: docsLoading } = useDocumentStore()
  const { bills, monthlyReport, fetchBills, fetchMonthlyReport, isLoading: billsLoading } = useBillStore()
  const { inventory, fetchInventory } = useGroceryStore()
  const { tasks, fetchTasks } = useMaintenanceStore()
  const { triageHistory, fetchMedications } = useHealthStore()
  const { dashboardSummary, fetchDashboardSummary } = useChiefOfStaffStore()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const loading = docsLoading || billsLoading

  useEffect(() => {
    loadAll()
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  const loadAll = () => {
    fetchDocuments(); fetchAlerts(); fetchBills(); fetchMonthlyReport()
    fetchInventory(); fetchTasks(); fetchMedications(); fetchDashboardSummary()
  }

  const urgentAlerts = alerts.filter((a: any) => a.urgency === 'critical' || a.urgency === 'expired')
  const pendingTasks = tasks.filter((t: any) => !t.completed).length
  const monthlySpend = monthlyReport?.total_spent || 0

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor={ACCENT} />}>

        {/* Header */}
        <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>{greeting()},</Text>
                <Text style={styles.userName}>{firstName} 👋</Text>
              </View>
              <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                <Ionicons name="log-out-outline" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>
            {dashboardSummary?.chief_message && (
              <View style={styles.chiefMessageBox}>
                <Text style={styles.chiefMessageIcon}>✦</Text>
                <Text style={styles.chiefMessage}>{dashboardSummary.chief_message}</Text>
              </View>
            )}
          </Animated.View>
        </LinearGradient>

        {/* Urgent alerts */}
        {urgentAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.alertDot} />
              <Text style={styles.sectionTitle}>Needs Attention</Text>
            </View>
            {urgentAlerts.map((alert: any, i: number) => (
              <TouchableOpacity key={i} style={styles.alertCard} onPress={() => router.push('/(tabs)/documents')}>
                <Ionicons name="warning-outline" size={16} color={DANGER} />
                <Text style={styles.alertText} numberOfLines={2}>{alert.message}</Text>
                <Ionicons name="chevron-forward" size={14} color={MUTED} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{documents.length}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={styles.statValue}>${monthlySpend > 0 ? monthlySpend.toFixed(0) : '0'}</Text>
            <Text style={styles.statLabel}>Monthly bills</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingTasks}</Text>
            <Text style={styles.statLabel}>Tasks due</Text>
          </View>
        </View>

        {/* Module Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Household</Text>
          <View style={styles.moduleGrid}>
            <ModuleCard module="documents" title="Documents" subtitle={`${documents.length} stored`} badge={urgentAlerts.length > 0 ? urgentAlerts.length : null} onPress={() => router.push('/(tabs)/documents')} />
            <ModuleCard module="bills" title="Bills" subtitle={bills.length > 0 ? `${bills.length} active` : 'Add first bill'} onPress={() => router.push('/(tabs)/bills')} />
            <ModuleCard module="grocery" title="Grocery" subtitle={inventory.length > 0 ? `${inventory.length} items` : 'Plan meals'} onPress={() => router.push('/(tabs)/grocery')} />
            <ModuleCard module="maintenance" title="Maintenance" subtitle={pendingTasks > 0 ? `${pendingTasks} pending` : 'All clear'} onPress={() => router.push('/(tabs)/maintenance')} />
          </View>
          <TouchableOpacity style={styles.healthCard} onPress={() => router.push('/(tabs)/health')}>
            <View style={[styles.healthIconBox, { backgroundColor: MODULE_COLORS.health.bg }]}>
              <Ionicons name="heart" size={22} color={MODULE_COLORS.health.accent} />
            </View>
            <View style={styles.healthInfo}>
              <Text style={styles.moduleTitle}>Health</Text>
              <Text style={styles.moduleSubtitle}>{triageHistory.length > 0 ? `${triageHistory.length} recent checks` : 'Family health triage'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </TouchableOpacity>
        </View>

        {/* Chief of Staff CTA */}
        <TouchableOpacity style={styles.chiefCTA} onPress={() => router.push('/(tabs)/chief-of-staff')}>
          <LinearGradient colors={['#1A3A5C', '#2D1B4E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chiefCTAGradient}>
            <View style={styles.chiefCTALeft}>
              <Text style={styles.chiefCTAIcon}>✦</Text>
              <View>
                <Text style={styles.chiefCTATitle}>Ask Chief of Staff</Text>
                <Text style={styles.chiefCTASub}>Your household AI — ask anything</Text>
              </View>
            </View>
            <View style={styles.chiefCTAArrow}>
              <Ionicons name="arrow-forward" size={18} color={ACCENT} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Expiries */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Expiries</Text>
            {alerts.slice(0, 3).map((alert: any, i: number) => (
              <View key={i} style={styles.expiryRow}>
                <View style={[styles.expiryDot, { backgroundColor: alert.urgency === 'expired' ? DANGER : alert.urgency === 'critical' ? '#FF9F1C' : ACCENT }]} />
                <Text style={styles.expiryTitle} numberOfLines={1}>{alert.title}</Text>
                <Text style={[styles.expiryDays, { color: alert.urgency === 'expired' ? DANGER : alert.urgency === 'critical' ? '#FF9F1C' : MUTED }]}>
                  {alert.days_until_expiry < 0 ? 'Expired' : `${alert.days_until_expiry}d`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function ModuleCard({ module, title, subtitle, badge, onPress }: any) {
  const config = MODULE_COLORS[module as keyof typeof MODULE_COLORS]
  return (
    <TouchableOpacity style={styles.moduleCard} onPress={onPress}>
      <View style={[styles.moduleIconBox, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon as any} size={22} color={config.accent} />
        {badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      </View>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.moduleSubtitle} numberOfLines={1}>{subtitle}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { paddingTop: 60, paddingBottom: 28, paddingHorizontal: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 14, color: MUTED, letterSpacing: 0.5 },
  userName: { fontSize: 28, fontWeight: '700', color: WHITE, marginTop: 2 },
  signOutBtn: { padding: 8, backgroundColor: SURFACE, borderRadius: 10 },
  chiefMessageBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(79,195,247,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(79,195,247,0.15)', gap: 10 },
  chiefMessageIcon: { fontSize: 14, color: ACCENT, marginTop: 1 },
  chiefMessage: { flex: 1, fontSize: 13, color: '#B8D4E8', lineHeight: 19, fontStyle: 'italic' },
  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: MUTED, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)', gap: 10 },
  alertText: { flex: 1, fontSize: 13, color: '#FFB3B3' },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 28, backgroundColor: SURFACE, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statCard: { flex: 1, alignItems: 'center' },
  statCardMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statValue: { fontSize: 22, fontWeight: '700', color: WHITE, marginBottom: 4 },
  statLabel: { fontSize: 11, color: MUTED, letterSpacing: 0.3 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  moduleCard: { width: '47%', backgroundColor: SURFACE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  moduleIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12, position: 'relative' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: DANGER, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 10, color: WHITE, fontWeight: '700' },
  moduleTitle: { fontSize: 14, fontWeight: '600', color: WHITE, marginBottom: 3 },
  moduleSubtitle: { fontSize: 12, color: MUTED },
  healthCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 14 },
  healthIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  healthInfo: { flex: 1 },
  chiefCTA: { marginHorizontal: 20, marginBottom: 28, borderRadius: 16, overflow: 'hidden' },
  chiefCTAGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  chiefCTALeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chiefCTAIcon: { fontSize: 20, color: ACCENT },
  chiefCTATitle: { fontSize: 15, fontWeight: '700', color: WHITE, marginBottom: 2 },
  chiefCTASub: { fontSize: 12, color: MUTED },
  chiefCTAArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(79,195,247,0.15)', alignItems: 'center', justifyContent: 'center' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 10, padding: 14, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  expiryDot: { width: 8, height: 8, borderRadius: 4 },
  expiryTitle: { flex: 1, fontSize: 14, color: WHITE },
  expiryDays: { fontSize: 13, fontWeight: '600' },
})