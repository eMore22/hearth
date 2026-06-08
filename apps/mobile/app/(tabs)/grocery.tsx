import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, RefreshControl } from 'react-native'
import { useEffect, useState } from 'react'
import { useGroceryStore } from '../../src/stores/groceryStore'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#06D6A0'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const WARNING = '#FF9F1C'

const DEFAULT_PREFS = { household_size: 2, dietary_restrictions: [], weekly_budget: 150, cuisine_preferences: ['Italian', 'Mexican'] }

export default function GroceryScreen() {
  const { mealPlan, shoppingList, inventory, wasteAlerts, isLoading, generateMealPlan, createShoppingList, fetchWasteAlerts, fetchInventory } = useGroceryStore()
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    fetchInventory()
    if (!mealPlan) generateMealPlan(DEFAULT_PREFS)
  }, [])

  useEffect(() => { if (inventory.length > 0) fetchWasteAlerts() }, [inventory])

  const handleCreateList = () => {
    if (mealPlan) { createShoppingList(mealPlan); setShowList(true) }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <Text style={styles.headerLabel}>NUTRITION</Text>
        <Text style={styles.headerTitle}>Meal Planner</Text>
        {mealPlan && (
          <View style={styles.summaryPill}>
            <Ionicons name="calendar-outline" size={14} color={ACCENT} />
            <Text style={styles.summaryText}>Week of {new Date(mealPlan.week_of || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => generateMealPlan(DEFAULT_PREFS)} tintColor={ACCENT} />}>

        {wasteAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Use Soon</Text>
            {wasteAlerts.slice(0, 2).map((alert: any, i: number) => (
              <View key={i} style={styles.wasteCard}>
                <Ionicons name="warning-outline" size={16} color={WARNING} />
                <View style={styles.wasteInfo}>
                  <Text style={styles.wasteItem}>{alert.item}</Text>
                  <Text style={styles.wasteSuggestion}>{alert.suggested_recipe?.recipe_name}</Text>
                </View>
                <Text style={styles.wasteDays}>{alert.days_left}d</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity style={styles.generateBtn} onPress={() => generateMealPlan(DEFAULT_PREFS)} disabled={isLoading}>
            <Ionicons name="refresh-outline" size={18} color={ACCENT} />
            <Text style={styles.generateBtnText}>{isLoading ? 'Generating...' : 'Generate New Meal Plan'}</Text>
          </TouchableOpacity>
        </View>

        {mealPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This Week</Text>
            {(mealPlan.days || []).map((day: any, i: number) => (
              <View key={i} style={styles.dayCard}>
                <Text style={styles.dayName}>{day.day || `Day ${i + 1}`}</Text>
                <View style={styles.mealsCol}>
                  {day.breakfast && <Text style={styles.mealRow}>☀️ {day.breakfast.name}</Text>}
                  {day.lunch && <Text style={styles.mealRow}>🥪 {day.lunch.name}</Text>}
                  {day.dinner && <Text style={styles.mealRow}>🍽️ {day.dinner.name}</Text>}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.listBtn} onPress={handleCreateList}>
              <Ionicons name="list-outline" size={18} color={NAVY} />
              <Text style={styles.listBtnText}>Generate Shopping List</Text>
            </TouchableOpacity>
          </View>
        )}

        {shoppingList && showList && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shopping List</Text>
            <View style={styles.listCard}>
              {Object.entries(shoppingList.categories || {}).map(([cat, items]: [string, any]) =>
                Array.isArray(items) && items.length > 0 && (
                  <View key={cat} style={styles.listCategory}>
                    <Text style={styles.listCategoryName}>{cat}</Text>
                    <Text style={styles.listItems}>{items.join(', ')}</Text>
                  </View>
                )
              )}
              <View style={styles.listFooter}>
                <Text style={styles.listTotal}>Total: {shoppingList.total_items} items</Text>
                <Text style={styles.listCost}>Est. ${shoppingList.estimated_cost}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerLabel: { fontSize: 11, color: MUTED, letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: WHITE, marginBottom: 12 },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(6,214,160,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  summaryText: { fontSize: 12, color: ACCENT },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  wasteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,159,28,0.08)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,159,28,0.2)', gap: 10 },
  wasteInfo: { flex: 1 },
  wasteItem: { fontSize: 14, fontWeight: '600', color: WHITE },
  wasteSuggestion: { fontSize: 12, color: MUTED },
  wasteDays: { fontSize: 13, fontWeight: '700', color: WARNING },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(6,214,160,0.1)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(6,214,160,0.25)' },
  generateBtnText: { color: ACCENT, fontWeight: '600', fontSize: 15 },
  dayCard: { backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dayName: { fontSize: 13, fontWeight: '700', color: WHITE, marginBottom: 8 },
  mealsCol: { gap: 4 },
  mealRow: { fontSize: 13, color: '#B8D4E8' },
  listBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 14, padding: 14, marginTop: 8 },
  listBtnText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  listCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  listCategory: { marginBottom: 12 },
  listCategoryName: { fontSize: 12, fontWeight: '600', color: ACCENT, textTransform: 'capitalize', marginBottom: 4 },
  listItems: { fontSize: 13, color: '#B8D4E8', lineHeight: 19 },
  listFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  listTotal: { fontSize: 13, color: MUTED },
  listCost: { fontSize: 14, fontWeight: '700', color: WHITE },
})