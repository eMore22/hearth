import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { H } from '../../theme/hearthDesign';

type Account = { id:string; display_name?:string; masked_account?:string; currency?:string; balance_minor:number|null; updated_at?:string|null };
type MonoLink = { id:string; balance_requires_explicit_refresh:boolean };
type Profile = { private:boolean; owner_only:boolean; sandbox_only:boolean; accounts:Account[]; mono_connections:MonoLink[] };
type MonoBalance = { institution:string; display_name:string; masked_account:string; currency:string; balance_minor:number|null };

const money = (currency: string|undefined, value: number|null) =>
  value == null || !['CAD','NGN'].includes(currency || '') ? 'Balance unavailable' :
  `${currency} ${(value / 100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function PrivateFinanceCard() {
  const [profile, setProfile] = useState<Profile|null>(null);
  const [state, setState] = useState<'loading'|'owner'|'member'|'unavailable'>('loading');
  const [busy, setBusy] = useState(false);
  const [mono, setMono] = useState<{id:string;account:MonoBalance}|null>(null);
  useEffect(() => {
    let active = true;
    // Profile only reads saved balances from the database. It does not call Mono.
    api.get<Profile>('/api/finance/owner-profile').then(r => {
      if (active) { setProfile(r.data); setState('owner'); }
    }).catch((err:any) => {
      if (active) setState(err?.response?.status === 403 ? 'member' : 'unavailable');
    });
    return () => { active = false; };
  }, []);
  const viewMono = async (id:string) => {
    if (busy) return;
    setBusy(true); setMono(null);
    try {
      // Explicit user action: no paid-provider polling behind the scenes.
      const result = await api.post<MonoBalance>(`/api/finance/owner-profile/mono/${id}/preview`);
      setMono({id,account:result.data});
    } catch {
      Alert.alert('Balance unavailable', 'The test connection may be expired or disconnected.');
    } finally { setBusy(false); }
  };
  return <View style={s.card}>
    <View style={s.titleRow}><Ionicons name="shield-checkmark-outline" color={H.purple} size={21}/><Text style={s.heading}>Private bank balances</Text></View>
    <Text style={s.note}>Only the household owner can see their own bank balances. Family members and Chief of Staff cannot access private banking details.</Text>
    {state === 'loading' && <ActivityIndicator color={H.purple} />}
    {state === 'member' && <Text style={s.note}>Locked for household members. Bills and utilities are still shared.</Text>}
    {state === 'unavailable' && <Text style={s.note}>Unable to verify owner access. No balance is displayed.</Text>}
    {state === 'owner' && <>
      <Text style={s.note}>Internal test balances only. No real funds or payments.</Text>
      {!profile?.accounts?.length && !profile?.mono_connections?.length && <Text style={s.note}>No active simulated banks. Connect in Banks & Household Finance.</Text>}
      {profile?.accounts?.map(a => <View key={a.id} style={s.account}>
        <View style={{flex:1}}><Text style={s.accountName}>{a.display_name || 'Canadian test account'}</Text><Text style={s.note}>{a.masked_account || '••••'} · CAD Sandbox</Text></View>
        <Text style={s.amount}>{money(a.currency,a.balance_minor)}</Text>
      </View>)}
      {profile?.mono_connections?.map(c => <View key={c.id}>
        <TouchableOpacity style={s.button} disabled={busy} onPress={()=>viewMono(c.id)}>
          <Text style={s.buttonText}>{busy ? 'Checking…' : 'View Nigerian Sandbox balance'}</Text>
        </TouchableOpacity>
        {mono?.id === c.id && <View style={s.account}>
          <View style={{flex:1}}><Text style={s.accountName}>{mono.account.institution}</Text><Text style={s.note}>{mono.account.display_name} · {mono.account.masked_account}</Text></View>
          <Text style={s.amount}>{money(mono.account.currency,mono.account.balance_minor)}</Text>
        </View>}
      </View>)}
    </>}
  </View>;
}
const s=StyleSheet.create({
  card:{marginTop:14,padding:16,borderRadius:20,backgroundColor:'#F7F4FF',borderWidth:1,borderColor:'#E5DEF5',gap:9},
  titleRow:{flexDirection:'row',alignItems:'center',gap:8},
  heading:{fontSize:15,fontWeight:'800',color:H.navy},
  note:{fontSize:11.5,color:H.muted,lineHeight:18},
  account:{borderTopWidth:1,borderTopColor:'#E5DEF5',paddingTop:12,flexDirection:'row',gap:10,alignItems:'center'},
  accountName:{fontSize:12.5,fontWeight:'800',color:H.navy},
  amount:{fontSize:12,fontWeight:'800',color:H.navy},
  button:{padding:13,alignItems:'center',borderRadius:13,backgroundColor:'#EAE3FF'},
  buttonText:{fontSize:12,fontWeight:'800',color:H.purple},
});
