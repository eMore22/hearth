import { useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { useDocumentStore } from '../../src/stores/documentStore'
import { COLORS } from '../../src/utils/theme'
import { formatDate, daysUntil } from '../../src/utils/dates'

export default function DashboardScreen() {
  const { user, signOut } = useAuthStore()
  const { documents, alerts, fetchDocuments, fetchAlerts, loading } = useDocumentStore()

  useEffect(() => {
    fetchDocuments()
    fetchAlerts()
  }, [])

  const urgentAlerts = alerts.filter(a =>
    a.urgency === 'critical' || a.urgency === 'expired'
  )

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => { fetchDocuments(); fetchAlerts() }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning 👋</Text>
          <Text style={styles.name}>{user?.user_metadata?.full_name || 'Welcome'}</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      {/* Urgent Alerts */}
      {urgentAlerts.length > 0 && (
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
          {urgentAlerts.map((alert, i) => (
            <TouchableOpacity
              key={i}
              style={styles.alertCard}
              onPress={() => router.push('/(tabs)/documents')}
            >
              <Text style={styles.alertText}>{alert.message}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Module Grid */}
      <Text style={styles.sectionTitle}>Your Household</Text>
      <View style={styles.moduleGrid}>
        <ModuleCard
          icon="document-text"
          title="Documents"
          subtitle={`${documents.length} stored`}
          color="#2E86AB"
          active={true}
          onPress={() => router.push('/(tabs)/documents')}
        />
        <ModuleCard
          icon="card"
          title="Bills"
          subtitle="Coming soon"
          color="#A23B72"
          active={false}
          onPress={() => {}}
        />
        <ModuleCard
          icon="basket"
          title="Grocery"
          subtitle="Coming soon"
          color="#F18F01"
          active={false}
          onPress={() => {}}
        />
        <ModuleCard
          icon="construct"
          title="Maintenance"
          subtitle="Coming soon"
          color="#4CAF50"
          active={false}
          onPress={() => {}}
        />
        <ModuleCard
          icon="heart"
          title="Health"
          subtitle="Coming soon"
          color="#E74C3C"
          active={false}
          onPress={() => {}}
        />
      </View>

      {/* Upcoming Expiries */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Upcoming Expiries</Text>
          {alerts.slice(0, 3).map((alert, i) => (
            <View key={i} style={styles.expiryRow}>
              <Text style={styles.expiryTitle}>{alert.title}</Text>
              <Text style={[
                styles.expiryDays,
                alert.urgency === 'expired' && { color: COLORS.danger },
                alert.urgency === 'critical' && { color: COLORS.warning }
              ]}>
                {alert.days_until_expiry < 0
                  ? 'Expired'
                  : `${alert.days_until_expiry}d`
                }
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

function ModuleCard({ icon, title, subtitle, color, active, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.moduleCard, !active && styles.moduleCardInactive]}
      onPress={onPress}
      disabled={!active}
    >
      <View style={[styles.moduleIcon, { backgroundColor: active ? color : COLORS.border }]}>
        <Ionicons name={`${icon}-outline` as any} size={24} color="#fff" />
      </View>
      <Text style={[styles.moduleTitle, !active && styles.moduleTitleInactive]}>{title}</Text>
      <Text style={styles.moduleSubtitle}>{subtitle}</Text>
      {!active && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Soon</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60
  },
  greeting: { fontSize: 14, color: COLORS.muted },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  alertsSection: { marginHorizontal: 20, marginBottom: 16 },
  alertCard: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning
  },
  alertText: { fontSize: 14, color: '#856404' },
  section: { marginHorizontal: 20, marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginBottom: 24
  },
  moduleCard: {
    width: '46%',
    margin: '2%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  moduleCardInactive: { opacity: 0.6 },
  moduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  moduleTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  moduleTitleInactive: { color: COLORS.muted },
  moduleSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  comingSoonText: { fontSize: 10, color: COLORS.muted },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  expiryTitle: { fontSize: 14, color: COLORS.text, flex: 1 },
  expiryDays: { fontSize: 13, fontWeight: '600', color: COLORS.primary }
})
