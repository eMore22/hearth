import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Hearth</Text>
        <Text style={styles.subtitle}>
          Your intelligent household assistant.{"\n"}
          We’ll help you stay organized, save money, and never miss important things again.
        </Text>

        <View style={styles.features}>
          <Text style={styles.feature}>• Track important documents & expiries</Text>
          <Text style={styles.feature}>• Manage bills and subscriptions</Text>
          <Text style={styles.feature}>• Get smart meal plans & grocery lists</Text>
          <Text style={styles.feature}>• Never forget home maintenance</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.push('/onboarding/create-household')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628', padding: 24 },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#F8FAFF', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#8899AA', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  features: { marginBottom: 40 },
  feature: { fontSize: 15, color: '#B8D4E8', marginBottom: 8 },
  button: { backgroundColor: '#C77DFF', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});