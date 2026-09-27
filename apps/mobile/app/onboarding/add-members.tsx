import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { H, HearthDesign } from '../../src/theme/hearthDesign'

interface Member { name: string; email?: string; relationship?: string }

export default function AddMembersScreen() {
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const addMember = () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a name.'); return }
    setMembers([...members, { name: name.trim(), email: email.trim() || undefined, relationship: relationship.trim() || undefined }])
    setName(''); setEmail(''); setRelationship('')
  }

  const handleContinue = async () => {
    setIsLoading(true)
    try { router.push('/onboarding/permissions') } finally { setIsLoading(false) }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <View style={styles.topRow}>
              <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={21} color={H.navy} /></TouchableOpacity>
              <View style={styles.progress}><View style={[styles.progressFill, { width: '88%' }]} /></View>
              <Text style={styles.step}>Almost done</Text>
            </View>

            <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
            <Text style={styles.title}>Who shares this household?</Text>
            <Text style={styles.subtitle}>Add family or housemates now, or skip and invite them later.</Text>

            <View style={styles.formCard}>
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={H.muted2} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Email (optional)" placeholderTextColor={H.muted2} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Relationship, e.g. Partner" placeholderTextColor={H.muted2} value={relationship} onChangeText={setRelationship} />
              <TouchableOpacity style={styles.addButton} onPress={addMember}><Ionicons name="person-add-outline" size={18} color={H.purple} /><Text style={styles.addButtonText}>Add member</Text></TouchableOpacity>
            </View>

            {members.length > 0 ? (
              <View style={styles.listWrap}>
                <Text style={styles.listTitle}>Added members</Text>
                <FlatList
                  data={members}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={({ item, index }) => (
                    <View style={styles.memberItem}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
                      <View style={{ flex: 1 }}><Text style={styles.memberName}>{item.name}</Text><Text style={styles.memberDetail}>{item.relationship || item.email || 'Household member'}</Text></View>
                      <TouchableOpacity onPress={() => setMembers(members.filter((_, i) => i !== index))}><Ionicons name="close-circle-outline" size={22} color={H.muted} /></TouchableOpacity>
                    </View>
                  )}
                />
              </View>
            ) : (
              <View style={styles.emptyHint}><Ionicons name="people-outline" size={20} color={H.muted} /><Text style={styles.emptyText}>No one added yet. That is completely fine.</Text></View>
            )}

            <View style={styles.footer}>
              <TouchableOpacity style={[styles.continueButton, isLoading && { opacity: 0.6 }]} onPress={handleContinue} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.continueText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/onboarding/permissions')}><Text style={styles.skipText}>Skip for now</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: H.paper }, safeArea: { flex: 1 }, content: { flex: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: H.white, borderWidth: 1, borderColor: H.line, alignItems: 'center', justifyContent: 'center' }, progress: { flex: 1, height: 7, backgroundColor: '#ECEAF0', borderRadius: 99, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: H.purple, borderRadius: 99 }, step: { color: H.muted, fontSize: 11.5, fontWeight: '700' },
  eyebrow: { color: H.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 9 }, title: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: H.navy, letterSpacing: -0.8 }, subtitle: { fontSize: 14.5, color: H.muted, lineHeight: 21, marginTop: 9, marginBottom: 22 },
  formCard: { backgroundColor: H.white, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: H.lineSoft, ...HearthDesign.shadow.card }, input: { minHeight: 51, backgroundColor: '#F8F7FA', borderRadius: 15, paddingHorizontal: 14, color: H.navy, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: H.line },
  addButton: { minHeight: 48, borderRadius: 15, backgroundColor: H.violetBg, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, addButtonText: { color: H.purple, fontWeight: '800', fontSize: 14 },
  listWrap: { marginTop: 20, flex: 1 }, listTitle: { color: H.navy, fontSize: 17, fontWeight: '800', marginBottom: 10 }, memberItem: { minHeight: 68, backgroundColor: H.white, borderRadius: 18, borderWidth: 1, borderColor: H.lineSoft, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: H.purple, fontSize: 16, fontWeight: '800' }, memberName: { color: H.navy, fontSize: 14.5, fontWeight: '800' }, memberDetail: { color: H.muted, fontSize: 12, marginTop: 3 },
  emptyHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, paddingHorizontal: 4 }, emptyText: { color: H.muted, fontSize: 12.5 },
  footer: { marginTop: 'auto', paddingTop: 16 }, continueButton: { minHeight: 56, borderRadius: 18, backgroundColor: H.purple, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, continueText: { color: '#fff', fontSize: 16, fontWeight: '800' }, skipText: { color: H.muted, textAlign: 'center', fontSize: 13.5, fontWeight: '700', marginTop: 14 },
})
