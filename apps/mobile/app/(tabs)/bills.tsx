import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Alert, RefreshControl, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { useEffect, useState } from 'react'
import { useBillStore } from '../../src/stores/billStore'
import { useHouseholdStore } from '../../src/stores/householdStore'
import { getCurrencySymbol } from '../../src/utils/currency'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#C77DFF'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const SUCCESS = '#06D6A0'
const DANGER = '#FF6B6B'

const CATEGORIES = ['utilities', 'subscription', 'insurance', 'rent', 'loan', 'internet', 'phone', 'streaming', 'other']
const BILLING_CYCLES = ['monthly', 'weekly', 'quarterly', 'annually']

export default function BillsScreen() {
  const { bills, monthlyReport, unusedSubscriptions, isLoading, fetchBills, fetchMonthlyReport, detectUnused, generateNegotiationScript, createBill, deleteBill } = useBillStore()
  const household = useHouseholdStore(s => s.household)
  const fetchHousehold = useHouseholdStore(s => s.fetchHousehold)
  const currencySymbol = getCurrencySymbol(household?.currency)

  const [showAddModal, setShowAddModal] = useState(false)
  const [showUnused, setShowUnused] = useState(false)
  const [detectLoading, setDetectLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [billCategory, setBillCategory] = useState('other')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [billNotes, setBillNotes] = useState('')

  useEffect(() => {
    fetchBills()
    fetchMonthlyReport()
    if (!household) fetchHousehold()
  }, [])

  const resetForm = () => {
    setBillName(''); setBillAmount(''); setBillCategory('other')
    setBillingCycle('monthly'); setBillNotes('')
  }

  const handleAddBill = async () => {
    if (!billName.trim()) { Alert.alert('Error', 'Please enter a bill name'); return }
    const amount = parseFloat(billAmount)
    if (!billAmount || isNaN(amount) || amount <= 0) { Alert.alert('Error', 'Please enter a valid amount'); return }

    setSaving(true)
    try {
      await createBill({
        provider: billName.trim(),
        amount,
        category: billCategory,
        billing_cycle: billingCycle,
        notes: billNotes.trim() || undefined,
      })
      setShowAddModal(false)
      resetForm()
      Alert.alert('✅ Bill added', `${billName} tracked successfully.`)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not save bill. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBill = (bill: any) => {
    Alert.alert(
      'Delete bill?',
      `Remove ${bill.provider || bill.name} from your bills? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBill(bill.id)
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail || 'Could not delete bill. Please try again.')
            }
          },
        },
      ]
    )
  }

  const handleDetectUnused = async () => {
    setDetectLoading(true)
    await detectUnused()
    setShowUnused(true)
    setDetectLoading(false)
  }

  const handleNegotiation = async (provider: string, plan: string) => {
    try {
      const script = await generateNegotiationScript(provider, plan)
      Alert.alert('Negotiation Script', script.script || script.opening_line || JSON.stringify(script))
    } catch { Alert.alert('Error', 'Could not generate script') }
  }

  const totalMonthly = bills.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <Text style={styles.headerLabel}>FINANCE</Text>
        <Text style={styles.headerTitle}>Bills & Subscriptions</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{currencySymbol}{totalMonthly.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Monthly</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{bills.length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { fetchBills(); fetchMonthlyReport() }}
            tintColor={ACCENT}
          />
        }
      >
        {monthlyReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monthly Summary</Text>
            <View style={styles.reportCard}>
              <Text style={styles.reportAmount}>{currencySymbol}{monthlyReport.total_spent?.toFixed(2) || '0.00'}</Text>
              <Text style={styles.reportSummary}>{monthlyReport.summary}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity style={styles.detectBtn} onPress={handleDetectUnused} disabled={detectLoading}>
            <Ionicons name="search-outline" size={18} color={ACCENT} />
            <Text style={styles.detectBtnText}>{detectLoading ? 'Scanning...' : 'Find Unused Subscriptions'}</Text>
          </TouchableOpacity>
        </View>

        {showUnused && unusedSubscriptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Potential Savings</Text>
            {unusedSubscriptions.map((sub: any, i: number) => (
              <View key={i} style={styles.unusedCard}>
                <View style={styles.unusedTop}>
                  <Text style={styles.unusedProvider}>{sub.provider}</Text>
                  <Text style={styles.unusedSaving}>-{currencySymbol}{sub.monthly_savings}/mo</Text>
                </View>
                <Text style={styles.unusedReason}>{sub.reason}</Text>
                <TouchableOpacity onPress={() => handleNegotiation(sub.provider, 'current plan')}>
                  <Text style={styles.scriptBtnText}>Get negotiation script →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Bills</Text>

          {bills.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={40} color={MUTED} />
              <Text style={styles.emptyTitle}>No bills added yet</Text>
              <Text style={styles.emptySubtitle}>Add your recurring bills to track spending</Text>
              <TouchableOpacity style={styles.addBillBtnPrimary} onPress={() => setShowAddModal(true)}>
                <Ionicons name="add-circle-outline" size={20} color={WHITE} />
                <Text style={styles.addBillBtnPrimaryText}>➕ Add Manual Bill</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {bills.map((bill: any, i: number) => (
                <View key={bill.id || i} style={styles.billCard}>
                  <View style={styles.billIconBox}>
                    <Ionicons name="card" size={20} color={ACCENT} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billProvider}>{bill.provider || bill.name}</Text>
                    <Text style={styles.billMeta}>{bill.category} · {bill.billing_cycle}</Text>
                  </View>
                  <Text style={styles.billAmount}>{currencySymbol}{bill.amount}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteBill(bill)}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={DANGER} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addBillBtnSecondary} onPress={() => setShowAddModal(true)}>
                <Ionicons name="add-outline" size={18} color={ACCENT} />
                <Text style={styles.addBillBtnSecondaryText}>Add Another Bill</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add Bill</Text>
              <Text style={styles.modalHint}>Track a recurring payment</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setShowAddModal(false); resetForm() }}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Bill / Provider Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Netflix, Rent, Electricity"
              placeholderTextColor={MUTED}
              value={billName}
              onChangeText={setBillName}
            />

            <Text style={styles.fieldLabel}>Amount ({currencySymbol}) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={MUTED}
              value={billAmount}
              onChangeText={setBillAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, billCategory === cat && styles.chipActive]}
                  onPress={() => setBillCategory(cat)}
                >
                  <Text style={[styles.chipText, billCategory === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Billing Cycle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {BILLING_CYCLES.map(cycle => (
                <TouchableOpacity
                  key={cycle}
                  style={[styles.chip, billingCycle === cycle && styles.chipActive]}
                  onPress={() => setBillingCycle(cycle)}
                >
                  <Text style={[styles.chipText, billingCycle === cycle && styles.chipTextActive]}>
                    {cycle}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder="e.g. shared with partner, auto-renews Jan"
              placeholderTextColor={MUTED}
              value={billNotes}
              onChangeText={setBillNotes}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAddBill}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={WHITE} />
                : <Text style={styles.saveBtnText}>Save Bill</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  headerLabel: { fontSize: 11, color: MUTED, letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: WHITE, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  summaryValue: { fontSize: 15, fontWeight: '700', color: WHITE },
  summaryLabel: { fontSize: 12, color: MUTED },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  reportCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(199,125,255,0.15)' },
  reportAmount: { fontSize: 36, fontWeight: '700', color: WHITE, marginBottom: 8 },
  reportSummary: { fontSize: 13, color: '#B8D4E8', lineHeight: 19 },
  detectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(199,125,255,0.1)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(199,125,255,0.25)' },
  detectBtnText: { color: ACCENT, fontWeight: '600', fontSize: 15 },
  unusedCard: { backgroundColor: SURFACE, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,159,28,0.2)' },
  unusedTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  unusedProvider: { fontSize: 15, fontWeight: '600', color: WHITE },
  unusedSaving: { fontSize: 15, fontWeight: '700', color: SUCCESS },
  unusedReason: { fontSize: 13, color: MUTED, marginBottom: 10 },
  scriptBtnText: { fontSize: 13, color: ACCENT, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: WHITE },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: 'center' },
  addBillBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32,
    marginTop: 8, width: '100%',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6,
  },
  addBillBtnPrimaryText: { color: NAVY, fontWeight: '700', fontSize: 16 },
  addBillBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14, marginTop: 8,
    borderWidth: 1.5, borderColor: 'rgba(199,125,255,0.35)',
    backgroundColor: 'rgba(199,125,255,0.06)',
  },
  addBillBtnSecondaryText: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  billCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12 },
  billIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(199,125,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  billInfo: { flex: 1 },
  billProvider: { fontSize: 15, fontWeight: '600', color: WHITE, marginBottom: 2 },
  billMeta: { fontSize: 12, color: MUTED },
  billAmount: { fontSize: 16, fontWeight: '700', color: WHITE },
  deleteBtn: { padding: 4, marginLeft: 6 },
  modal: { flex: 1, backgroundColor: NAVY, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 20, marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: WHITE, marginBottom: 4 },
  modalHint: { fontSize: 13, color: MUTED },
  modalClose: { padding: 6, backgroundColor: SURFACE, borderRadius: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 16,
    fontSize: 15, color: WHITE, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: 'rgba(199,125,255,0.2)', borderColor: ACCENT },
  chipText: { fontSize: 13, color: MUTED, textTransform: 'capitalize' },
  chipTextActive: { color: ACCENT, fontWeight: '600' },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: NAVY, fontWeight: '700', fontSize: 16 },
})
