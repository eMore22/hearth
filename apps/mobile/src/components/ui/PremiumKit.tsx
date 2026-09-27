import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { H, HearthDesign } from '../../theme/hearthDesign';

export function ScreenHeader({
  title,
  subtitle,
  back = true,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {back ? (
          <TouchableOpacity style={styles.back} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={21} color={H.navy} />
          </TouchableOpacity>
        ) : <View style={{ width: 42 }} />}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.headerRight}>{right || <View style={{ width: 42 }} />}</View>
      </View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function IconBadge({
  icon,
  bg,
  color,
  size = 46,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconBadge, { width: size, height: size, borderRadius: Math.round(size * 0.31), backgroundColor: bg }]}> 
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
    </View>
  );
}

export function Surface({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function Pill({
  label,
  bg = '#F5F4F7',
  color = H.navy,
  onPress,
}: {
  label: string;
  bg?: string;
  color?: string;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.pill, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.pillText, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color }]}>{label}</Text></View>;
}

export function EmptyMessage({ icon = 'sparkles-outline', title, subtitle }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <IconBadge icon={icon} bg="#F1ECFF" color={H.purple} size={52} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.emptySub}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, backgroundColor: H.paper },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F1F0' },
  headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 23, fontWeight: '800', color: H.navy, letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11.5, color: H.muted, marginTop: 2, textAlign: 'center' },
  headerRight: { width: 42, alignItems: 'flex-end' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: H.navy, letterSpacing: -0.3 },
  sectionAction: { fontSize: 13, color: H.muted, fontWeight: '600' },
  iconBadge: { alignItems: 'center', justifyContent: 'center' },
  surface: { backgroundColor: H.white, borderWidth: 1, borderColor: H.lineSoft, borderRadius: HearthDesign.radius.lg, ...HearthDesign.shadow.card },
  pill: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: H.navy, marginTop: 12 },
  emptySub: { fontSize: 13, color: H.muted, textAlign: 'center', marginTop: 5, lineHeight: 19 },
});
