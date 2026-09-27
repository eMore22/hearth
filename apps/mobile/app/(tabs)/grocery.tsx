import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroceryStore } from '../../src/stores/groceryStore';
import { useHouseholdStore } from '../../src/stores/householdStore';
import { getCurrencySymbol } from '../../src/utils/currency';
import { H, HearthDesign } from '../../src/theme/hearthDesign';
import { EmptyMessage, IconBadge, ScreenHeader } from '../../src/components/ui/PremiumKit';

export default function GroceryScreen() {
  const insets = useSafeAreaInsets();
  const household = useHouseholdStore(s => s.household);
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold);
  const {
    mealPlan, shoppingList, inventory, budget, isLoading,
    generateMealPlan, createShoppingList, fetchInventory, addInventoryItem, fetchBudget,
  } = useGroceryStore();
  const [showAdd, setShowAdd] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (!household) fetchHousehold();
    fetchInventory(); fetchBudget();
  }, []);

  const currency = getCurrencySymbol(household?.currency);
  const planItems = shoppingList?.total_items || 0;

  const makePlan = async () => {
    try {
      await generateMealPlan();
    } catch (e: any) {
      Alert.alert('Could not generate plan', e?.message || 'Add preferences first or try again.');
    }
  };

  const makeList = async () => {
    if (!mealPlan) { Alert.alert('Meal plan needed', 'Generate a meal plan first.'); return; }
    try { await createShoppingList(mealPlan, inventory); } catch (e: any) { Alert.alert('Could not create list', e?.message || 'Please try again.'); }
  };

  const addItem = async () => {
    if (!itemName.trim()) return;
    await addInventoryItem({ name: itemName.trim(), quantity: quantity.trim() || undefined });
    setItemName(''); setQuantity(''); setShowAdd(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={H.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 36 }}>
        <ScreenHeader title="Grocery & Meals" subtitle="Plan, shop and stay stocked." />
        <View style={styles.body}>
          <View style={styles.planCard}>
            <IconBadge icon="basket-outline" bg={H.greenBg} color={H.green} size={50} />
            <View style={styles.flex}>
              <Text style={styles.planLabel}>CURRENT PLAN</Text>
              <Text style={styles.planTitle}>{shoppingList ? `${planItems} items ready` : mealPlan ? 'Meal plan ready' : 'Ready to plan'}</Text>
              <Text style={styles.planSub}>{budget ? `${currency}${Number(budget).toLocaleString()} weekly budget` : 'Set a budget anytime'}</Text>
            </View>
            <TouchableOpacity style={styles.viewButton} onPress={shoppingList ? undefined : makePlan} disabled={isLoading} activeOpacity={0.75}>
              <Text style={styles.viewButtonText}>{shoppingList ? 'Ready' : isLoading ? 'Working…' : 'Plan'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quick} onPress={() => setShowAdd(true)} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.greenBg }]}><Ionicons name="add" size={20} color={H.green} /></View><Text style={styles.quickText}>New item</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quick} onPress={makePlan} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.violetBg }]}><Ionicons name="sparkles-outline" size={20} color={H.violet} /></View><Text style={styles.quickText}>Meal plan</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quick} onPress={makeList} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.blueBg }]}><Ionicons name="list-outline" size={20} color={H.blue} /></View><Text style={styles.quickText}>Shopping list</Text></TouchableOpacity>
          </View>

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Pantry</Text><Text style={styles.sectionMeta}>{inventory.length} items</Text></View>
          {inventory.length === 0 ? <EmptyMessage icon="basket-outline" title="Your pantry is empty" subtitle="Add staples and Hearth can use them when planning meals." /> : inventory.map(item => (
            <View key={item.id} style={styles.row}>
              <View style={styles.dot} />
              <View style={styles.flex}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.quantity || 'Quantity not set'}{item.days_left != null ? ` · ${item.days_left} days left` : ''}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </View>
          ))}

          {mealPlan && (
            <View style={styles.mealPreview}>
              <View style={styles.mealTop}><View><Text style={styles.mealLabel}>MEAL PLAN</Text><Text style={styles.mealTitle}>This week</Text></View><Ionicons name="restaurant-outline" size={22} color={H.purple} /></View>
              <Text style={styles.mealSub}>{mealPlan.days?.length || 0} days planned · Estimated {currency}{Number(mealPlan.estimated_cost || 0).toLocaleString()}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAdd(false)} />
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 18) + 20 }]}>
            <Text style={styles.modalTitle}>Add pantry item</Text>
            <TextInput value={itemName} onChangeText={setItemName} placeholder="Item name" placeholderTextColor={H.muted2} style={styles.input} />
            <TextInput value={quantity} onChangeText={setQuantity} placeholder="Quantity (optional)" placeholderTextColor={H.muted2} style={styles.input} />
            <TouchableOpacity style={styles.save} onPress={addItem}><Text style={styles.saveText}>Add item</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: H.paper },
  body: { paddingHorizontal: 18 },
  flex: { flex: 1, minWidth: 0 },
  planCard: { backgroundColor: '#F1FBF4', borderWidth: 1, borderColor: '#DDEFE3', borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, ...HearthDesign.shadow.card },
  planLabel: { color: H.green, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  planTitle: { color: H.navy, fontSize: 15, fontWeight: '800', marginTop: 3 },
  planSub: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  viewButton: { backgroundColor: '#DFF3E6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  viewButtonText: { color: H.green, fontSize: 11.5, fontWeight: '800' },
  sectionTitle: { color: H.navy, fontSize: 20, fontWeight: '800', marginTop: 25, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', gap: 9 },
  quick: { flex: 1, minHeight: 92, borderRadius: 19, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 12, justifyContent: 'center', ...HearthDesign.shadow.card },
  quickIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  quickText: { color: H.navy, fontSize: 11.5, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionMeta: { color: H.muted, fontSize: 12 },
  row: { minHeight: 66, borderRadius: 18, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: H.muted2 },
  rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' },
  rowMeta: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  mealPreview: { marginTop: 18, borderRadius: 21, backgroundColor: '#F7F4FF', borderWidth: 1, borderColor: '#E7E0FF', padding: 16 },
  mealTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealLabel: { color: H.purple, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  mealTitle: { color: H.navy, fontSize: 16, fontWeight: '800', marginTop: 3 },
  mealSub: { color: H.muted, fontSize: 12, marginTop: 10 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', justifyContent: 'flex-end', paddingHorizontal: 14 },
  modalCard: { borderRadius: 28, backgroundColor: H.paper, padding: 20 },
  modalTitle: { color: H.navy, fontSize: 23, fontWeight: '800', marginBottom: 16 },
  input: { height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, paddingHorizontal: 14, color: H.navy, fontSize: 15, marginBottom: 10 },
  save: { height: 52, borderRadius: 17, backgroundColor: H.green, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
