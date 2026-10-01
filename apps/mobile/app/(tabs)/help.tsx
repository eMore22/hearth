import React from 'react';
import { Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { ScreenHeader } from '../../src/components/ui/PremiumKit';

export default function HelpScreen(){
  const insets=useSafeAreaInsets();
  const open=async(url:string)=>{try{await Linking.openURL(url);}catch{Alert.alert('Could not open link','Please try again later.');}};
  return <View style={styles.root}><StatusBar barStyle="dark-content" backgroundColor={H.paper}/><ScrollView contentContainerStyle={{paddingTop:Math.max(insets.top,12),paddingBottom:40}}><ScreenHeader title="Help & support" subtitle="Get help with Hearth HQ or contact the team."/><View style={styles.body}>
    <View style={styles.hero}><View style={styles.icon}><Ionicons name="help-buoy-outline" size={28} color={H.purple}/></View><Text style={styles.heroTitle}>How can we help?</Text><Text style={styles.heroSub}>For account, integration or household questions, contact Hearth HQ support.</Text></View>
    <TouchableOpacity style={styles.row} onPress={()=>open('mailto:support@hearthhq.online?subject=Hearth HQ%20Support')}><View style={[styles.rowIcon,{backgroundColor:H.blueBg}]}><Ionicons name="mail-outline" size={20} color={H.blue}/></View><View style={styles.flex}><Text style={styles.title}>Email support</Text><Text style={styles.sub}>support@hearthhq.online</Text></View><Ionicons name="chevron-forward" size={18} color={H.muted2}/></TouchableOpacity>
    <TouchableOpacity style={styles.row} onPress={()=>open('https://hearthhq.online')}><View style={[styles.rowIcon,{backgroundColor:H.violetBg}]}><Ionicons name="globe-outline" size={20} color={H.purple}/></View><View style={styles.flex}><Text style={styles.title}>Hearth HQ website</Text><Text style={styles.sub}>Product information and updates</Text></View><Ionicons name="chevron-forward" size={18} color={H.muted2}/></TouchableOpacity>
    <View style={styles.note}><Ionicons name="information-circle-outline" size={18} color={H.amber}/><Text style={styles.noteText}>If a smart-home connection fails, include your Home Assistant connection status and any error shown in Integrations. Never email your access token.</Text></View>
  </View></ScrollView></View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:H.paper},body:{paddingHorizontal:18},hero:{borderRadius:24,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,padding:22,alignItems:'center',marginBottom:18,...HearthDesign.shadow.card},icon:{width:60,height:60,borderRadius:20,backgroundColor:H.violetBg,alignItems:'center',justifyContent:'center'},heroTitle:{color:H.navy,fontSize:18,fontWeight:'900',marginTop:12},heroSub:{color:H.muted,fontSize:12.2,lineHeight:18,textAlign:'center',marginTop:5},row:{minHeight:78,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:H.lineSoft,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:13,marginBottom:9,...HearthDesign.shadow.card},rowIcon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},flex:{flex:1,minWidth:0},title:{color:H.navy,fontSize:13.8,fontWeight:'900'},sub:{color:H.muted,fontSize:10.8,marginTop:2},note:{marginTop:10,borderRadius:18,backgroundColor:H.amberBg,padding:13,flexDirection:'row',gap:9,alignItems:'flex-start'},noteText:{flex:1,color:H.muted,fontSize:11.2,lineHeight:17}});
