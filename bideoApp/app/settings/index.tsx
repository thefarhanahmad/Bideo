import { showAlert } from '../../components/AppAlert';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from '../../services/api';

const FALLBACK_AVATAR = 'https://via.placeholder.com/150x150.png?text=User';

export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('token');
              setAuthToken(null);
              dispatch(logout());
              router.replace('/');
            } catch (err) {
              console.error('Logout failed', err);
            }
          }
        }
      ]
    );
  };

  const settingsItems = [
    {
      title: 'About',
      icon: 'information-circle-outline',
      onPress: () => router.push('/settings/about'),
      color: '#4A90E2',
    },
    {
      title: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () => router.push('/settings/help'),
      color: '#50C878',
    },
    {
      title: 'Terms & Conditions',
      icon: 'document-text-outline',
      onPress: () => router.push('/settings/terms'),
      color: '#FF7F50',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: user?.avatar || FALLBACK_AVATAR }} 
              style={styles.avatar} 
            />
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => router.push('/edit-channel')}>
              <Ionicons name="camera" size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userHandle}>{user?.channelName ? `@${user.channelName}` : user?.email || user?.phone}</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/edit-channel')}>
            <Text style={styles.editProfileText}>Edit Channel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.earningsWrap}>
          <View style={styles.earningsCard}>
            <View style={styles.earningsTop}>
              <View style={styles.earningsIcon}>
                <Ionicons name="wallet" size={22} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningsLabel}>Your Earnings</Text>
                <Text style={styles.earningsAmount}>₹0.00</Text>
              </View>
              <View style={styles.earningsBadge}>
                <Text style={styles.earningsBadgeText}>Coming soon</Text>
              </View>
            </View>
            <Text style={styles.earningsNote}>
              Monetization is on the way! We're building a secure payment gateway so you can
              earn from your videos. This feature will be available in a few days.
            </Text>
            <TouchableOpacity
              style={styles.earningsBtn}
              activeOpacity={0.85}
              onPress={() =>
                showAlert(
                  'Earnings — Coming Soon',
                  'We are currently building the payment gateway and creator monetization. You will be able to track and withdraw your earnings here very soon. Thanks for your patience!'
                )
              }
            >
              <Text style={styles.earningsBtnText}>Learn more</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.menuCard}>
            {settingsItems.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.menuItem, index === settingsItems.length - 1 && styles.noBorder]} 
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={22} color={item.color} />
                  </View>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={[styles.menuItem, styles.noBorder]} onPress={handleLogout}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name="log-out-outline" size={22} color={Colors.primary} />
                </View>
                <Text style={[styles.menuItemTitle, { color: Colors.primary }]}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Bideo for Android</Text>
          <Text style={styles.versionNumber}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 15,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#F0F0F0',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  userHandle: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 4,
  },
  editProfileBtn: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  earningsWrap: {
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  earningsCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  earningsTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  earningsLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  earningsAmount: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  earningsBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  earningsBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  earningsNote: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  earningsBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningsBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  menuSection: {
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    marginBottom: 10,
    marginLeft: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 50,
  },
  versionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  versionNumber: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 4,
  },
});
