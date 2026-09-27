import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

const countryOptions = [{label:'Canada',value:'CA',currency:'CAD',timezone:'America/Toronto'}, {label:'Nigeria',value:'NG',currency:'NGN',timezone:'Africa/Lagos'}, {label:'United States',value:'US',currency:'USD',timezone:'America/New_York'}];
const currencies = ['CAD','USD','NGN','GBP','EUR'];

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const updateHousehold = useHouseholdStore(s => s.updateHousehold);
  const loading = useHouseholdStore(s => s.loading);
  const [country,setCountry]=useState(household?.country || 'CA');
  const [currency,setCurrency]=useState(household?.currency || 'CAD');
  const [timezone,setTimezone]=useState(household?.timezone || 'America/Toronto');

  useEffect(()=>{ if(!household) fetchHousehold(); },[]);
  useEffect(()=>{ if(household){ setCountry(household.country||'CA'); setCurrency(household.currency||'CAD'); setTimezone(household.timezone||'America/Toronto'); } },[household?.id]);

  const chooseCountry=(opt: typeof countryOptions[number])=>{ setCountry(opt.value); setCurrency(opt.currency); setTimezone(opt.timezone); };
  const save=async()=>{ try{ await updateHousehold({country,currency,timezone:timezone.trim()}); Alert.alert('Preferences saved','Hearth will use these household defaults.'); }catch(e:any){ Alert.alert('Could not save', e?.response?.data?.detail || e?.message || 'Please try again.'); } };

  return <View style={styles.root}><StatusBar barStyle="dark-content" backgroundColor={H.paper}/><ScrollView contentContainerStyle={{paddingTop:Math.max(insets.top,12),paddingBottom:40}} showsVerticalScrollIndicator={false}><ScreenHeader title="Preferences" subtitle="Set the defaults Hearth uses around your household."/><View style={styles.body}>
    <Text style={styles.label}>COUNTRY</Text><View style={styles.optionWrap}>{countryOptions.map(opt=><TouchableOpacity key={opt.value} onPress={()=>chooseCountry(opt)} style={[styles.option,country===opt.value&&styles.optionActive]}><Text style={[styles.optionText,country===opt.value&&styles.optionTextActive]}>{opt.label}</Text>{country===opt.value&&<Ionicons name="checkmark" size={16} color="#fff"/>}</TouchableOpacity>)}</View>
    <Text style={styles.label}>CURRENCY</Text><View style={styles.optionWrap}>{currencies.map(c=><TouchableOpacity key={c} onPress={()=>setCurrency(c)} style={[styles.optionSmall,currency===c&&styles.optionActive]}><Text style={[styles.optionText,currency===c&&styles.optionTextActive]}>{c}</Text></TouchableOpacity>)}</View>
    <Text style={styles.label}>TIMEZONE</Text><View style={styles.inputWrap}><Ionicons name="time-outline" size={18} color={H.muted}/><TextInput value={timezone} onChangeText={setTimezone} autoCapitalize="none" style={styles.input} placeholder="America/Toronto" placeholderTextColor={H.muted2}/></View><Text style={styles.hint}>Use an IANA timezone such as America/Toronto, America/Vancouver or Africa/Lagos.</Text>
    <View style={styles.note}><Ionicons name="information-circle-outline" size={18} color={H.blue}/><Text style={styles.noteText}>Appearance is intentionally fixed to Hearth’s premium light design in this build. We removed the old theme toggle because it only changed part of the app.</Text></View>
    <TouchableOpacity style={[styles.save,loading&&{opacity:.55}]} onPress={save} disabled={loading}><Text style={styles.saveText}>{loading?'Saving…':'Save preferences'}</Text></TouchableOpacity>
  </View></ScrollView></View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},label:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:H.muted,marginTop:18,marginBottom:9},optionWrap:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{minHeight:44,paddingHorizontal:14,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:H.line,flexDirection:'row',alignItems:'center',gap:7},optionSmall:{minWidth:62,minHeight:42,paddingHorizontal:13,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:H.line,alignItems:'center',justifyContent:'center'},optionActive:{backgroundColor:H.navy,borderColor:H.navy},optionText:{color:H.navy,fontSize:11.5,fontWeight:'800'},optionTextActive:{color:'#fff'},inputWrap:{height:52,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:H.line,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:13,...HearthDesign.shadow.card},input:{flex:1,color:H.navy,fontSize:13.5,paddingVertical:0},hint:{color:H.muted2,fontSize:10.8,lineHeight:16,marginTop:7},note:{marginTop:21,borderRadius:18,backgroundColor:H.blueBg,padding:13,flexDirection:'row',gap:9,alignItems:'flex-start'},noteText:{flex:1,color:H.muted,fontSize:11.2,lineHeight:17},save:{height:52,borderRadius:17,backgroundColor:H.navy,alignItems:'center',justifyContent:'center',marginTop:22},saveText:{color:'#fff',fontSize:13.5,fontWeight:'900'}});
