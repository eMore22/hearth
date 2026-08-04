import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { useEffect, useState } from 'react'
import { useAutomationStore, HADevice } from '../../src/stores/automationStore'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

const NAVY    = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const WARNING = '#FFD166'
const WHITE   = '#F8FAFF'
const MUTED   = '#8899AA'
const SUCCESS = '#06D6A0'
const DANGER  = '#FF6B6B'
const ACCENT  = '#4FC3F7'

// Maps HA domain to an icon + friendly category label
const DOMAIN_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  switch:         { icon: 'toggle-outline',     label: 'Switch' },
  light:          { icon: 'bulb-outline',       label: 'Light' },
  lock:           { icon: 'lock-closed-outline', label: 'Lock' },
  cover:          { icon: 'home-outline',       label: 'Cover / Door' },
  fan:            { icon: 'reorder-three-outline', label: 'Fan' },
  climate:        { icon: 'thermometer-outline', label: 'Climate' },
  sensor:         { icon: 'pulse-outline',       label: 'Sensor' },
  binary_sensor:  { icon: 'radio-button-on-outline', label: 'Sensor' },
  input_boolean:  { icon: 'toggle-outline',      label: 'Toggle' },
  water_heater:   { icon: 'water-outline',       label: 'Water Heater' },
};

function getDomainConfig(domain: string) {
  return DOMAIN_CONFIG[domain] || { icon: 'hardware-chip-outline' as const, label: domain };
}

function isOnState(state: string) {
  return ['on', 'open', 'unlocked', 'home', 'true'].includes((state || '').toLowerCase());
}

export default function DevicesScreen() {
  const { devices, status, fetchDevices, fetchStatus, executeAction } = useAutomationStore();
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'actionable' | 'sensors'>('all');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setRefreshing(true);
    await Promise.all([fetchDevices(), fetchStatus()]);
    setRefreshing(false);
  };

  const handleToggle = async (device: HADevice) => {
    const isOn = isOnState(device.last_state);
    const action = isOn ? 'turn_off' : 'turn_on';
    const key = `${device.entity_id}_${action}`;
    setActionLoading(key);
    try {
      await executeAction(device.entity_id, action);
    } catch (err: any) {
      Alert.alert('Action failed', err.message || 'Could not reach Home Assistant.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (filter === 'actionable') return d.is_actionable;
    if (filter === 'sensors') return !d.is_actionable;
    return true;
  });

  // Group by area for readability
  const grouped = filteredDevices.reduce((acc: Record<string, HADevice[]>, d) => {
    const area = d.area || 'Unassigned';
    if (!acc[area]) acc[area] = [];
    acc[area].push(d);
    return acc;
  }, {});

  if (!status.connected) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Smart Home Devices</Text>
          <View style={{ width: 32 }} />
        </LinearGradient>
        <View style={styles.emptyState}>
          <Ionicons name="home-outline" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>Not connected yet</Text>
          <Text style={styles.emptySubtitle}>Connect Home Assistant from your profile to see devices here.</Text>
          <TouchableOpacity style={styles.connectBtn} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.connectBtnText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Smart Home Devices</Text>
          <View style={{ width: 32 }} />
        </View>
        <Text style={styles.headerSub}>{devices.length} devices · Synced from Home Assistant</Text>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {(['all', 'actionable', 'sensors'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'actionable' ? 'Controllable' : 'Sensors'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={ACCENT} />}
      >
        {Object.keys(grouped).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color={MUTED} />
            <Text style={styles.emptyTitle}>No devices in this filter</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([area, areaDevices]) => (
            <View key={area} style={styles.section}>
              <Text style={styles.sectionTitle}>{area}</Text>
              {areaDevices.map((device) => {
                const cfg = getDomainConfig(device.domain);
                const isOn = isOnState(device.last_state);
                const toggleKey = `${device.entity_id}_${isOn ? 'turn_off' : 'turn_on'}`;
                const isLoading = actionLoading === toggleKey;

                return (
                  <View key={device.entity_id} style={styles.deviceCard}>
                    <View style={[styles.deviceIconBox, isOn && styles.deviceIconBoxActive]}>
                      <Ionicons name={cfg.icon} size={20} color={isOn ? SUCCESS : MUTED} />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName} numberOfLines={1}>{device.friendly_name}</Text>
                      <Text style={styles.deviceMeta}>
                        {cfg.label} · {device.last_state || 'unknown'}
                      </Text>
                    </View>

                    {device.is_actionable ? (
                      isLoading ? (
                        <ActivityIndicator size="small" color={ACCENT} />
                      ) : (
                        <TouchableOpacity
                          style={[styles.toggleBtn, isOn && styles.toggleBtnActive]}
                          onPress={() => handleToggle(device)}
                        >
                          <View style={[styles.toggleDot, isOn && styles.toggleDotActive]} />
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={[styles.stateBadge, isOn && styles.stateBadgeActive]}>
                        <Text style={[styles.stateBadgeText, isOn && styles.stateBadgeTextActive]}>
                          {device.last_state || '—'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header:    { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:   { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: WHITE },
  headerSub:   { fontSize: 12, color: MUTED, marginTop: 8, marginLeft: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: { backgroundColor: 'rgba(255,209,102,0.15)', borderColor: WARNING },
  filterChipText:   { fontSize: 12, color: MUTED, fontWeight: '600' },
  filterChipTextActive: { color: WARNING },
  scroll:  { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: MUTED,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  deviceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12,
  },
  deviceIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  deviceIconBoxActive: { backgroundColor: 'rgba(6,214,160,0.12)' },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600', color: WHITE, marginBottom: 2 },
  deviceMeta: { fontSize: 12, color: MUTED, textTransform: 'capitalize' },
  toggleBtn: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleBtnActive: { backgroundColor: 'rgba(6,214,160,0.3)' },
  toggleDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: MUTED,
  },
  toggleDotActive: { backgroundColor: SUCCESS, alignSelf: 'flex-end' },
  stateBadge: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stateBadgeActive: { backgroundColor: 'rgba(6,214,160,0.12)' },
  stateBadgeText: { fontSize: 11, color: MUTED, fontWeight: '600', textTransform: 'capitalize' },
  stateBadgeTextActive: { color: SUCCESS },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: WHITE, marginTop: 6 },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 },
  connectBtn: {
    backgroundColor: WARNING, borderRadius: 12, paddingHorizontal: 24,
    paddingVertical: 12, marginTop: 16,
  },
  connectBtnText: { color: NAVY, fontWeight: '700', fontSize: 14 },
});