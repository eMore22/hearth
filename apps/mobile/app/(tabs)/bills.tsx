import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useBillStore } from '../../src/stores/billStore';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BillsScreen() {
  const {
    bills,
    monthlyReport,
    unusedSubscriptions,
    isLoading,
    error,
    fetchBills,
    fetchMonthlyReport,
    detectUnused,
    generateNegotiationScript,
  } = useBillStore();

  const [showUnused, setShowUnused] = useState(false);

  useEffect(() => {
    fetchBills();
    fetchMonthlyReport();
  }, []);

  const handleDetectUnused = async () => {
    await detectUnused();
    setShowUnused(true);
  };

  const handleNegotiation = async (provider: string, plan: string) => {
    try {
      const script = await generateNegotiationScript(provider, plan);
      Alert.alert('Negotiation Script', script.script);
    } catch (err) {
      Alert.alert('Error', 'Could not generate script');
    }
  };

  if (isLoading && bills.length === 0) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center">
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-4">Bills & Subscriptions</Text>

        {/* Monthly summary */}
        {monthlyReport && (
          <View className="bg-blue-50 p-4 rounded-xl mb-6">
            <Text className="text-lg font-semibold">{monthlyReport.month} Summary</Text>
            <Text className="text-3xl font-bold mt-2">${monthlyReport.total_spent.toFixed(2)}</Text>
            <Text className="text-gray-600">{monthlyReport.summary}</Text>
          </View>
        )}

        {/* Detect unused button */}
        <TouchableOpacity
          className="bg-indigo-600 p-4 rounded-xl mb-6"
          onPress={handleDetectUnused}
        >
          <Text className="text-white text-center font-semibold">🔍 Find Unused Subscriptions</Text>
        </TouchableOpacity>

        {/* Unused subscriptions alert */}
        {showUnused && unusedSubscriptions.length > 0 && (
          <View className="bg-amber-50 p-4 rounded-xl mb-6">
            <Text className="font-semibold mb-2">Potential savings:</Text>
            {unusedSubscriptions.map((sub, i) => (
              <View key={i} className="mb-3">
                <Text className="font-medium">{sub.provider}</Text>
                <Text className="text-gray-600">{sub.reason}</Text>
                <Text className="text-green-600">Save ${sub.monthly_savings}/month</Text>
                <TouchableOpacity
                  className="mt-2 bg-amber-200 p-2 rounded"
                  onPress={() => handleNegotiation(sub.provider, 'current plan')}
                >
                  <Text className="text-center">Get Negotiation Script</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Bills list */}
        <Text className="text-lg font-semibold mb-2">Your Bills</Text>
        {bills.length === 0 ? (
          <Text className="text-gray-500">No bills added yet.</Text>
        ) : (
          bills.map((bill) => (
            <View key={bill.id} className="border border-gray-200 rounded-lg p-4 mb-2">
              <View className="flex-row justify-between">
                <Text className="font-semibold">{bill.provider}</Text>
                <Text className="font-bold">${bill.amount}</Text>
              </View>
              <Text className="text-gray-500">{bill.category} · {bill.billing_cycle}</Text>
            </View>
          ))
        )}

        {error && <Text className="text-red-500 mt-4">{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}