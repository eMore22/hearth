import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutomationStore, HADevice } from '../../src/stores/automationStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

const DOMAIN_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  switch: { icon: 'toggle-outline', label: 'Switch' }, light: { icon: 'bulb-outline', label: 'Light' }, lock: { icon: 'lock-closed-outline', label: 'Lock' },
  cover: { icon: 'home-outline', label: 'Cover / Door' }, fan: { icon: 'reorder-three-outline', label: 'Fan' }, climate: { icon: 'thermometer-outline', label: 'Climate' },
  sensor: { icon: 'pulse-outline', label: 'Sensor' }, binary_sensor: { icon: 'radio-button-on-outline', label: 'Sensor' }, input_boolean: { icon: 'toggle-outline', label: 'Toggle' }, water_heater: { icon: 'water-outline', label: 'Water Heater' },
};
const cfg = (domain: string) => DOMAIN_CONFIG[domain] || { icon: 'hardware-chip-outline' as const, label: domain };
const isOnState = (state: string) => ['on','open','unlocked','home','true'].includes((state || '').toLowerCase());

export default function DevicesScreen() {
  const insets = useSafeAreaInsets();
  const { devices, status, fetchDevices, fetchStatus, executeAction } = useAutomationStore();
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'actionable' | 'sensors'>('all');

  const load = async () => { setRefreshing(true); await Promise.all([fetchDevices(), fetchStatus()]); setRefreshing(false); };
  useEffect(() => { load(); }, []);

  const handleToggle = async (device: HADevice) => {
    const action = isOnState(device.last_state) ? 'turn_off' : 'turn_on';
    setActionLoading(device.entity_id);
    try { await executeAction(device.entity_id, action); }
    catch (e: any) { Alert.alert('Action failed', e?.message || 'Could not reach Home Assistant.'); }
    finally { setActionLoading(null); }
  };

  const filtered = devices.filter(d => filter === 'all' ? true : filter === 'actionable' ? d.is_actionable : !d.is_actionable);
  const grouped = filtered.reduce((acc: Record<string, HADevice[]>, d) => { const area = d.area || 'Unassigned'; (acc[area] ||= []).push(d); return acc; }, {});

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={H.purple} />} contentContainerStyle={{ paddingTop: Math.max(insets.top, 10), paddingBottom: 42 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Smart home" subtitle="Devices connected through Home Assistant." />
        <View style={styles.body}>
          {!status.connected ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Ionicons name="home-outline" size={29} color={H.blue} /></View>
              <Text style={styles.emptyTitle}>Connect Home Assistant</Text>
              <Text style={styles.emptySub}>Connect from Integrations, then Hearth will sync supported devices and sensors here.</Text>
              <TouchableOpacity style={styles.connect} onPress={() => router.push('/(tabs)/integrations')}><Text style={styles.connectText}>Open integrations</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.statusCard}><View style={styles.statusIcon}><Ionicons name="checkmark-circle" size={22} color={H.green} /></View><View style={styles.flex}><Text style={styles.statusTitle}>Home Assistant connected</Text><Text style={styles.statusSub}>{devices.length} devices synced</Text></View><TouchableOpacity onPress={() => router.push('/(tabs)/integrations')}><Text style={styles.manage}>Manage</Text></TouchableOpacity></View>
              <View style={styles.filterRow}>{(['all','actionable','sensors'] as const).map(f => <TouchableOpacity key={f} style={[styles.filter, filter === f && styles.filterActive]} onPress={() => setFilter(f)}><Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f === 'actionable' ? 'Controllable' : 'Sensors'}</Text></TouchableOpacity>)}</View>
              {Object.keys(grouped).length === 0 ? <Text style={styles.noResults}>No devices in this filter.</Text> : Object.entries(grouped).map(([area, areaDevices]) => (
                <View key={area} style={styles.section}><Text style={styles.sectionTitle}>{area}</Text>{areaDevices.map(device => {
                  const c = cfg(device.domain); const on = isOnState(device.last_state);
                  return <View key={device.entity_id} style={styles.deviceCard}><View style={[styles.deviceIcon, { backgroundColor: on ? H.greenBg : '#F4F3F3' }]}><Ionicons name={c.icon} size={20} color={on ? H.green : H.muted} /></View><View style={styles.flex}><Text style={styles.deviceName} numberOfLines={1}>{device.friendly_name}</Text><Text style={styles.deviceMeta}>{c.label} · {device.last_state || 'unknown'}</Text></View>{device.is_actionable ? (actionLoading === device.entity_id ? <ActivityIndicator color={H.purple} /> : <TouchableOpacity style={[styles.toggle, on && styles.toggleOn]} onPress={() => handleToggle(device)}><View style={[styles.dot, on && styles.dotOn]} /></TouchableOpacity>) : <View style={styles.statePill}><Text style={styles.stateText}>{device.last_state || '—'}</Text></View>}</View>;
                })}</View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},flex:{flex:1,minWidth:0},emptyCard:{backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,borderRadius:24,padding:24,alignItems:'center',...HearthDesign.shadow.card},emptyIcon:{width:62,height:62,borderRadius:20,backgroundColor:H.blueBg,alignItems:'center',justifyContent:'center'},emptyTitle:{color:H.navy,fontSize:18,fontWeight:'800',marginTop:13},emptySub:{color:H.muted,fontSize:12.5,lineHeight:19,textAlign:'center',marginTop:5,maxWidth:300},connect:{minHeight:48,paddingHorizontal:22,borderRadius:15,backgroundColor:H.navy,alignItems:'center',justifyContent:'center',marginTop:17},connectText:{color:'#fff',fontSize:13,fontWeight:'800'},
  statusCard:{minHeight:72,borderRadius:20,backgroundColor:H.greenBg,borderWidth:1,borderColor:'#D5EEDC',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:11},statusIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},statusTitle:{color:H.navy,fontSize:13.5,fontWeight:'800'},statusSub:{color:H.muted,fontSize:11,marginTop:2},manage:{color:H.green,fontSize:11.5,fontWeight:'800'},
  filterRow:{flexDirection:'row',gap:8,marginTop:16,marginBottom:4},filter:{paddingHorizontal:13,paddingVertical:8,borderRadius:999,backgroundColor:'#F1F0EF'},filterActive:{backgroundColor:H.navy},filterText:{color:H.muted,fontSize:11.5,fontWeight:'700'},filterTextActive:{color:'#fff'},section:{marginTop:18},sectionTitle:{color:H.muted,fontSize:10.5,fontWeight:'900',letterSpacing:1.1,textTransform:'uppercase',marginBottom:8},deviceCard:{minHeight:72,borderRadius:19,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,paddingHorizontal:12,marginBottom:8,flexDirection:'row',alignItems:'center',gap:11,...HearthDesign.shadow.card},deviceIcon:{width:43,height:43,borderRadius:14,alignItems:'center',justifyContent:'center'},deviceName:{color:H.navy,fontSize:13.5,fontWeight:'800'},deviceMeta:{color:H.muted,fontSize:10.8,marginTop:2,textTransform:'capitalize'},toggle:{width:44,height:26,borderRadius:13,backgroundColor:'#E6E4E2',paddingHorizontal:3,justifyContent:'center'},toggleOn:{backgroundColor:'#AEE2C5'},dot:{width:20,height:20,borderRadius:10,backgroundColor:'#fff',shadowColor:'#000',shadowOpacity:0.08,shadowRadius:3,elevation:1},dotOn:{alignSelf:'flex-end',backgroundColor:H.green},statePill:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:'#F2F1F0'},stateText:{color:H.muted,fontSize:10,fontWeight:'800',textTransform:'capitalize'},noResults:{color:H.muted,textAlign:'center',marginTop:30},
});
