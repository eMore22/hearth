import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H, HearthDesign } from '../../theme/hearthDesign';

const modules = [
  // Symmetrical arc around Household: equal breathing room on both sides.
  { label: 'Health', icon: 'heart' as const, route: '/(tabs)/health', bg: '#FFE9ED', fg: '#D83A55', x: -126, y: -102 },
  { label: 'Documents', icon: 'document-text' as const, route: '/(tabs)/documents', bg: '#EDF4FF', fg: '#2A75E6', x: -72, y: -178 },
  { label: 'Home', icon: 'home' as const, route: '/(tabs)/maintenance', bg: '#FFF0D9', fg: '#A96818', x: 0, y: -212 },
  { label: 'Bills', icon: 'card' as const, route: '/(tabs)/bills', bg: '#F1ECFF', fg: '#7650E8', x: 72, y: -178 },
  { label: 'Grocery', icon: 'basket' as const, route: '/(tabs)/grocery', bg: '#E8F7EE', fg: '#168D54', x: 126, y: -102 },
];

function Bubble({ item, progress, onPress }: { item: typeof modules[number]; progress: SharedValue<number>; onPress: () => void }) {
  const a = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, item.x]) },
      { translateY: interpolate(progress.value, [0, 1], [0, item.y]) },
      { scale: interpolate(progress.value, [0, 1], [0.45, 1]) },
    ],
  }));

  return (
    <Animated.View style={[styles.bubbleWrap, a]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.bubbleTouch}>
        <View style={[styles.bubble, { backgroundColor: item.bg }]}>
          <Ionicons name={item.icon} size={25} color={item.fg} />
        </View>
        <Text style={styles.bubbleLabel}>{item.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HearthTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = open
      ? withSpring(1, { damping: 17, stiffness: 170, mass: 0.8 })
      : withTiming(0, { duration: 150 });
  }, [open]);

  const go = (route: string) => {
    progress.value = withTiming(0, { duration: 120 });
    setTimeout(() => {
      setOpen(false);
      router.push(route as any);
    }, 100);
  };

  const currentRoute = state.routes[state.index]?.name;
  const householdRoutes = ['household', 'documents', 'bills', 'grocery', 'maintenance', 'health', 'devices', 'scan'];

  const nav = [
    { key: 'dashboard', label: 'Home', icon: 'home' as const, outline: 'home-outline' as const },
    { key: 'household', label: 'Household', icon: 'grid' as const, outline: 'grid-outline' as const },
    { key: 'chief-of-staff', label: 'Chief', icon: 'sparkles' as const, outline: 'sparkles-outline' as const, chief: true },
    { key: 'activity', label: 'Activity', icon: 'pulse' as const, outline: 'pulse-outline' as const },
    { key: 'profile', label: 'Profile', icon: 'person' as const, outline: 'person-outline' as const },
  ];

  const renderBar = (modal = false) => (
    <View style={[styles.barShell, modal && styles.modalBar, { paddingBottom: Math.max(insets.bottom, 7) }]}>
      {nav.map(item => {
        const idx = state.routes.findIndex((r: any) => r.name === item.key);
        const focused = idx === state.index;
        const householdSelected = item.key === 'household' && householdRoutes.includes(currentRoute);
        const householdActive = item.key === 'household' && open;
        const active = focused || householdSelected || householdActive;

        if (item.key === 'household') {
          return (
            <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
              <View style={[styles.iconSlot, householdActive && styles.householdSlot]}>
                <Ionicons name={active ? item.icon : item.outline} size={21} color={householdActive ? '#fff' : active ? H.purple : H.muted} />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.navItem}
            onPress={() => {
              if (modal) setOpen(false);
              if (idx >= 0) navigation.navigate(state.routes[idx].name);
            }}
            activeOpacity={0.75}
          >
            {item.chief ? (
              <View style={[styles.chiefButton, focused && styles.chiefButtonActive]}>
                <Ionicons name="sparkles" size={25} color="#fff" />
              </View>
            ) : (
              <View style={styles.iconSlot}>
                <Ionicons name={focused ? item.icon : item.outline} size={21} color={focused ? H.navy : H.muted} />
              </View>
            )}
            <Text style={[styles.navLabel, focused && styles.navLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <>
      {renderBar()}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.radialArea, { bottom: 90 + Math.max(insets.bottom, 7) }]} pointerEvents="box-none">
            {modules.map(item => <Bubble key={item.label} item={item} progress={progress} onPress={() => go(item.route)} />)}
            <TouchableOpacity style={styles.centerButton} onPress={() => setOpen(false)} activeOpacity={0.8}>
              <Ionicons name="close" size={23} color="#fff" />
            </TouchableOpacity>
          </View>
          {renderBar(true)}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  barShell: {
    minHeight: 83,
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 5,
    paddingTop: 9,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.985)',
    borderWidth: 1,
    borderColor: '#EFEFF3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...HearthDesign.shadow.card,
  },
  modalBar: { position: 'absolute', left: 0, right: 0, bottom: 5 },
  navItem: { width: 66, minHeight: 58, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  iconSlot: { height: 30, minWidth: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  navLabel: { fontSize: 10.5, color: H.muted, fontWeight: '600' },
  navLabelActive: { color: H.navy, fontWeight: '800' },
  chiefButton: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: H.purple,
    alignItems: 'center', justifyContent: 'center', marginTop: -27,
    shadowColor: H.purple, shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 9,
  },
  chiefButtonActive: { backgroundColor: '#5634ED' },
  householdSlot: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: H.purple, marginTop: -18,
    shadowColor: H.purple, shadowOpacity: 0.32, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 9,
  },
  modalRoot: { flex: 1, backgroundColor: 'rgba(6,10,20,0.67)' },
  radialArea: { position: 'absolute', left: 0, right: 0, height: 310, alignItems: 'center', justifyContent: 'flex-end' },
  bubbleWrap: { position: 'absolute', bottom: 18, alignItems: 'center' },
  bubbleTouch: { width: 82, alignItems: 'center' },
  bubble: {
    width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 7,
  },
  bubbleLabel: { color: '#fff', fontSize: 11.5, fontWeight: '700', marginTop: 6, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  centerButton: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1D2448',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8,
  },
});
