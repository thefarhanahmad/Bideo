import { showAlert } from '../../components/AppAlert';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';
import { hapticSelection } from '../../utils/haptics';

export default function UploadScreen() {
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useSelector((state: RootState) => state.auth);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [showChannelPrompt, setShowChannelPrompt] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        if (!isAuthenticated) {
          setAuthModalVisible(true);
        } else if (!user?.channelName) {
          setShowChannelPrompt(true);
        } else {
          setShowChannelPrompt(false);
        }
      }
    }, [isAuthenticated, authLoading, user?.channelName])
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <View style={styles.loginCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload" size={50} color={Colors.primary} />
          </View>
          <Text style={styles.loginTitle}>Upload Content</Text>
          <Text style={styles.loginSubtitle}>Login to share your videos, shorts and community posts with the world.</Text>

          <TouchableOpacity
            style={styles.mainLoginBtn}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.mainLoginBtnText}>Sign In / Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.secondaryBtnText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </View>
    );
  }

  if (showChannelPrompt) {
    return (
      <View style={styles.center}>
        <Ionicons name="megaphone-outline" size={80} color={Colors.primary} />
        <Text style={styles.promptTitle}>Channel Required</Text>
        <Text style={styles.promptText}>You need to create a channel name before you can upload videos.</Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/edit-channel')}
        >
          <Text style={styles.actionBtnText}>Create Channel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Create</Text>
      </View>

      <Text style={styles.createSubtitle}>What would you like to share today?</Text>
      <View style={styles.typeGrid}>
        {[
          { key: 'video', label: 'Video', icon: 'videocam', desc: 'Long-form', route: '/upload-video?type=video' },
          { key: 'short', label: 'Short', icon: 'flash', desc: 'Vertical', route: '/upload-video?type=short' },
          { key: 'post', label: 'Post', icon: 'document-text', desc: 'Text & image', route: '/upload-post' },
        ].map((item: any) => (
          <TouchableOpacity
            key={item.key}
            style={styles.typeCard}
            activeOpacity={0.85}
            onPress={() => {
              hapticSelection();
              router.push(item.route);
            }}
          >
            <View style={styles.typeIconCircle}>
              <Ionicons name={item.icon} size={24} color={Colors.primary} />
            </View>
            <Text style={styles.typeText}>{item.label}</Text>
            <Text style={styles.typeDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>Quick Guide</Text>
        {[
          { icon: 'videocam-outline', title: 'Videos', text: 'Share long-form content. Use 16:9 thumbnails for best results.' },
          { icon: 'flash-outline', title: 'Shorts', text: 'Vertical 9:16 videos under 60 seconds. Perfect for quick trends.' },
          { icon: 'document-text-outline', title: 'Posts', text: 'Engage with your community via text and images.' },
          { icon: 'shield-checkmark-outline', title: 'Guidelines', text: 'Ensure your content follows our community standards.' },
        ].map((item, index) => (
          <View key={index} style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.instructionTitle}>{item.title}</Text>
              <Text style={styles.instructionText}>{item.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
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
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  promptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
  },
  promptText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  createSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 2,
    marginBottom: 18,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    minHeight: 128,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  typeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeText: {
    color: Colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  typeDesc: {
    color: Colors.textGray,
    fontSize: 11,
    marginTop: 2,
  },
  instructionsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 20,
    marginLeft: 4,
  },
  instructionItem: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 22,
    alignItems: 'flex-start',
  },
  instructionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
});
