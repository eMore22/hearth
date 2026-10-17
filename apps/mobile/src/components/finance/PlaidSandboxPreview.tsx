import React, { useCallback, useState } from 'react';
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

  const finish = useCallback(async (publicToken: string | null | undefined) => {
    if (!publicToken) {
      setMessage('Plaid did not provide a Sandbox authorization token.');
      setBusy(false);
      return;
    }
    try {
      // Only the short-lived public token crosses from Plaid Link to our API.
      // Never store or log it; the backend exchanges and then revokes the Item.
      const response = await api.post<PreviewResponse>('/api/finance/sandbox/plaid/preview',
        { public_token: publicToken });
      if (response.data.environment !== 'sandbox' || response.data.persistent_connection !== false
        || response.data.item_revoked !== true || response.data.payments_enabled !== false) {
        throw new Error('Unexpected Sandbox response');
      }
      setPreview(response.data.accounts);
      setMessage('Sandbox preview completed. The test connection has been removed.');
    } catch {
      setPreview(null);
      setMessage('We could not verify the Sandbox preview or securely close the test connection. Please try again later.');
      Alert.alert('Sandbox preview unavailable', 'The simulated bank account preview could not be completed safely.');
    } finally {
      setBusy(false);
    }
  }, []);

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

  return (
    <View style={styles.shell}>
      <View style={styles.heading}>
        <Ionicons name="flask-outline" size={20} color={H.purple} />
        <Text style={styles.title}>Canadian bank Sandbox</Text>
      </View>
      <Text style={styles.description}>
        Test Plaid Link with simulated Canadian banking information. This does not connect a real bank,
        store credentials, import transactions, or authorize payments.
      </Text>
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
                <Text style={styles.balance}>
                  {account.currency === 'CAD' && account.balance_minor != null
                    ? 'CAD ' + (account.balance_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : 'No verified balance'}
                </Text>
              </View>
            ))}
          <Text style={styles.small}>Preview is held only on this screen and cleared when you begin a new test.</Text>
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
});
