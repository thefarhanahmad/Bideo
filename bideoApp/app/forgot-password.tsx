import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { hapticSelection } from '../utils/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const handleEmailSupport = () => {
    hapticSelection();
    Linking.openURL(
      'mailto:bideoapps@gmail.com?subject=Bideo%20Password%20Reset%20Request&body=Hi%20Bideo%20Team%2C%0A%0AI%20forgot%20my%20password%20and%20would%20like%20to%20reset%20it.%0A%0ARegistered%20Phone%20Number%20or%20Username%3A%20%0A%0AThank%20you!'
    );
  };

  const handleInstagramSupport = () => {
    hapticSelection();
    Linking.openURL('https://www.instagram.com/bideo.app/');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={38} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            To reset or recover your account password, please contact our support team directly via Email or Instagram DM with your registered phone number or username.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Email Card */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleEmailSupport}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="mail" size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Send Email to Support</Text>
              <Text style={styles.cardValue}>bideoapps@gmail.com</Text>
              <Text style={styles.cardActionHint}>Tap to open mail app</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={Colors.textGray} />
          </TouchableOpacity>

          {/* Instagram Card */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleInstagramSupport}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: '#FCE7F3' }]}>
              <Ionicons name="logo-instagram" size={24} color="#E1306C" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Instagram Direct Message</Text>
              <Text style={styles.cardValue}>@bideo.app</Text>
              <Text style={styles.cardActionHint}>Tap to open Instagram profile</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={Colors.textGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.noticeBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={styles.noticeText}>
            Our support team will verify your registered account details and help you restore access within 24 hours.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backToLoginBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backToLoginText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 36,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 6,
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 10,
  },
  cardsContainer: {
    width: '100%',
    gap: 14,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textGray,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  cardActionHint: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
  backToLoginBtn: {
    backgroundColor: Colors.primary,
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  backToLoginText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
