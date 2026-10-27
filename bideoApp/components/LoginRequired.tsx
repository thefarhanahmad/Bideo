import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Colors from '../constants/Colors';
import AuthModal from './AuthModal';

interface LoginRequiredProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Shows its children only to a signed-in user. Otherwise shows the same sign-in card as the
 * Upload tab, so a screen that needs a login can never be used while signed out.
 */
export default function LoginRequired({
  title = 'Upload Content',
  subtitle = 'Login to share your videos, shorts and community posts with the world.',
  children,
}: LoginRequiredProps) {
  const router = useRouter();
  const { isAuthenticated, loading } = useSelector((state: RootState) => state.auth);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) setAuthModalVisible(true);
    if (isAuthenticated) setAuthModalVisible(false);
  }, [isAuthenticated, loading]);

  if (isAuthenticated) return <>{children}</>;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.center}>
      <View style={styles.loginCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-upload" size={50} color={Colors.primary} />
        </View>
        <Text style={styles.loginTitle}>{title}</Text>
        <Text style={styles.loginSubtitle}>{subtitle}</Text>

        <TouchableOpacity style={styles.mainLoginBtn} onPress={() => setAuthModalVisible(true)} activeOpacity={0.8}>
          <Text style={styles.mainLoginBtnText}>Sign In / Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={goBack}>
          <Text style={styles.secondaryBtnText}>Maybe Later</Text>
        </TouchableOpacity>
      </View>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
    </View>
  );
}

// Same look as the Upload tab's sign-in card (app/(tabs)/upload.tsx)
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  loginCard: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 15,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  mainLoginBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainLoginBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: Colors.textGray,
    fontSize: 15,
    fontWeight: '600',
  },
});
