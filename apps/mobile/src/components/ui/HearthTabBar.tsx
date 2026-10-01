import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H, HearthDesign } from '../../theme/hearthDesign';

const modules = [
  { label: 'Documents', icon: 'document-text' as const, route: '/(tabs)/documents', bg: '#EDF4FF', fg: '#2A75E6' },
  { label: 'Bills & subscriptions', icon: 'card' as const, route: '/(tabs)/bills', bg: '#F1ECFF', fg: '#7650E8' },
  { label: 'Grocery & meals', icon: 'basket' as const, route: '/(tabs)/grocery', bg: '#E8F7EE', fg: '#168D54' },
  { label: 'Home & maintenance', icon: 'home' as const, route: '/(tabs)/maintenance', bg: '#FFF0D9', fg: '#A96818' },
  { label: 'Family health', icon: 'heart' as const, route: '/(tabs)/health', bg: '#FFE9ED', fg: '#D83A55' },
];

export default function HearthTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const go = (route: string) => {
    setOpen(false);
    router.push(route as any);
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
            <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => setOpen(v => !v)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={open ? 'Close household menu' : 'Open household menu'}>
              <View style={[styles.iconSlot, householdActive && styles.householdSlot]}><Ionicons name={active ? item.icon : item.outline} size={21} color={householdActive ? '#fff' : active ? H.purple : H.muted} /></View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={item.key} style={styles.navItem} onPress={() => { if (modal) setOpen(false); if (idx >= 0) navigation.navigate(state.routes[idx].name); }} activeOpacity={0.75}>
            {item.chief ? <View style={[styles.chiefButton, focused && styles.chiefButtonActive]}><Ionicons name="sparkles" size={25} color="#fff" /></View> : <View style={styles.iconSlot}><Ionicons name={focused ? item.icon : item.outline} size={21} color={focused ? H.navy : H.muted} /></View>}
            <Text style={[styles.navLabel, focused && styles.navLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return <>{renderBar()}<Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.modalRoot}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close household menu"/><View style={[styles.menuRail,{bottom:88+Math.max(insets.bottom,7)}]} pointerEvents="box-none"><View style={styles.menuPanel}><Text style={styles.menuEyebrow}>HOUSEHOLD</Text><Text style={styles.menuTitle}>Where do you want to go?</Text>{modules.map(item=><TouchableOpacity key={item.label} style={styles.menuRow} onPress={()=>go(item.route)} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={`Open ${item.label}`}><View style={[styles.menuIcon,{backgroundColor:item.bg}]}><Ionicons name={item.icon} size={21} color={item.fg}/></View><Text style={styles.menuLabel}>{item.label}</Text><Ionicons name="chevron-forward" size={19} color={H.muted2}/></TouchableOpacity>)}</View><View style={styles.railTail}/></View>{renderBar(true)}</View></Modal></>;
}

const styles = StyleSheet.create({
  barShell:{minHeight:83,marginHorizontal:10,marginTop:4,marginBottom:5,paddingTop:9,borderRadius:29,backgroundColor:'rgba(255,255,255,0.985)',borderWidth:1,borderColor:'#EFEFF3',flexDirection:'row',alignItems:'center',justifyContent:'space-around',...HearthDesign.shadow.card},
  modalBar:{position:'absolute',left:0,right:0,bottom:5},navItem:{width:66,minHeight:58,alignItems:'center',justifyContent:'flex-end',gap:3},iconSlot:{height:30,minWidth:38,alignItems:'center',justifyContent:'center',borderRadius:15},navLabel:{fontSize:10.5,color:H.muted,fontWeight:'600'},navLabelActive:{color:H.navy,fontWeight:'800'},
  chiefButton:{width:52,height:52,borderRadius:26,backgroundColor:H.purple,alignItems:'center',justifyContent:'center',marginTop:-27,shadowColor:H.purple,shadowOpacity:.32,shadowRadius:14,shadowOffset:{width:0,height:7},elevation:9},chiefButtonActive:{backgroundColor:'#5634ED'},householdSlot:{width:48,height:48,borderRadius:24,backgroundColor:H.purple,marginTop:-18,shadowColor:H.purple,shadowOpacity:.32,shadowRadius:13,shadowOffset:{width:0,height:7},elevation:9},
  modalRoot:{flex:1,backgroundColor:'rgba(6,10,20,0.62)'},menuRail:{position:'absolute',left:18,width:284,alignItems:'center'},menuPanel:{width:'100%',borderRadius:25,backgroundColor:'#FCFBF9',padding:12,borderWidth:1,borderColor:'rgba(255,255,255,0.82)',...HearthDesign.shadow.floating},menuEyebrow:{color:H.purple,fontSize:9.5,fontWeight:'900',letterSpacing:1.7,marginHorizontal:5,marginTop:2},menuTitle:{color:H.navy,fontSize:17.5,fontWeight:'900',marginHorizontal:5,marginTop:4,marginBottom:10},menuRow:{minHeight:60,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,paddingHorizontal:10,marginBottom:7,flexDirection:'row',alignItems:'center',gap:11},menuIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},menuLabel:{flex:1,color:H.navy,fontSize:14.5,fontWeight:'800'},railTail:{width:3,height:18,backgroundColor:'rgba(255,255,255,0.86)',borderRadius:2},
});
