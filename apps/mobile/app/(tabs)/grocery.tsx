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
    mealPlan, shoppingList, inventory, wasteAlerts, budget, isLoading,
    generateMealPlan, createShoppingList, fetchWasteAlerts, fetchInventory, addInventoryItem, fetchBudget, setBudget, saveMealPlan, generateBudgetShoppingList,
  } = useGroceryStore();
  const [showAdd, setShowAdd] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!household) fetchHousehold();
    fetchInventory(); fetchBudget();
  }, []);

  useEffect(() => { if (inventory.length) fetchWasteAlerts(); }, [inventory.length]);

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
    try {
      if (budget > 0) await generateBudgetShoppingList(mealPlan, budget);
      else await createShoppingList(mealPlan, inventory);
      setShowList(true);
    } catch (e: any) { Alert.alert('Could not create list', e?.message || 'Please try again.'); }
  };

  const saveBudget = async () => {
    const n = Number(budgetInput.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) { Alert.alert('Invalid budget', 'Enter a valid weekly budget.'); return; }
    await setBudget(n, household?.currency); setShowBudget(false);
  };

  const persistPlan = async () => {
    if (!mealPlan) return;
    await saveMealPlan(mealPlan); Alert.alert('Meal plan saved', 'This week’s plan has been saved to your household.');
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
              <TouchableOpacity onPress={() => { setBudgetInput(String(budget || '')); setShowBudget(true); }}><Text style={styles.planSub}>{budget ? `${currency}${Number(budget).toLocaleString()} weekly budget · edit` : 'Set a weekly budget'}</Text></TouchableOpacity>
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
            <TouchableOpacity style={styles.quick} onPress={() => { setBudgetInput(String(budget || '')); setShowBudget(true); }} activeOpacity={0.8}><View style={[styles.quickIcon, { backgroundColor: H.amberBg }]}><Ionicons name="wallet-outline" size={20} color={H.amber} /></View><Text style={styles.quickText}>Budget</Text></TouchableOpacity>
          </View>

          {wasteAlerts.length > 0 && <View style={styles.wasteWrap}><Text style={styles.sectionTitle}>Use soon</Text>{wasteAlerts.slice(0,3).map((a, i) => <View key={`${a.item}-${i}`} style={styles.wasteCard}><Ionicons name="warning-outline" size={18} color={H.amber} /><View style={styles.flex}><Text style={styles.rowTitle}>{a.item}</Text><Text style={styles.rowMeta}>{a.days_left} days left · {a.suggested_recipe?.recipe_name || 'Use soon'}</Text></View></View>)}</View>}

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Pantry</Text><Text style={styles.sectionMeta}>{inventory.length} items</Text></View>
          {inventory.length === 0 ? <EmptyMessage icon="basket-outline" title="Your pantry is empty" subtitle="Add staples and Hearth can use them when planning meals." /> : inventory.map(item => (
            <View key={item.id} style={styles.row}>
              <View style={styles.dot} />
              <View style={styles.flex}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.quantity || 'Quantity not set'}{item.days_left != null ? ` · ${item.days_left} days left` : ''}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={H.muted2} />
            </View>
          ))}

          {shoppingList && showList && <View style={styles.shoppingCard}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Shopping list</Text><Text style={styles.sectionMeta}>{shoppingList.total_items} items</Text></View>{Object.entries(shoppingList.categories || {}).map(([cat, items]: [string, any]) => Array.isArray(items) && items.length ? <View key={cat} style={styles.listGroup}><Text style={styles.listCat}>{cat}</Text><Text style={styles.listItems}>{items.join(', ')}</Text></View> : null)}<Text style={styles.listTotal}>Est. {currency}{Number(shoppingList.estimated_total || shoppingList.estimated_cost || 0).toLocaleString()}</Text>{shoppingList.over_budget && <Text style={styles.overBudget}>Over budget by {currency}{Number(shoppingList.budget_gap || 0).toLocaleString()}</Text>}</View>}

          {mealPlan && (
            <View style={styles.mealPreview}>
              <View style={styles.mealTop}><View><Text style={styles.mealLabel}>MEAL PLAN</Text><Text style={styles.mealTitle}>This week</Text></View><Ionicons name="restaurant-outline" size={22} color={H.purple} /></View>
              <Text style={styles.mealSub}>{mealPlan.days?.length || 0} days planned · Estimated {currency}{Number(mealPlan.estimated_cost || 0).toLocaleString()}</Text>
              <View style={styles.mealActions}><TouchableOpacity style={styles.mealAction} onPress={persistPlan}><Text style={styles.mealActionText}>Save plan</Text></TouchableOpacity><TouchableOpacity style={styles.mealAction} onPress={makeList}><Text style={styles.mealActionText}>Build list</Text></TouchableOpacity></View>
              {mealPlan.days?.slice(0,7).map((d: any) => <View key={d.day} style={styles.dayRow}><Text style={styles.dayName}>{d.day}</Text><Text style={styles.dayMeals} numberOfLines={2}>{[d.breakfast?.name,d.lunch?.name,d.dinner?.name].filter(Boolean).join(' · ')}</Text></View>)}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showBudget} transparent animationType="fade" onRequestClose={() => setShowBudget(false)}><View style={styles.modalRoot}><TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowBudget(false)} /><View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom,18)+20 }]}><Text style={styles.modalTitle}>Weekly grocery budget</Text><TextInput value={budgetInput} onChangeText={setBudgetInput} placeholder="0" keyboardType="decimal-pad" placeholderTextColor={H.muted2} style={styles.input} /><TouchableOpacity style={styles.save} onPress={saveBudget}><Text style={styles.saveText}>Save budget</Text></TouchableOpacity></View></View></Modal>

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
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  quick: { width: '48%', minHeight: 92, borderRadius: 19, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 12, justifyContent: 'center', ...HearthDesign.shadow.card },
  quickIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  quickText: { color: H.navy, fontSize: 11.5, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionMeta: { color: H.muted, fontSize: 12 },
  wasteWrap: { marginTop: 4 }, wasteCard: { minHeight: 62, borderRadius: 17, backgroundColor: H.amberBg, borderWidth: 1, borderColor: '#F0DFC3', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { minHeight: 66, borderRadius: 18, borderWidth: 1, borderColor: H.lineSoft, backgroundColor: '#fff', padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11, ...HearthDesign.shadow.card },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: H.muted2 },
  rowTitle: { color: H.navy, fontSize: 14, fontWeight: '800' },
  rowMeta: { color: H.muted, fontSize: 11.5, marginTop: 3 },
  mealPreview: { marginTop: 18, borderRadius: 21, backgroundColor: '#F7F4FF', borderWidth: 1, borderColor: '#E7E0FF', padding: 16 },
  mealTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealLabel: { color: H.purple, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  mealTitle: { color: H.navy, fontSize: 16, fontWeight: '800', marginTop: 3 },
  mealSub: { color: H.muted, fontSize: 12, marginTop: 10 }, mealActions: { flexDirection: 'row', gap: 8, marginTop: 12 }, mealAction: { flex: 1, borderRadius: 999, backgroundColor: '#EDE7FF', paddingVertical: 9, alignItems: 'center' }, mealActionText: { color: H.purple, fontSize: 11, fontWeight: '900' }, dayRow: { borderTopWidth: 1, borderTopColor: '#EAE5FA', paddingTop: 9, marginTop: 9 }, dayName: { color: H.navy, fontSize: 11.5, fontWeight: '900' }, dayMeals: { color: H.muted, fontSize: 10.8, lineHeight: 16, marginTop: 3 },
  shoppingCard: { marginTop: 18, borderRadius: 21, backgroundColor: '#fff', borderWidth: 1, borderColor: H.lineSoft, padding: 15 }, listGroup: { marginBottom: 9 }, listCat: { color: H.navy, fontSize: 11.5, fontWeight: '900', textTransform: 'capitalize' }, listItems: { color: H.muted, fontSize: 11.5, lineHeight: 17, marginTop: 2 }, listTotal: { color: H.navy, fontSize: 12.5, fontWeight: '900', marginTop: 7 }, overBudget: { color: H.red, fontSize: 11.5, fontWeight: '800', marginTop: 4 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', justifyContent: 'flex-end', paddingHorizontal: 14 },
  modalCard: { borderRadius: 28, backgroundColor: H.paper, padding: 20 },
  modalTitle: { color: H.navy, fontSize: 23, fontWeight: '800', marginBottom: 16 },
  input: { height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: H.line, paddingHorizontal: 14, color: H.navy, fontSize: 15, marginBottom: 10 },
  save: { height: 52, borderRadius: 17, backgroundColor: H.green, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
