import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import ChiefOfStaffButton from '../../src/components/ui/ChiefOfStaffButton'
import { COLORS } from '../../src/utils/theme'

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.muted,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            backgroundColor: COLORS.surface,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="documents"
          options={{
            title: 'Documents',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: 'Bills',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="card-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="grocery"
          options={{
            title: 'Grocery',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="basket-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="maintenance"
          options={{
            title: 'Maintenance',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="construct-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="health"
          options={{
            title: 'Health',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="heart-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <ChiefOfStaffButton />
    </View>
  )
}