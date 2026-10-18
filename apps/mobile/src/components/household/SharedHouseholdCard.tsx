import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { H } from '../../theme/hearthDesign';

type Snapshot = {
  as_of:string; visibility:string; bills:unknown[]; groceries:unknown[];
  tasks:unknown[]; devices_last_known:unknown[];
  third_party_live_pull_enabled:boolean; bank_balances_included:boolean;
};

export default function SharedHouseholdCard() {
  const [data,setData] = useState<Snapshot|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const pull = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await api.get<Snapshot>('/api/household/connected-snapshot');
      if (response.data.bank_balances_included || response.data.third_party_live_pull_enabled) {
        throw new Error('Unexpected data sharing scope');
      }
      setData(response.data);
      setError('');
    } catch {
      setData(null);
      setError('Household data could not be refreshed. Please try again.');
    } finally { setBusy(false); }
  };
  return <View style={s.card}>
    <View style={s.top}><Ionicons name="sync-outline" size={21} color={H.purple}/>
      <View style={{flex:1}}><Text style={s.title}>Connected household</Text><Text style={s.note}>Read current shared records across Hearth.</Text></View>
    </View>
    <Text style={s.note}>Shared with authorized household members: recorded bills, utilities, groceries, tasks and last-known smart-home states. Private bank balances, health records and documents are not included.</Text>
    <TouchableOpacity onPress={pull} disabled={busy} style={[s.button,busy && {opacity:.55}]}>
      {busy ? <ActivityIndicator color="#fff"/> : <Text style={s.buttonText}>Pull household updates</Text>}
    </TouchableOpacity>
    {!!error && <Text style={s.note}>{error}</Text>}
    {!!data && <View style={s.results}>
      <Text style={s.title}>Current saved records</Text>
      <Text style={s.note}>{data.bills.length} bills · {data.groceries.length} groceries · {data.tasks.length} tasks · {data.devices_last_known.length} cached device states</Text>
      <Text style={s.note}>Refreshed {data.as_of.slice(0,16).replace('T',' ')} UTC. Provider imports are not yet enabled.</Text>
    </View>}
  </View>;
}
const s=StyleSheet.create({
  card:{marginTop:15,padding:16,borderRadius:20,borderWidth:1,borderColor:'#E0D8F2',backgroundColor:'#F7F4FF',gap:11},
  top:{flexDirection:'row',gap:10,alignItems:'center'},
  title:{fontWeight:'800',fontSize:14,color:H.navy},
  note:{fontSize:11.5,color:H.muted,lineHeight:18,marginTop:4},
  button:{minHeight:45,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:H.purple},
  buttonText:{color:'#fff',fontSize:12,fontWeight:'800'},
  results:{borderTopWidth:1,borderColor:'#E5DEF5',paddingTop:12}
});
