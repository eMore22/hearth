import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';
import { H } from '../../src/theme/hearthDesign';
import api from '../../src/services/api';

type MonoCapabilities = {
  country: string;
  currency: string;
  discovery_available: boolean;
  bank_linking_enabled: boolean;
  payment_execution_enabled: boolean;
};
type Bank = { id: string; name: string; country: string };

export default function NigeriaBankSandbox() {
  const insets = useSafeAreaInsets();
  const [caps, setCaps] = useState<MonoCapabilities | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const load = async () => {
    try {
      const { data } = await api.get<MonoCapabilities>('/api/finance/sandbox/mono/capabilities');
      setCaps(data);
      setNotice(null);
    } catch {
      setNotice('Nigerian banking demo status is temporarily unavailable.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const discover = async () => {
    setBusy(true);
    try {
      const { data } = await api.get<{institutions: Bank[]}>('/api/finance/sandbox/mono/institutions');
      setBanks(data.institutions);
      setNotice('These are Sandbox-supported institutions. No bank account is connected.');
    } catch {
      setNotice('Mono Sandbox institution discovery is not yet enabled for this account.');
    } finally { setBusy(false); }
  };
  return <View style={s.page}>
    <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
    <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 42 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); load(); }} />}>
      <ScreenHeader backTo="/(tabs)/integrations" title="Nigerian banking" subtitle="Safe NGN banking tests before public launch." />
      <View style={s.body}>
        <View style={s.banner}>
          <Ionicons name="shield-checkmark-outline" size={28} color={H.purple}/>
          <Text style={s.title}>Mono Sandbox integration</Text>
          <Text style={s.bodyText}>Hearth is preparing Nigerian bank connectivity. Nothing on this screen can connect a real bank, reveal a balance, or move money.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.label}>Connection readiness</Text>
          <Text style={s.line}>{caps?.discovery_available ? 'Institution discovery available' : 'Waiting for Mono Sandbox setup'}</Text>
          <Text style={s.note}>Currency: NGN</Text>
          <Text style={s.note}>Account connection: Disabled</Text>
          <Text style={s.note}>Payments: Disabled</Text>
        </View>
        <TouchableOpacity style={[s.button, (!caps?.discovery_available || busy) && s.disabled]}
          onPress={discover} disabled={!caps?.discovery_available || busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>See Sandbox test banks</Text>}
        </TouchableOpacity>
        {!!notice && <Text style={s.notice}>{notice}</Text>}
        {banks.map(bank => <View key={bank.id} style={s.bank}>
          <Ionicons name="business-outline" color={H.muted} size={18}/>
          <Text style={s.bankName}>{bank.name}</Text>
          <Text style={s.tag}>Sandbox</Text>
        </View>)}
        <Text style={s.heading}>What comes next</Text>
        <Text style={s.bodyText}>After Mono developer testing is configured, we will add explicit read-only consent, bank account preview, simulated transaction synchronization, and secure disconnection, following the Canada test process.</Text>
      </View>
    </ScrollView>
  </View>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},
  banner:{backgroundColor:'#F0EBFF',padding:19,borderRadius:20,alignItems:'flex-start'},
  title:{fontSize:18,fontWeight:'800',color:H.navy,marginTop:12},
  bodyText:{fontSize:12.5,color:H.muted,lineHeight:20,marginTop:9},
  card:{backgroundColor:'#fff',borderRadius:18,padding:18,marginTop:14,borderWidth:1,borderColor:H.lineSoft},
  label:{fontWeight:'800',color:H.navy,fontSize:13},line:{color:H.purple,fontWeight:'800',marginTop:10},
  note:{color:H.muted,fontSize:12,marginTop:8},
  button:{height:51,backgroundColor:H.purple,borderRadius:16,justifyContent:'center',alignItems:'center',marginTop:14},
  disabled:{opacity:.4},buttonText:{color:'#fff',fontSize:13,fontWeight:'800'},
  notice:{fontSize:12,color:H.muted,marginTop:12},
  bank:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#fff',padding:14,borderRadius:13,marginTop:7},
  bankName:{flex:1,color:H.navy,fontWeight:'700',fontSize:12.5},tag:{color:H.muted,fontSize:10},
  heading:{fontSize:17,color:H.navy,fontWeight:'800',marginTop:25},
});
