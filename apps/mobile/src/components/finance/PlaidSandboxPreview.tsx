import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { H } from '../../theme/hearthDesign';

type PreviewAccount = {
  name: string;
  mask: string;
  currency: string | null;
  balance_minor: number | null;
  is_sandbox: true;
};

type DemoConnection = { id: string; status: string; consent_expires_at: string | null; last_synced_at: string | null; };
type DemoTransaction = { id: string; booked_at: string; amount_minor: number; currency: string; description: string; merchant?: string | null; };

type PreviewResponse = {
  accounts: PreviewAccount[];
  environment: 'sandbox';
  persistent_connection: false;
  item_revoked: true;
  payments_enabled: false;
};

export default function PlaidSandboxPreview() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewAccount[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retainDemo, setRetainDemo] = useState(false);
  const [connections, setConnections] = useState<DemoConnection[]>([]);
  const [transactions, setTransactions] = useState<DemoTransaction[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const loadConnections = useCallback(async () => {
    if (process.env.EXPO_PUBLIC_BANKING_SANDBOX_UI !== 'true' || process.env.EXPO_PUBLIC_PLAID_SANDBOX_DEMO !== 'true') return;
    try {
      const response = await api.get<{ connections: DemoConnection[] }>('/api/finance/sandbox/plaid/connections');
      setConnections(response.data.connections.filter(c => c.status !== 'revoked'));
    } catch { /* Opt-in Sandbox endpoint may be disabled; normal Finance still works. */ }
  }, []);
  useEffect(() => { void loadConnections(); }, [loadConnections]);

  const finish = useCallback(async (publicToken: string | null | undefined) => {
    if (!publicToken) {
      setMessage('Plaid did not provide a Sandbox authorization token.');
      setBusy(false);
      return;
    }
    try {
      // One-use token only: never log or persist it on device.
      if (retainDemo) {
        const response = await api.post<{ id: string; environment: string; status: string }>(
          '/api/finance/sandbox/plaid/connections',
          { public_token: publicToken, consent_acknowledged: true });
        if (response.data.environment !== 'sandbox' || response.data.status !== 'linked') {
          throw new Error('Unexpected Sandbox connection response');
        }
        setMessage('Simulated bank linked for up to 30 days. You can disconnect below.');
        setRetainDemo(false);
        await loadConnections();
      } else {
        const response = await api.post<PreviewResponse>('/api/finance/sandbox/plaid/preview',
          { public_token: publicToken });
        if (response.data.environment !== 'sandbox' || response.data.persistent_connection !== false
          || response.data.item_revoked !== true || response.data.payments_enabled !== false) {
          throw new Error('Unexpected Sandbox response');
        }
        setPreview(response.data.accounts);
        setMessage('Sandbox preview completed. The test connection has been removed.');
      }
    } catch {
      setPreview(null);
      setMessage('We could not verify the Sandbox preview or securely close the test connection. Please try again later.');
      Alert.alert('Sandbox connection unavailable', 'The test bank connection could not be completed safely.');
    } finally {
      setBusy(false);
    }
  }, [retainDemo, loadConnections]);

  const openSandbox = useCallback(async () => {
    if (busy) return;
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      Alert.alert('Native app needed', 'Plaid Link requires an Android or iOS build with the native SDK installed.');
      return;
    }
    setBusy(true);
    setPreview(null);
    setMessage(null);
    try {
      const response = await api.post<{ link_token: string; environment: string; country: string }>(
        '/api/finance/sandbox/plaid/link-token');
      if (!response.data.link_token || response.data.environment !== 'sandbox' || response.data.country !== 'CA') {
        throw new Error('Invalid Sandbox session');
      }
      // Lazy import: keeps the rest of Household Finance usable in Expo Go.
      // The SDK itself still needs a new native build to launch Plaid Link.
      const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
      const session = await createPlaidLinkSession({
        token: response.data.link_token,
        onEvent: () => { /* Intentionally no bank-event analytics or sensitive logging. */ },
        onSuccess: (result) => {
          void finish(result.publicToken);
        },
        onExit: (result) => {
          setBusy(false);
          // Do not surface Plaid metadata or internal error details.
          if (result.error) setMessage('The Sandbox connection was not completed. You can try again.');
        },
      });
      await session.open();
    } catch {
      setBusy(false);
      setMessage('Sandbox linking is unavailable. Verify the backend Sandbox setup and use a fresh native test build.');
    }
  }, [busy, finish]);

  const inspectConnection = useCallback(async (connectionId: string, doSync: boolean) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setSelected(null);
    setTransactions([]);
    setShowAllTransactions(false);
    try {
      if (doSync) await api.post(`/api/finance/sandbox/plaid/connections/${connectionId}/sync`);
      const response = await api.get<{ transactions: DemoTransaction[] }>(
        `/api/finance/sandbox/plaid/connections/${connectionId}/transactions`);
      setTransactions(response.data.transactions);
      setSelected(connectionId);
      setMessage(doSync ? 'Simulated transactions refreshed.' : 'Saved simulated transactions loaded.');
      await loadConnections();
    } catch {
      setMessage('Demo transactions are unavailable. Check Sandbox consent and backend setup.');
    } finally {
      setBusy(false);
    }
  }, [busy, loadConnections]);

  const disconnect = useCallback((connectionId: string) => {
    Alert.alert('Disconnect Sandbox bank?', 'This revokes test access and removes its locally saved simulated accounts and transactions.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        if (busy) return;
        setBusy(true);
        try {
          await api.delete(`/api/finance/sandbox/plaid/connections/${connectionId}`);
          setTransactions([]);
          setSelected(null);
          setShowAllTransactions(false);
          setMessage('Sandbox bank disconnected and access revoked.');
          await loadConnections();
        } catch {
          setMessage('Local consent was revoked, but the bank disconnect could not be confirmed. Please retry.');
        } finally {
          setBusy(false);
        }
      } },
    ]);
  }, [busy, loadConnections]);

  // Internal Google Play testers only; production users never see a demo bank CTA.
  if (process.env.EXPO_PUBLIC_BANKING_SANDBOX_UI !== 'true' || process.env.EXPO_PUBLIC_PLAID_SANDBOX_DEMO !== 'true') return null;

  return (
    <View style={styles.shell}>
      <View style={styles.heading}>
        <Ionicons name="flask-outline" size={20} color={H.purple} />
        <Text style={styles.title}>Canadian bank Sandbox</Text>
      </View>
      <Text style={styles.description}>
        Test with simulated Canadian bank information only. Nothing here can connect a real bank or authorize payments.
      </Text>
      <TouchableOpacity onPress={() => setRetainDemo(v => !v)} accessibilityRole="checkbox"
        accessibilityState={{ checked: retainDemo }} style={styles.consentRow} disabled={busy}>
        <Ionicons name={retainDemo ? 'checkbox' : 'square-outline'} size={22} color={H.purple} />
        <Text style={[styles.description, { flex: 1 }]}>
          Keep this simulated bank connected for up to 30 days, with read-only access to test accounts,
          balances and transactions. I can disconnect and revoke this test access anytime.
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open Plaid simulated Canadian bank preview"
        onPress={() => void openSandbox()}
        disabled={busy}
        style={[styles.button, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="link-outline" size={18} color="#fff" />}
        <Text style={styles.buttonText}>{busy ? 'Opening Sandbox…' : 'Try Canadian bank demo'}</Text>
      </TouchableOpacity>
      {!!message && <Text accessibilityRole="text" style={styles.message}>{message}</Text>}
      {connections.map(connection => (
        <View key={connection.id} style={styles.demoConnection}>
          <Text style={styles.accountName}>Saved Sandbox bank · {connection.status}</Text>
          <Text style={styles.description}>Consent ends {connection.consent_expires_at?.slice(0, 10) || 'unknown'}. Last sync: {connection.last_synced_at?.slice(0, 10) || 'Not synced'}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity disabled={busy} style={styles.smallButton} onPress={() => void inspectConnection(connection.id, true)}><Text style={styles.smallButtonText}>Sync demo</Text></TouchableOpacity>
            <TouchableOpacity disabled={busy} style={styles.smallButton} onPress={() => void inspectConnection(connection.id, false)}><Text style={styles.smallButtonText}>View activity</Text></TouchableOpacity>
            <TouchableOpacity disabled={busy} style={[styles.smallButton, { backgroundColor: '#FCE8E8' }]} onPress={() => disconnect(connection.id)}><Text style={[styles.smallButtonText, { color: '#9C3030' }]}>Disconnect</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      {selected && <View style={styles.results}>
        <Text style={styles.resultsTitle}>Simulated transactions · CAD only</Text>
        {transactions.length > 0 && <Text style={[styles.description, { marginBottom: 6 }]}>
          Showing {Math.min(transactions.length, showAllTransactions ? 30 : 8)} of {transactions.length} simulated transactions. Amounts are signed: minus indicates money out, plus indicates money in.
        </Text>}
        {transactions.length ? transactions.slice(0, showAllTransactions ? 30 : 8).map(tx => <View key={tx.id} style={styles.account}>
          <View style={{ flex: 1 }}><Text style={styles.accountName}>{tx.merchant || tx.description || 'Test transaction'}</Text><Text style={styles.description}>{tx.booked_at.slice(0, 10)}</Text></View>
          <Text style={styles.balance}>{tx.currency} {tx.amount_minor > 0 ? '+' : ''}{(tx.amount_minor / 100).toFixed(2)}</Text>
        </View>) : <Text style={styles.description}>No simulated transactions currently available.</Text>}
        {transactions.length > 8 && <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={showAllTransactions ? 'Show fewer test transactions' : 'Show more test transactions'}
          onPress={() => setShowAllTransactions(value => !value)}
          style={[styles.smallButton, { alignSelf: 'flex-start', marginTop: 12 }]}
        >
          <Text style={styles.smallButtonText}>{showAllTransactions ? 'Show fewer' : 'Show more activity'}</Text>
        </TouchableOpacity>}
      </View>}
      {preview !== null && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Simulated accounts · one-time preview</Text>
          {preview.length === 0 ? <Text style={styles.description}>No simulated accounts returned.</Text> :
            preview.map((account, index) => (
              <View key={index} style={styles.account}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.description}>Test account ending {account.mask || '••••'}</Text>
                </View>
                <Text style={styles.description}>Private balance in Profile</Text>
              </View>
            ))}
          <Text style={styles.small}>This one-time preview is not saved. To see saved account balances, explicitly connect the simulated bank, then open your private Profile.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginHorizontal: 18, marginBottom: 17, padding: 16, borderRadius: 20, backgroundColor: '#F4F0FF', borderColor: '#E4DBFF', borderWidth: 1 },
  heading: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 9 },
  title: { color: H.navy, fontSize: 15, fontWeight: '800' },
  description: { fontSize: 12, color: H.muted, lineHeight: 18 },
  button: { marginTop: 14, backgroundColor: H.purple, borderRadius: 14, minHeight: 48, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 9 },
  disabled: { opacity: .65 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  message: { fontSize: 12, color: H.navy, lineHeight: 18, marginTop: 11 },
  results: { borderTopWidth: 1, borderColor: '#E0D8F5', marginTop: 14, paddingTop: 13 },
  resultsTitle: { color: H.navy, fontSize: 13, fontWeight: '800', marginBottom: 5 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E0D8F5' },
  accountName: { color: H.navy, fontSize: 13, fontWeight: '700' },
  balance: { color: H.navy, fontWeight: '800', fontSize: 13 },
  small: { color: H.muted, marginTop: 10, fontSize: 11, lineHeight: 16 },
  consentRow: { flexDirection: 'row', gap: 9, marginTop: 15, alignItems: 'flex-start' },
  demoConnection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#E0D8F5', gap: 5 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  smallButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11, backgroundColor: '#E4DDFF' },
  smallButtonText: { fontWeight: '800', color: H.purple, fontSize: 11 },
});
