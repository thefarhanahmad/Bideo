import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import Colors from '../constants/Colors';
import { logEvent } from '../services/analytics';

/**
 * Shown instead of closing the app when a screen crashes (expo-router ErrorBoundary).
 * It can sit outside the app's providers, so it uses no Redux / safe-area / navigation hooks.
 * (expo-router hides the native splash itself when it shows this screen.)
 */
export default function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error('App crashed:', error);
    logEvent('app_error', { message: String(error?.message || error).slice(0, 100) });
  }, [error]);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>Sorry, this screen ran into a problem. Please try again.</Text>
      <TouchableOpacity style={styles.button} onPress={handleRetry} disabled={retrying} activeOpacity={0.85}>
        {retrying ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.buttonText}>Try again</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.white,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '1A',
    marginBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    minWidth: 160,
    minHeight: 44,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
