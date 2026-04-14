import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useHealthStore } from '../../src/stores/healthStore';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HealthScreen() {
  const { triageHistory, isLoading, triageSymptoms } = useHealthStore();
  const [symptoms, setSymptoms] = useState('');
  const [lastTriage, setLastTriage] = useState<any>(null);

  const handleTriage = async () => {
    if (!symptoms.trim()) return;
    try {
      const result = await triageSymptoms(symptoms);
      setLastTriage(result);
      setSymptoms('');
    } catch (err) {
      Alert.alert('Error', 'Could not complete triage');
    }
  };

  const getTriageColor = (level: string) => {
    switch (level) {
      case 'emergency': return 'bg-red-600';
      case 'urgent_care': return 'bg-orange-500';
      case 'gp_visit': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-4">Health Triage</Text>

        {/* Disclaimer */}
        <View className="bg-blue-50 p-3 rounded-lg mb-4">
          <Text className="text-blue-800 text-sm">
            ⚠️ Hearth Health Triage is for informational purposes only. Always consult a qualified healthcare professional.
          </Text>
        </View>

        {/* Symptom input */}
        <View className="mb-6">
          <Text className="font-semibold mb-2">Describe symptoms:</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-3"
            placeholder="e.g., '6-year-old with fever 101°F for 2 days'"
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
          />
          <TouchableOpacity
            className="bg-indigo-600 p-4 rounded-xl"
            onPress={handleTriage}
            disabled={isLoading}
          >
            <Text className="text-white text-center font-semibold">
              {isLoading ? 'Analyzing...' : 'Get Triage Recommendation'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Latest triage result */}
        {lastTriage && (
          <View className={`p-4 rounded-xl mb-6 ${getTriageColor(lastTriage.triage_level)}`}>
            <Text className="text-white text-lg font-bold mb-2">
              {lastTriage.triage_level.replace('_', ' ').toUpperCase()}
            </Text>
            <Text className="text-white mb-2">{lastTriage.recommendation}</Text>
            {lastTriage.home_care_tips && (
              <View className="mt-2">
                <Text className="text-white font-semibold">Home care tips:</Text>
                {lastTriage.home_care_tips.map((tip: string, i: number) => (
                  <Text key={i} className="text-white">• {tip}</Text>
                ))}
              </View>
            )}
            <Text className="text-white text-xs mt-3 italic">{lastTriage.disclaimer}</Text>
          </View>
        )}

        {/* Recent triage history */}
        {triageHistory.length > 0 && (
          <View>
            <Text className="text-lg font-semibold mb-2">Recent checks</Text>
            {triageHistory.slice(0, 3).map((item, i) => (
              <View key={i} className="border border-gray-200 rounded-lg p-3 mb-2">
                <Text className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</Text>
                <Text numberOfLines={2}>{item.symptoms}</Text>
                <Text className={`font-medium ${
                  item.result.triage_level === 'emergency' ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {item.result.triage_level.replace('_', ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}