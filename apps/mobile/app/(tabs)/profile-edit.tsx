import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const currentName = useMemo(() => user?.user_metadata?.full_name || '', [user]);
  const [name, setName] = useState(currentName);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Add your name', 'Enter at least 2 characters.');
      return;
    }
    Keyboard.dismiss();
    try {
      await updateProfile(trimmed);
      Alert.alert('Profile updated', 'Your name has been saved.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Could not update profile', e?.message || 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 40 }}>
        <ScreenHeader title="Edit profile" subtitle="Keep your Hearth identity up to date." />
        <View style={styles.body}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(name || user?.email || 'H').charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.label}>FULL NAME</Text>
          <View style={styles.inputWrap}><Ionicons name="person-outline" size={18} color={H.muted} /><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" placeholderTextColor={H.muted2} autoCapitalize="words" returnKeyType="done" blurOnSubmit onSubmitEditing={() => Keyboard.dismiss()} /></View>
          <Text style={[styles.label, { marginTop: 18 }]}>EMAIL</Text>
          <View style={[styles.inputWrap, styles.readonly]}><Ionicons name="mail-outline" size={18} color={H.muted2} /><Text style={styles.email}>{user?.email || 'No email available'}</Text><Ionicons name="lock-closed-outline" size={14} color={H.muted2} /></View>
          <Text style={styles.hint}>Email changes are handled through account security.</Text>
          <TouchableOpacity style={[styles.save, loading && { opacity: 0.55 }]} onPress={save} disabled={loading} activeOpacity={0.8}><Text style={styles.saveText}>{loading ? 'Saving…' : 'Save changes'}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},avatar:{width:74,height:74,borderRadius:26,backgroundColor:H.violetBg,alignSelf:'center',alignItems:'center',justifyContent:'center',marginBottom:28,borderWidth:1,borderColor:'#E3DCFF',...HearthDesign.shadow.card},avatarText:{fontSize:28,fontWeight:'900',color:H.purple},label:{fontSize:10.5,fontWeight:'900',letterSpacing:1.4,color:H.muted,marginBottom:8},inputWrap:{height:56,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:H.line,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,...HearthDesign.shadow.card},input:{flex:1,color:H.navy,fontSize:15,paddingVertical:0},readonly:{backgroundColor:'#F5F4F2'},email:{flex:1,color:H.muted,fontSize:13.5},hint:{color:H.muted2,fontSize:11.5,marginTop:8,lineHeight:17},save:{height:54,borderRadius:18,backgroundColor:H.navy,alignItems:'center',justifyContent:'center',marginTop:26},saveText:{color:'#fff',fontSize:14,fontWeight:'900'}
});
