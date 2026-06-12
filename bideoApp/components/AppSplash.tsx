import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

/**
 * Full-screen branded splash shown while the app boots. This guarantees a
 * full-bleed splash regardless of the Android 12+ system splash (which only
 * shows a small centered icon). `onLayout` is used to hide the native splash
 * once this view is on screen, avoiding any blank flash.
 */
export default function AppSplash({ onLayout }: { onLayout?: () => void }) {
  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.logoCircle}>
        <Ionicons name="play" size={46} color={Colors.primary} />
      </View>
      <Text style={styles.brand}>Bideo</Text>
      <Text style={styles.tagline}>Watch. Create. Grow.</Text>
      <ActivityIndicator color={Colors.white} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  brand: {
    color: Colors.white,
    fontSize: 38,
    fontWeight: '800',
    marginTop: 24,
    letterSpacing: 0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  spinner: {
    marginTop: 40,
  },
});
