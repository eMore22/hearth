import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { householdService } from '../../src/services/api';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

interface Member { id?: string; user_id?: string; role?: string; email?: string | null; full_name?: string | null; }

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await householdService.getMembers(); setMembers(Array.isArray(res.data) ? res.data : []); }
    catch (e: any) { Alert.alert('Could not load members', e?.response?.data?.detail || 'Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    const value = email.trim().toLowerCase();
    if (!value.includes('@')) { Alert.alert('Enter an email', 'Use the email address of an existing Hearth account.'); return; }
    setInviting(true);
    try {
      await householdService.inviteMember(value);
      setEmail('');
      await load();
      Alert.alert('Member added', `${value} has been added to this household.`);
    } catch (e: any) {
      Alert.alert('Could not add member', e?.response?.data?.detail || 'That person may need to create a Hearth account first.');
    } finally { setInviting(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 40 }}>
        <ScreenHeader title="Household members" subtitle="The people Hearth can organise around." />
        <View style={styles.body}>
          <View style={styles.inviteCard}>
            <View style={styles.inviteIcon}><Ionicons name="person-add-outline" size={22} color={H.purple} /></View>
            <Text style={styles.cardTitle}>Add someone to your household</Text>
            <Text style={styles.cardSub}>They need an existing Hearth account. Add them with the same email they use to sign in.</Text>
            <View style={styles.inputWrap}><Ionicons name="mail-outline" size={18} color={H.muted} /><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor={H.muted2} style={styles.input} /></View>
            <TouchableOpacity style={[styles.inviteBtn, inviting && { opacity: 0.55 }]} disabled={inviting} onPress={invite}><Text style={styles.inviteText}>{inviting ? 'Adding…' : 'Add member'}</Text></TouchableOpacity>
          </View>

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Current household</Text><Text style={styles.count}>{members.length} {members.length === 1 ? 'person' : 'people'}</Text></View>
          {loading ? <ActivityIndicator color={H.purple} style={{ marginTop: 30 }} /> : members.length === 0 ? <View style={styles.empty}><Ionicons name="people-outline" size={28} color={H.muted2} /><Text style={styles.emptyTitle}>No members found</Text><Text style={styles.emptySub}>Pull down later or try adding a member above.</Text></View> : members.map((m, index) => {
            const name = m.full_name || m.email?.split('@')[0] || 'Household member';
            return <View style={styles.member} key={m.id || m.user_id || String(index)}><View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.memberName}>{name}</Text><Text style={styles.memberEmail}>{m.email || 'Email unavailable'}</Text></View><View style={styles.role}><Text style={styles.roleText}>{m.role || 'member'}</Text></View></View>;
          })}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},inviteCard:{borderRadius:24,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,padding:18,...HearthDesign.shadow.card},inviteIcon:{width:48,height:48,borderRadius:16,backgroundColor:H.violetBg,alignItems:'center',justifyContent:'center'},cardTitle:{color:H.navy,fontSize:17,fontWeight:'900',marginTop:13},cardSub:{color:H.muted,fontSize:12.5,lineHeight:19,marginTop:5},inputWrap:{height:52,borderRadius:16,backgroundColor:'#F5F4F2',flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:13,marginTop:15},input:{flex:1,color:H.navy,fontSize:14,paddingVertical:0},inviteBtn:{height:50,borderRadius:16,backgroundColor:H.navy,alignItems:'center',justifyContent:'center',marginTop:10},inviteText:{color:'#fff',fontSize:13.5,fontWeight:'900'},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:26,marginBottom:10},sectionTitle:{color:H.navy,fontSize:19,fontWeight:'900'},count:{color:H.muted,fontSize:11.5,fontWeight:'700'},member:{minHeight:74,borderRadius:19,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:13,marginBottom:8,...HearthDesign.shadow.card},avatar:{width:44,height:44,borderRadius:15,backgroundColor:H.blueBg,alignItems:'center',justifyContent:'center'},avatarText:{color:H.blue,fontSize:16,fontWeight:'900'},flex:{flex:1,minWidth:0},memberName:{color:H.navy,fontSize:13.5,fontWeight:'900'},memberEmail:{color:H.muted,fontSize:10.8,marginTop:2},role:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:H.greenBg},roleText:{color:H.green,fontSize:9.5,fontWeight:'900',textTransform:'capitalize'},empty:{alignItems:'center',paddingVertical:42},emptyTitle:{color:H.navy,fontSize:14,fontWeight:'800',marginTop:10},emptySub:{color:H.muted,fontSize:11.5,marginTop:4}
});
