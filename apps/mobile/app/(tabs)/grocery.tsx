import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useGroceryStore } from '../../src/stores/groceryStore';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroceryScreen() {
  const {
    mealPlan,
    shoppingList,
    inventory,
    wasteAlerts,
    isLoading,
    generateMealPlan,
    createShoppingList,
    fetchWasteAlerts,
    fetchInventory,
  } = useGroceryStore();

  const [preferences] = useState({
    household_size: 2,
    dietary_restrictions: [],
    weekly_budget: 150,
    cuisine_preferences: ['Italian', 'Mexican'],
  });

  useEffect(() => {
    fetchInventory();
    // Auto-generate meal plan if none exists
    if (!mealPlan) {
      generateMealPlan(preferences);
    }
  }, []);

  useEffect(() => {
    if (inventory.length > 0) {
      fetchWasteAlerts();
    }
  }, [inventory]);

  const handleGeneratePlan = () => {
    generateMealPlan(preferences);
  };

  const handleCreateList = () => {
    if (mealPlan) {
      createShoppingList(mealPlan);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold mb-4">Meal Planner</Text>

        {/* Waste alerts */}
        {wasteAlerts.length > 0 && (
          <View className="bg-red-50 p-4 rounded-xl mb-6">
            <Text className="font-semibold mb-2">⚠️ Use soon:</Text>
            {wasteAlerts.slice(0, 2).map((alert, i) => (
              <View key={i} className="mb-2">
                <Text>{alert.item} - {alert.days_left} days left</Text>
                <Text className="text-sm text-gray-600">
                  Suggestion: {alert.suggested_recipe.recipe_name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          className="bg-green-600 p-4 rounded-xl mb-6"
          onPress={handleGeneratePlan}
        >
          <Text className="text-white text-center font-semibold">🔄 Generate New Meal Plan</Text>
        </TouchableOpacity>

        {/* Meal plan */}
        {mealPlan && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">
              Week of {new Date(mealPlan.week_of).toLocaleDateString()}
            </Text>
            {mealPlan.days.slice(0, 3).map((day) => (
              <View key={day.day} className="border border-gray-200 rounded-lg p-3 mb-2">
                <Text className="font-medium">{day.day}</Text>
                <Text className="text-sm">🍳 {day.breakfast.name}</Text>
                <Text className="text-sm">🥪 {day.lunch.name}</Text>
                <Text className="text-sm">🍽️ {day.dinner.name}</Text>
              </View>
            ))}
            <TouchableOpacity
              className="bg-gray-200 p-3 rounded-lg mt-2"
              onPress={handleCreateList}
            >
              <Text className="text-center">📋 Generate Shopping List</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Shopping list preview */}
        {shoppingList && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">Shopping List</Text>
            {Object.entries(shoppingList.categories).map(([cat, items]) => (
              items.length > 0 && (
                <View key={cat} className="mb-2">
                  <Text className="font-medium capitalize">{cat}</Text>
                  <Text className="text-gray-600">{items.join(', ')}</Text>
                </View>
              )
            ))}
            <Text className="mt-2">Total items: {shoppingList.total_items}</Text>
            <Text>Est. cost: ${shoppingList.estimated_cost}</Text>
          </View>
        )}

        {isLoading && <Text>Loading...</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}