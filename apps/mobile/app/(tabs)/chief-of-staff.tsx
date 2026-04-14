import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { useChiefOfStaffStore } from '../src/stores/chiefOfStaffStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function ChiefOfStaffScreen() {
  const router = useRouter();
  const { messages, isTyping, sendMessage } = useChiefOfStaffStore();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;
    const message = inputText;
    setInputText('');
    await sendMessage(message);
    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View className={`mb-4 ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
      <View className={`max-w-[80%] p-4 rounded-2xl ${
        item.role === 'user' ? 'bg-indigo-600' : 'bg-gray-100'
      }`}>
        <Text className={item.role === 'user' ? 'text-white' : 'text-gray-800'}>
          {item.content}
        </Text>
        {item.proactive_suggestions && item.proactive_suggestions.length > 0 && (
          <View className="mt-3 pt-3 border-t border-gray-300">
            {item.proactive_suggestions.map((suggestion: string, i: number) => (
              <TouchableOpacity
                key={i}
                className="py-2"
                onPress={() => setInputText(suggestion)}
              >
                <Text className="text-indigo-600">💡 {suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
          <Text className="text-xl font-bold">Hearth Chief of Staff</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-indigo-600">Close</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Text className="text-5xl mb-4">🏠</Text>
              <Text className="text-lg font-semibold mb-2">Hello! I'm Hearth</Text>
              <Text className="text-gray-500 text-center">
                Ask me anything about your household—documents, bills, groceries, maintenance, or health.
              </Text>
            </View>
          }
        />

        <View className="p-4 border-t border-gray-200 flex-row items-center">
          <TextInput
            className="flex-1 border border-gray-300 rounded-full px-4 py-3 mr-2 bg-gray-50"
            placeholder={isTyping ? "Thinking..." : "Ask me anything..."}
            value={inputText}
            onChangeText={setInputText}
            editable={!isTyping}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            className={`rounded-full w-12 h-12 items-center justify-center ${
              isTyping || !inputText.trim() ? 'bg-gray-300' : 'bg-indigo-600'
            }`}
            onPress={handleSend}
            disabled={isTyping || !inputText.trim()}
          >
            <Text className="text-white text-xl">➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}