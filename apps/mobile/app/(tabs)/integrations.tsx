import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAutomationStore } from '../../src/stores/automationStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

export default function IntegrationsScreen() {
  const insets = useSafeAreaInsets();
  const { status, isLoading, fetchStatus, connectHA, disconnectHA } = useAutomationStore();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  useEffect(() => { fetchStatus(); }, []);
  useEffect(() => { if (status.ha_instance_url) setUrl(status.ha_instance_url); }, [status.ha_instance_url]);

  const connect = async () => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(cleanUrl)) { Alert.alert('Check the URL', 'Enter the full Home Assistant URL, including https://'); return; }
    if (!token.trim()) { Alert.alert('Access token needed', 'Paste a Home Assistant long-lived access token.'); return; }
    Keyboard.dismiss();
    try {
      const result = await connectHA(cleanUrl, token.trim());
      setToken('');
      await fetchStatus();
      Alert.alert('Connected', result.message || `Hearth connected to ${result.device_count || 0} devices.`);
    } catch (e: any) { Alert.alert('Could not connect', e?.message || 'Check your URL and token.'); }
  };

  const disconnect = () => Alert.alert('Disconnect Home Assistant?', 'Hearth will stop syncing and controlling your smart-home devices.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disconnect', style: 'destructive', onPress: async () => { try { await disconnectHA(); } catch (e: any) { Alert.alert('Could not disconnect', e?.message || 'Please try again.'); } } },
  ]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 44 }}>
        <ScreenHeader title="Integrations" subtitle="Connect the services that make Hearth proactive." />
        <View style={styles.body}>
          <View style={[styles.integrationCard, status.connected && styles.integrationConnected]}>
            <View style={styles.integrationTop}><View style={[styles.logo, { backgroundColor: H.blueBg }]}><Ionicons name="home-outline" size={24} color={H.blue} /></View><View style={styles.flex}><Text style={styles.name}>Home Assistant</Text><Text style={styles.desc}>Smart-home devices, sensors and automations</Text></View>{status.connected ? <View style={styles.statusPill}><Text style={styles.statusText}>Connected</Text></View> : null}</View>
            {status.connected ? (
              <>
                <View style={styles.connectedInfo}><Text style={styles.infoLabel}>INSTANCE</Text><Text style={styles.infoValue} numberOfLines={1}>{status.ha_instance_url || 'Connected instance'}</Text><Text style={styles.infoMeta}>{status.device_count || 0} devices synced</Text></View>
                <View style={styles.actionRow}><TouchableOpacity style={styles.primarySoft} onPress={() => router.push('/(tabs)/devices')}><Ionicons name="hardware-chip-outline" size={17} color={H.blue} /><Text style={styles.primarySoftText}>View devices</Text></TouchableOpacity><TouchableOpacity style={styles.dangerSoft} onPress={disconnect}><Text style={styles.dangerText}>Disconnect</Text></TouchableOpacity></View>
              </>
            ) : (
              <>
                <Text style={styles.explain}>Use a Home Assistant URL that Hearth’s cloud API can reach. A local-only address such as 192.168.x.x or homeassistant.local usually will not work from Render. Home Assistant Cloud/Nabu Casa remote URLs are ideal.</Text>
                <Text style={styles.label}>HOME ASSISTANT URL</Text>
                <TextInput value={url} onChangeText={setUrl} style={styles.input} placeholder="https://your-instance.ui.nabu.casa" placeholderTextColor={H.muted2} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <Text style={styles.label}>LONG-LIVED ACCESS TOKEN</Text>
                <TextInput value={token} onChangeText={setToken} style={[styles.input, styles.tokenInput]} placeholder="Paste token" placeholderTextColor={H.muted2} autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <TouchableOpacity style={[styles.connectBtn, isLoading && { opacity: 0.55 }]} onPress={connect} disabled={isLoading}>{isLoading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="link-outline" size={18} color="#fff" /><Text style={styles.connectText}>Connect Home Assistant</Text></>}</TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.section}>More integrations</Text>
          <View style={styles.futureCard}><View style={[styles.logo,{backgroundColor:'#EEF7F1'}]}><Ionicons name="card-outline" size={22} color={H.green} /></View><View style={styles.flex}><Text style={styles.name}>Banks & household bills</Text><Text style={styles.desc}>Automatic financial connections are not enabled in this build yet.</Text></View><View style={styles.coming}><Text style={styles.comingText}>Coming later</Text></View></View>
          <View style={styles.futureCard}><View style={[styles.logo,{backgroundColor:H.amberBg}]}><Ionicons name="flash-outline" size={22} color={H.amber} /></View><View style={styles.flex}><Text style={styles.name}>Utilities</Text><Text style={styles.desc}>Direct utility-provider connections are not enabled yet.</Text></View><View style={styles.coming}><Text style={styles.comingText}>Coming later</Text></View></View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},integrationCard:{borderRadius:24,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,padding:17,...HearthDesign.shadow.card},integrationConnected:{borderColor:'#D5EEDC'},integrationTop:{flexDirection:'row',alignItems:'center',gap:11},logo:{width:48,height:48,borderRadius:16,alignItems:'center',justifyContent:'center'},flex:{flex:1,minWidth:0},name:{color:H.navy,fontSize:14.5,fontWeight:'900'},desc:{color:H.muted,fontSize:11.2,lineHeight:16,marginTop:2},statusPill:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,backgroundColor:H.greenBg},statusText:{color:H.green,fontSize:9.5,fontWeight:'900'},explain:{color:H.muted,fontSize:11.8,lineHeight:18,marginTop:15,marginBottom:16},label:{fontSize:9.8,fontWeight:'900',letterSpacing:1.2,color:H.muted,marginBottom:7,marginTop:8},input:{height:50,borderRadius:15,backgroundColor:'#F5F4F2',paddingHorizontal:13,color:H.navy,fontSize:13.2,borderWidth:1,borderColor:'#ECEAE7'},tokenInput:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace'},connectBtn:{height:52,borderRadius:16,backgroundColor:H.navy,marginTop:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},connectText:{color:'#fff',fontSize:13,fontWeight:'900'},connectedInfo:{marginTop:15,borderRadius:17,backgroundColor:H.greenBg,padding:13},infoLabel:{color:H.green,fontSize:9,fontWeight:'900',letterSpacing:1.2},infoValue:{color:H.navy,fontSize:12.5,fontWeight:'800',marginTop:4},infoMeta:{color:H.muted,fontSize:10.8,marginTop:3},actionRow:{flexDirection:'row',gap:9,marginTop:12},primarySoft:{flex:1,height:47,borderRadius:15,backgroundColor:H.blueBg,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},primarySoftText:{color:H.blue,fontSize:11.5,fontWeight:'900'},dangerSoft:{height:47,paddingHorizontal:16,borderRadius:15,backgroundColor:H.redBg,alignItems:'center',justifyContent:'center'},dangerText:{color:H.red,fontSize:11.5,fontWeight:'900'},section:{color:H.navy,fontSize:19,fontWeight:'900',marginTop:27,marginBottom:10},futureCard:{minHeight:80,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:11,marginBottom:9},coming:{paddingHorizontal:8,paddingVertical:5,borderRadius:999,backgroundColor:'#F1F0EF'},comingText:{color:H.muted,fontSize:8.8,fontWeight:'800'}
});
