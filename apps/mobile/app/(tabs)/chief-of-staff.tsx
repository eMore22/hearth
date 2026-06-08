import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, StyleSheet, StatusBar, Animated } from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { useChiefOfStaffStore } from '../../src/stores/chiefOfStaffStore'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#4FC3F7'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const USER_BUBBLE = '#1A3A5C'
const AI_BUBBLE = '#162035'

const QUICK_PROMPTS = [
  'What needs attention today?',
  'Check my document expiries',
  'How are my finances this month?',
  'Generate a meal plan',
]

export default function ChiefOfStaffScreen() {
  const router = useRouter()
  const { messages, isTyping, sendMessage, clearMessages } = useChiefOfStaffStore()
  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList>(null)
  const typingDot = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isTyping) {
      Animated.loop(Animated.sequence([
        Animated.timing(typingDot, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(typingDot, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])).start()
    } else {
      typingDot.stopAnimation()
    }
  }, [isTyping])

  const handleSend = async (text?: string) => {
    const msg = text || inputText
    if (!msg.trim() || isTyping) return
    setInputText('')
    await sendMessage(msg)
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const renderMessage = ({ item }: { item: any }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
        {!isUser && <View style={styles.aiAvatar}><Text style={styles.aiAvatarText}>✦</Text></View>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>{item.content}</Text>
          {item.proactive_suggestions?.length > 0 && (
            <View style={styles.suggestionsBox}>
              {item.proactive_suggestions.map((s: string, i: number) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => handleSend(s)}>
                  <Text style={styles.suggestionText}>→ {s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={WHITE} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Chief of Staff</Text>
              <View style={styles.headerStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
            <TouchableOpacity onPress={clearMessages} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={MUTED} />
            </TouchableOpacity>
          </LinearGradient>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View>
                <Text style={styles.emptyTitle}>Your household's AI</Text>
                <Text style={styles.emptySubtitle}>Ask me anything about your documents, bills, groceries, maintenance, or family health.</Text>
                <View style={styles.quickPromptsGrid}>
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <TouchableOpacity key={i} style={styles.quickPromptChip} onPress={() => handleSend(prompt)}>
                      <Text style={styles.quickPromptText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
          />

          {isTyping && (
            <View style={styles.typingRow}>
              <View style={styles.aiAvatar}><Text style={styles.aiAvatarText}>✦</Text></View>
              <View style={styles.typingBubble}>
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask me anything..."
                placeholderTextColor={MUTED}
                value={inputText}
                onChangeText={setInputText}
                editable={!isTyping}
                multiline
                maxLength={500}
              />
              <TouchableOpacity style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]} onPress={() => handleSend()} disabled={!inputText.trim() || isTyping}>
                <Ionicons name="arrow-up" size={18} color={WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backBtn: { padding: 6, marginRight: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: WHITE },
  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#06D6A0' },
  statusText: { fontSize: 11, color: '#06D6A0' },
  clearBtn: { padding: 6 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageRow: { marginBottom: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAI: { justifyContent: 'flex-start' },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(79,195,247,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(79,195,247,0.3)' },
  aiAvatarText: { fontSize: 14, color: ACCENT },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 14 },
  bubbleUser: { backgroundColor: USER_BUBBLE, borderBottomRightRadius: 4, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)' },
  bubbleAI: { backgroundColor: AI_BUBBLE, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: WHITE },
  bubbleTextAI: { color: '#D0E8F5' },
  messageTime: { fontSize: 10, color: MUTED, marginTop: 6, textAlign: 'right' },
  suggestionsBox: { marginTop: 10, gap: 6 },
  suggestionChip: { backgroundColor: 'rgba(79,195,247,0.08)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)' },
  suggestionText: { fontSize: 12, color: ACCENT },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  typingBubble: { flexDirection: 'row', backgroundColor: AI_BUBBLE, borderRadius: 16, padding: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MUTED },
  inputContainer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: NAVY },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, backgroundColor: SURFACE, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, fontSize: 14, color: WHITE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(79,195,247,0.2)' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(79,195,247,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)' },
  emptyIconText: { fontSize: 24, color: ACCENT },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: WHITE, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  quickPromptsGrid: { width: '100%', gap: 8 },
  quickPromptChip: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  quickPromptText: { fontSize: 13, color: '#B8D4E8' },
})