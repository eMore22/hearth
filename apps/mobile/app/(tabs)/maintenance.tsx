import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useMaintenanceStore } from '../../src/stores/maintenanceStore';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MaintenanceScreen() {
  const {
    tasks,
    homeProfile,
    isLoading,
    generateCalendar,
    diagnoseProblem,
    getDIYInstructions,
    fetchTasks,
    completeTask,
  } = useMaintenanceStore();

  const [problemDesc, setProblemDesc] = useState('');
  const [diagnosis, setDiagnosis] = useState<any>(null);

  useEffect(() => {
    // Use a default profile if none exists
    if (!homeProfile) {
      const defaultProfile = {
        property_type: 'house',
        appliances: ['furnace', 'water heater'],
        climate: 'temperate',
      };
      generateCalendar(defaultProfile);
    } else {
      fetchTasks();
    }
  }, []);

  const handleDiagnose = async () => {
    if (!problemDesc.trim()) return;
    try {
      const result = await diagnoseProblem(problemDesc);
      setDiagnosis(result);
    } catch (err) {
      Alert.alert('Error', 'Could not diagnose');
    }
  };

  const handleDIY = async (taskName: string) => {
    try {
      const instructions = await getDIYInstructions(taskName);
      Alert.alert(taskName, instructions.steps?.join('\n') || 'No instructions available');
    } catch (err) {
      Alert.alert('Error', 'Could not fetch instructions');
    }
  };

  const upcomingTasks = tasks.filter(t => !t.completed).slice(0, 5);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-4">Home Maintenance</Text>

        {/* Upcoming tasks */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-2">Upcoming Tasks</Text>
          {upcomingTasks.length === 0 ? (
            <Text className="text-gray-500">No upcoming tasks.</Text>
          ) : (
            upcomingTasks.map((task) => (
              <View key={task.id || task.name} className="flex-row justify-between items-center border-b border-gray-200 py-2">
                <View className="flex-1">
                  <Text className="font-medium">{task.name}</Text>
                  <Text className="text-sm text-gray-500">Due: {task.due_date}</Text>
                </View>
                <View className="flex-row gap-2">
                  {task.diy_friendly && (
                    <TouchableOpacity
                      className="bg-blue-100 px-3 py-1 rounded"
                      onPress={() => handleDIY(task.name)}
                    >
                      <Text className="text-blue-700 text-sm">DIY</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    className="bg-green-100 px-3 py-1 rounded"
                    onPress={() => completeTask(task.id!)}
                  >
                    <Text className="text-green-700 text-sm">Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Diagnose problem */}
        <View className="bg-gray-50 p-4 rounded-xl mb-6">
          <Text className="font-semibold mb-2">🔧 Diagnose an issue</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-3 bg-white"
            placeholder="e.g., 'Fridge not cooling'"
            value={problemDesc}
            onChangeText={setProblemDesc}
            multiline
          />
          <TouchableOpacity
            className="bg-gray-800 p-3 rounded-lg"
            onPress={handleDiagnose}
          >
            <Text className="text-white text-center">Diagnose</Text>
          </TouchableOpacity>

          {diagnosis && (
            <View className="mt-4 p-3 bg-white rounded-lg">
              <Text className="font-semibold">Likely causes:</Text>
              {diagnosis.likely_causes?.map((cause: string, i: number) => (
                <Text key={i}>• {cause}</Text>
              ))}
              <Text className="font-semibold mt-2">Recommendation:</Text>
              <Text>{diagnosis.recommendation || 'Consult a professional'}</Text>
              <Text className="text-sm text-gray-500 mt-1">Est. cost: {diagnosis.estimated_cost_range}</Text>
            </View>
          )}
        </View>

        {isLoading && <Text>Loading...</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}