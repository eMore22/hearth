import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChiefOfStaffStore } from '../../src/stores/chiefOfStaffStore';
import { H, HearthDesign } from '../../src/theme/hearthDesign';

const starters = [
  'What needs my attention?',
  'Which bills are due soon?',
  'Am I covered for the kitchen leak?',
  'Plan meals for this week',
];

export default function ChiefScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { messages, isTyping, fetchHistory, sendMessage, clearMessages } = useChiefOfStaffStore();
  const [text, setText] = useState('');

  useEffect(() => { fetchHistory(); }, []);
  useEffect(() => { const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60); return () => clearTimeout(t); }, [messages.length, isTyping]);

  const send = async (value = text) => {
    const message = value.trim();
    if (!message || isTyping) return;
    setText('');
    try { await sendMessage(message); }
    catch (e: any) { Alert.alert('Hearth could not reply', e?.message || 'Please try again.'); }
  };

  const clear = () => Alert.alert('Clear conversation?', 'This removes the current Chief of Staff history for this household.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => clearMessages() },
  ]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.brandWrap}>
          <LinearGradient colors={['#7360FF', '#5B39F0']} style={styles.brandIcon}><Ionicons name="sparkles" size={20} color="#fff" /></LinearGradient>
          <View><Text style={styles.brandTitle}>Chief of Staff</Text><Text style={styles.brandSub}>Hearth household AI</Text></View>
        </View>
        <TouchableOpacity onPress={clear} style={styles.clearButton}><Ionicons name="trash-outline" size={18} color={H.muted} /></TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? (
          <View style={styles.hero}>
            <LinearGradient colors={['#EEE9FF', '#E6F0FF']} style={styles.orb}><Ionicons name="sparkles" size={32} color={H.purple} /></LinearGradient>
            <Text style={styles.hello}>What can Hearth handle for you?</Text>
            <Text style={styles.sub}>Ask about bills, documents, meals, home alerts, household tasks or connected devices.</Text>
            <View style={styles.starters}>
              {starters.map(item => (
                <TouchableOpacity key={item} style={styles.starter} onPress={() => send(item)} activeOpacity={0.75}>
                  <Text style={styles.starterText}>{item}</Text>
                  <Ionicons name="arrow-forward" size={14} color={H.muted2} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.thread}>
            {messages.map(msg => (
              <View key={msg.id} style={[styles.messageWrap, msg.role === 'user' ? styles.userWrap : styles.assistantWrap]}>
                {msg.role !== 'user' && <View style={styles.assistantAvatar}><Ionicons name="sparkles" size={14} color={H.purple} /></View>}
                <View style={[styles.message, msg.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
                  <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.assistantText]}>{msg.content}</Text>
                </View>
                {!!msg.proactive_suggestions?.length && (
                  <View style={styles.suggestionList}>
                    {msg.proactive_suggestions.slice(0, 3).map(s => <TouchableOpacity key={s} onPress={() => send(s)} style={styles.suggestion}><Text style={styles.suggestionText}>{s}</Text></TouchableOpacity>)}
                  </View>
                )}
              </View>
            ))}
            {isTyping && <View style={styles.typingRow}><View style={styles.assistantAvatar}><Ionicons name="sparkles" size={14} color={H.purple} /></View><View style={[styles.message, styles.assistantMessage]}><Text style={styles.typing}>Hearth is thinking…</Text></View></View>}
          </View>
        )}
      </ScrollView>

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 8) + 3 }]}>
        <View style={styles.composer}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={() => send()} placeholder="Ask about your household..." placeholderTextColor={H.muted2} style={styles.input} multiline returnKeyType="send" blurOnSubmit />
          <TouchableOpacity style={[styles.send, (!text.trim() || isTyping) && styles.sendDisabled]} onPress={() => send()} disabled={!text.trim() || isTyping} activeOpacity={0.8}><Ionicons name="arrow-up" size={20} color="#fff" /></TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  header: { minHeight: 76, paddingHorizontal: 18, paddingBottom: 12, backgroundColor: H.paper, borderBottomWidth: 1, borderBottomColor: H.lineSoft, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, brandTitle: { color: H.navy, fontSize: 16, fontWeight: '900' }, brandSub: { color: H.muted, fontSize: 10.5, marginTop: 2 }, clearButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F1F0', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 20 },
  hero: { flex: 1, minHeight: 560, alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }, orb: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 22, ...HearthDesign.shadow.floating }, hello: { color: H.navy, fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4 }, sub: { color: H.muted, fontSize: 12.5, lineHeight: 19, textAlign: 'center', maxWidth: 300, marginTop: 8 }, starters: { width: '100%', marginTop: 24, gap: 8 }, starter: { minHeight: 48, borderRadius: 17, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, ...HearthDesign.shadow.card }, starterText: { color: H.navy, fontSize: 12.5, fontWeight: '700' },
  thread: { paddingTop: 16 }, messageWrap: { marginBottom: 14 }, userWrap: { alignItems: 'flex-end' }, assistantWrap: { alignItems: 'flex-start' }, assistantAvatar: { width: 28, height: 28, borderRadius: 10, backgroundColor: H.violetBg, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }, message: { maxWidth: '88%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11 }, userMessage: { backgroundColor: H.purple, borderBottomRightRadius: 7 }, assistantMessage: { backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, borderBottomLeftRadius: 7, ...HearthDesign.shadow.card }, messageText: { fontSize: 13.5, lineHeight: 20 }, userText: { color: '#fff' }, assistantText: { color: H.navy }, typingRow: { alignItems: 'flex-start' }, typing: { color: H.muted, fontSize: 12.5 },
  suggestionList: { marginTop: 7, gap: 6, alignItems: 'flex-start' }, suggestion: { borderRadius: 999, borderWidth: 1, borderColor: '#E3DEFF', backgroundColor: H.violetBg, paddingHorizontal: 12, paddingVertical: 7 }, suggestionText: { color: H.purple, fontSize: 11, fontWeight: '700' },
  composerWrap: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: H.paper, borderTopWidth: 1, borderTopColor: H.lineSoft }, composer: { minHeight: 57, borderRadius: 28, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 17, paddingRight: 6, paddingVertical: 5, ...HearthDesign.shadow.card }, input: { flex: 1, maxHeight: 110, minHeight: 43, color: H.navy, fontSize: 14, paddingTop: 11, paddingBottom: 8 }, send: { width: 44, height: 44, borderRadius: 22, backgroundColor: H.purple, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: 0.38 },
});
