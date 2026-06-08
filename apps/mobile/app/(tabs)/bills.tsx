import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Alert, RefreshControl } from 'react-native'
import { useEffect, useState } from 'react'
import { useBillStore } from '../../src/stores/billStore'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const NAVY = '#0A1628'
const NAVY_LIGHT = '#112240'
const SURFACE = '#162035'
const ACCENT = '#C77DFF'
const WHITE = '#F8FAFF'
const MUTED = '#8899AA'
const SUCCESS = '#06D6A0'

export default function BillsScreen() {
  const { bills, monthlyReport, unusedSubscriptions, isLoading, fetchBills, fetchMonthlyReport, detectUnused, generateNegotiationScript } = useBillStore()
  const [showUnused, setShowUnused] = useState(false)
  const [detectLoading, setDetectLoading] = useState(false)

  useEffect(() => { fetchBills(); fetchMonthlyReport() }, [])

  const handleDetectUnused = async () => {
    setDetectLoading(true)
    await detectUnused()
    setShowUnused(true)
    setDetectLoading(false)
  }

  const handleNegotiation = async (provider: string, plan: string) => {
    try {
      const script = await generateNegotiationScript(provider, plan)
      Alert.alert('Negotiation Script', script.script)
    } catch { Alert.alert('Error', 'Could not generate script') }
  }

  const totalMonthly = bills.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <LinearGradient colors={[NAVY, NAVY_LIGHT]} style={styles.header}>
        <Text style={styles.headerLabel}>FINANCE</Text>
        <Text style={styles.headerTitle}>Bills & Subscriptions</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>${totalMonthly.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Monthly</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{bills.length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchBills(); fetchMonthlyReport() }} tintColor={ACCENT} />}>

        {monthlyReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Monthly Summary</Text>
            <View style={styles.reportCard}>
              <Text style={styles.reportAmount}>${monthlyReport.total_spent?.toFixed(2) || '0.00'}</Text>
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
                  <Text style={styles.unusedSaving}>-${sub.monthly_savings}/mo</Text>
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
            </View>
          ) : (
            bills.map((bill: any, i: number) => (
              <View key={bill.id || i} style={styles.billCard}>
                <View style={styles.billIconBox}>
                  <Ionicons name="card" size={20} color={ACCENT} />
                </View>
                <View style={styles.billInfo}>
                  <Text style={styles.billProvider}>{bill.provider || bill.name}</Text>
                  <Text style={styles.billMeta}>{bill.category} · {bill.billing_cycle}</Text>
                </View>
                <Text style={styles.billAmount}>${bill.amount}</Text>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
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
  billCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12 },
  billIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(199,125,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  billInfo: { flex: 1 },
  billProvider: { fontSize: 15, fontWeight: '600', color: WHITE, marginBottom: 2 },
  billMeta: { fontSize: 12, color: MUTED },
  billAmount: { fontSize: 16, fontWeight: '700', color: WHITE },
})