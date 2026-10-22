import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { H } from '../../theme/hearthDesign';
import api from '../../services/api';
import { isInternalBankingSandboxBuild } from '../../config/bankingRelease';

type Capabilities = { discovery_available: boolean; bank_linking_enabled: boolean; payment_execution_enabled: boolean };
type Bank = { id: string; name: string; country: string };
type Connection = { id: string; status: string; read_only: boolean; can_view_data: boolean; consent_expires_at: string | null };
type Account = { institution: string; display_name: string; masked_account: string; balance_minor: number | null; currency: string; data_status: string; sandbox: boolean };
type Transaction = { date: string; narration: string; amount_minor: number; type: string; currency: string };

export default function MonoSandboxPanel() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState('');
  const load = async () => {
    try {
      const [capabilities, linked] = await Promise.all([
        api.get<Capabilities>('/api/finance/sandbox/mono/capabilities'),
        api.get<{connections: Connection[]}>('/api/finance/sandbox/mono/connections'),
      ]);
      setCaps(capabilities.data);
      setConnections(linked.data.connections || []);
      setError('');
    } catch {
      setError('Unable to check the Mono Sandbox. Please try again.');
    }
  };
  useEffect(() => { if (isInternalBankingSandboxBuild) void load(); }, []);

  const discover = async () => {
    setBusy(true);
    try {
      const { data } = await api.get<{institutions: Bank[]}>('/api/finance/sandbox/mono/institutions');
      setBanks(data.institutions || []);
      setError('');
    } catch { setError('Sandbox bank discovery is currently unavailable.'); }
    finally { setBusy(false); }
  };

  const start = async () => {
    if (!agree || !caps?.bank_linking_enabled) { return; }
    setBusy(true);
    try {
      const { data } = await api.post<{url: string}>('/api/finance/sandbox/mono/link', {
        consent_acknowledged: true,
      });
      // The browser goes directly to Mono's hosted Connect Link; Hearth
      // never receives test bank passwords. A verified webhook confirms linking.
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'link.mono.co') {
        throw new Error('Unexpected provider URL');
      }
      await Linking.openURL(data.url);
      setError('Complete the simulated link in Mono, return to Hearth and tap Refresh connections.');
    } catch {
      setError('Mono Sandbox linking could not start. Check the server connection and try again.');
    } finally { setBusy(false); }
  };

  const preview = async (id: string) => {
    setBusy(true);
    try {
      const { data } = await api.get<Account>(`/api/finance/sandbox/mono/connections/${id}/preview`);
      setAccount(data); setTransactions([]); setSelected(id); setError('');
    } catch { setError('This account is not ready, or its consent has expired.'); }
    finally { setBusy(false); }
  };

  const activity = async (id: string) => {
    setBusy(true);
    try {
      const { data } = await api.get<{transactions: Transaction[]}>(`/api/finance/sandbox/mono/connections/${id}/transactions`);
      setTransactions(data.transactions || []); setSelected(id); setError('');
    } catch { setError('Transactions are not available yet. Try again after Mono completes its data sync.'); }
    finally { setBusy(false); }
  };

  const disconnect = (id: string) => {
    Alert.alert('Disconnect Sandbox bank?', 'This immediately revokes Hearth read-only consent and asks Mono to unlink the test account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await api.post(`/api/finance/sandbox/mono/connections/${id}/disconnect`);
          setSelected(''); setAccount(null); setTransactions([]);
          await load();
        } catch { setError('Disconnect needs a retry. Hearth has blocked access if revocation was recorded.'); }
        finally { setBusy(false); }
      } },
    ]);
  };

  if (!isInternalBankingSandboxBuild) return null;

  return <View style={s.body}>
        <View style={s.banner}>
          <Ionicons name="shield-checkmark-outline" size={25} color={H.purple}/>
          <Text style={s.title}>Nigerian bank Sandbox</Text>
          <Text style={s.note}>Simulated financial data only. Hearth will never request your bank password. Real bank access and payments remain disabled.</Text>
        </View>
        <Text style={s.heading}>Connection status</Text>
        <Text style={s.note}>{caps?.bank_linking_enabled ? 'Read-only Sandbox linking available.' : 'Waiting for verified Mono webhook setup.'}</Text>
        <TouchableOpacity style={s.soft} disabled={busy} onPress={async () => { setBusy(true); await load(); setBusy(false); }}>
          <Text style={s.softText}>Refresh connections</Text>
        </TouchableOpacity>

        <View style={s.consent}>
          <View style={{flex:1}}>
            <Text style={s.name}>I agree to simulated bank data access</Text>
            <Text style={s.note}>Read-only Sandbox accounts, balances and transactions for up to 30 days. I can revoke consent at any time. This information remains private to my account.</Text>
          </View>
          <Switch value={agree} onValueChange={setAgree} disabled={busy} trackColor={{true:H.purple}}/>
        </View>
        <TouchableOpacity style={[s.primary, (!agree || !caps?.bank_linking_enabled || busy) && s.disabled]}
          disabled={!agree || !caps?.bank_linking_enabled || busy} onPress={start}>
          {busy ? <ActivityIndicator color="#fff"/> : <Text style={s.primaryText}>Connect simulated Nigerian bank</Text>}
        </TouchableOpacity>
        {error ? <Text style={s.warning}>{error}</Text> : null}

        <Text style={s.heading}>Saved Sandbox connections</Text>
        {!connections.length && <Text style={s.note}>No simulated bank linked yet.</Text>}
        {connections.map(c => <View key={c.id} style={s.card}>
          <Text style={s.name}>Mono test bank · {c.status}</Text>
          <Text style={s.note}>Read-only consent ends {c.consent_expires_at?.slice(0,10) || 'not recorded'}</Text>
          {c.can_view_data && <View style={s.actions}>
            <TouchableOpacity onPress={() => preview(c.id)} disabled={busy}><Text style={s.link}>View account</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => activity(c.id)} disabled={busy}><Text style={s.link}>Transactions</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => disconnect(c.id)} disabled={busy}><Text style={[s.link,{color:H.red}]}>Disconnect</Text></TouchableOpacity>
          </View>}
          {c.status === 'error' && <TouchableOpacity onPress={() => disconnect(c.id)} disabled={busy}><Text style={[s.link,{color:H.red}]}>Retry disconnection</Text></TouchableOpacity>}
          {c.status === 'pending' && <Text style={s.note}>Waiting for Mono to confirm the bank link.</Text>}
        </View>)}

        {account && !!selected && <View style={s.card}>
          <Text style={s.name}>{account.institution} · {account.display_name}</Text>
          <Text style={s.note}>Account {account.masked_account}. Status: {account.data_status}.</Text>
          <Text style={s.note}>Balances are private. The household owner can view a bank balance in Profile.</Text>
          <Text style={s.note}>Simulated account values, not real funds.</Text>
        </View>}
        {!!transactions.length && <View style={s.card}>
          <Text style={s.name}>Recent simulated transactions</Text>
          {transactions.map((t,i) => <View style={s.transaction} key={i}>
            <View style={{flex:1}}><Text style={s.name}>{t.narration}</Text><Text style={s.note}>{t.date.slice(0,10)} · {t.type}</Text></View>
            <Text style={s.amount}>NGN {(t.amount_minor/100).toFixed(2)}</Text>
          </View>)}
        </View>}
        <Text style={s.heading}>Sandbox institutions</Text>
        <TouchableOpacity disabled={busy || !caps?.discovery_available} style={s.soft} onPress={discover}>
          <Text style={s.softText}>See Sandbox test banks</Text>
        </TouchableOpacity>
        {banks.map(b => <Text style={s.bank} key={b.id}>{b.name}</Text>)}
  </View>;
}

const s=StyleSheet.create({
  page:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},
  banner:{backgroundColor:'#F0EBFF',padding:18,borderRadius:20},
  title:{fontSize:18,fontWeight:'800',color:H.navy,marginTop:9},
  heading:{fontSize:17,fontWeight:'800',color:H.navy,marginTop:23,marginBottom:10},
  name:{fontSize:13,fontWeight:'800',color:H.navy},
  note:{fontSize:12,color:H.muted,lineHeight:19,marginTop:6},
  consent:{backgroundColor:'#fff',padding:15,borderRadius:16,flexDirection:'row',gap:12,alignItems:'center',marginTop:14},
  primary:{backgroundColor:H.purple,borderRadius:15,padding:15,alignItems:'center',marginTop:12},
  primaryText:{color:'#fff',fontWeight:'800',fontSize:13},
  disabled:{opacity:.42},
  soft:{backgroundColor:'#EDE8FF',padding:13,borderRadius:14,marginTop:10,alignItems:'center'},
  softText:{color:H.purple,fontWeight:'800'},
  link:{color:H.purple,fontSize:12,fontWeight:'800'},
  actions:{flexDirection:'row',gap:16,marginTop:14,flexWrap:'wrap'},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,borderRadius:17,padding:15,marginTop:9},
  amount:{fontSize:14,fontWeight:'800',color:H.navy,marginTop:8},
  transaction:{paddingVertical:9,flexDirection:'row',gap:10,borderBottomWidth:.5,borderColor:H.lineSoft},
  warning:{fontSize:12,color:H.red,marginTop:12},
  bank:{color:H.muted,fontSize:13,paddingVertical:9},
});
