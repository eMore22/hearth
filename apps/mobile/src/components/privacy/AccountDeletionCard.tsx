import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/api';
import { H } from '../../theme/hearthDesign';

type DeletionRequest = { status:string; requested_at:string };
const CONFIRM = 'DELETE MY ACCOUNT';

export default function AccountDeletionCard() {
  const [request, setRequest] = useState<DeletionRequest|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState(false);

  const refresh = async () => {
    try {
      const response = await authService.deletionRequestStatus();
      setRequest(response.data.request);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const requestDeletion = () => {
    if (confirmation !== CONFIRM || busy) return;
    Alert.alert('Request deletion?', 'Your account will remain active while Hearth verifies and processes this request. Google Play subscriptions must be cancelled separately. Other household members may retain records they own.', [
      {text:'Keep account', style:'cancel'},
      {text:'Submit request', style:'destructive', onPress: async () => {
        setBusy(true);
        try {
          await authService.requestDeletion(CONFIRM);
          await refresh();
          setShowForm(false);
          setConfirmation('');
          Alert.alert('Request received', 'Your deletion request has been recorded. This is not confirmation that your account or data has been deleted.');
        } catch(e: any) {
          Alert.alert('Request not saved', e?.response?.data?.detail || 'Please retry or contact support@hearthhq.online.');
        } finally { setBusy(false); }
      }},
    ]);
  };

  const cancel = () => Alert.alert('Cancel deletion request?', 'Your account and data remain active while a request is pending.', [
    {text:'Keep request', style:'cancel'},
    {text:'Cancel request', onPress: async () => {
      setBusy(true);
      try {
        await authService.cancelDeletion();
        await refresh();
        Alert.alert('Request cancelled', 'Your deletion request has been cancelled.');
      } catch(e:any) {
        Alert.alert('Could not cancel', e?.response?.data?.detail || 'Contact support if processing has started.');
      } finally { setBusy(false); }
    }},
  ]);

  const pending = request?.status === 'requested';
  const processing = request?.status === 'processing';
  return <View style={s.card}>
    <View style={s.heading}><Ionicons name="trash-outline" size={19} color={H.red}/><Text style={s.title}>Delete your Hearth account</Text></View>
    <Text style={s.note}>Submit a tracked request to delete your account and associated personal data. Hearth verifies shared household ownership, connected providers and retention requirements before processing. Requesting deletion does not cancel subscriptions.</Text>
    {statusError && <Text style={s.warning}>Request status temporarily unavailable. Please retry before submitting.</Text>}
    {(pending || processing) && <>
      <Text style={s.state}>Request {processing ? 'being processed' : 'received'} · {request?.requested_at?.slice(0,10) || 'date unavailable'}</Text>
      <Text style={s.note}>Your account has not yet been confirmed deleted.</Text>
      {pending && <TouchableOpacity style={s.secondary} disabled={busy} onPress={cancel}><Text style={s.secondaryText}>Cancel pending request</Text></TouchableOpacity>}
    </>}
    {!pending && !processing && <>
      {!showForm
        ? <TouchableOpacity disabled={busy || statusError} style={s.secondary} onPress={() => setShowForm(true)}><Text style={s.secondaryText}>Request account deletion</Text></TouchableOpacity>
        : <>
          <Text style={s.note}>Type DELETE MY ACCOUNT exactly to confirm you want to submit a deletion request.</Text>
          <TextInput value={confirmation} onChangeText={setConfirmation} placeholder={CONFIRM} autoCapitalize="characters" autoCorrect={false} style={s.input} accessibilityLabel="Type DELETE MY ACCOUNT"/>
          <TouchableOpacity disabled={busy || confirmation !== CONFIRM} onPress={requestDeletion} style={[s.danger,(busy || confirmation !== CONFIRM) && {opacity:.45}]}>
            {busy ? <ActivityIndicator color="#fff"/> : <Text style={s.dangerText}>Submit deletion request</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {setShowForm(false);setConfirmation('');}}><Text style={s.note}>Never mind, keep my account</Text></TouchableOpacity>
        </>}
    </>}
  </View>;
}

const s=StyleSheet.create({
  card:{padding:16,borderWidth:1,borderColor:H.lineSoft,backgroundColor:'#fff',borderRadius:20,marginTop:12,gap:10},
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  title:{color:H.navy,fontSize:14,fontWeight:'800'},
  note:{color:H.muted,fontSize:11.5,lineHeight:19},
  state:{fontSize:12,fontWeight:'800',color:H.navy},
  warning:{fontSize:11.5,color:H.red},
  secondary:{padding:13,borderRadius:12,borderWidth:1,borderColor:H.lineSoft,alignItems:'center'},
  secondaryText:{color:H.red,fontWeight:'800',fontSize:12},
  input:{padding:12,borderWidth:1,borderColor:H.lineSoft,borderRadius:12,color:H.navy},
  danger:{backgroundColor:H.red,borderRadius:12,alignItems:'center',padding:14},
  dangerText:{color:'#fff',fontWeight:'800',fontSize:12},
});
