import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';

export default function PermissionsScreen() {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      // TODO: Request notification permissions using expo-notifications
      // For now we simulate success
      await new Promise((resolve) => setTimeout(resolve, 600));
      router.replace('/(tabs)');
    } catch (error) {
      router.replace('/(tabs)');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Stay Updated</Text>
        <Text style={styles.subtitle}>
          Enable notifications so Hearth can remind you about bills, document expiries, 
          maintenance tasks, and important updates.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.enableButton} 
          onPress={handleEnable}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.enableText}>Enable Notifications</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', padding: 24, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFF', marginBottom: 16, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#8899AA', textAlign: 'center', lineHeight: 24 },
  footer: { paddingBottom: 50 },
  enableButton: {
    backgroundColor: '#C77DFF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  enableText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipText: { color: '#8899AA', textAlign: 'center', fontSize: 16 },
});