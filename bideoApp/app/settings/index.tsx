import { showAlert } from '../../components/AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Colors from '../../constants/Colors';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../../services/api';

export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, loading: authLoading } = useSelector((state: RootState) => state.auth);

  const [monetizationInfo, setMonetizationInfo] = useState<any>(null);
  const [loadingMonetization, setLoadingMonetization] = useState(true);

  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/(tabs)/library');
    } else if (isAuthenticated && user?.deletionScheduled) {
      router.replace('/account-recovery');
    }
  }, [isAuthenticated, authLoading, user]);

  useEffect(() => {
    if (!isAuthenticated || user?.deletionScheduled) return;
    const fetchMonetization = async () => {
      try {
        const res = await api.get('/users/monetization/status');
        if (res.data.success) {
          setMonetizationInfo(res.data.data);
        }
      } catch (err) {
        console.log('Failed to fetch monetization status on settings');
      } finally {
        setLoadingMonetization(false);
      }
    };
    fetchMonetization();
  }, [isAuthenticated, user]);

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
      title: 'Channel Analytics',
      icon: 'stats-chart-outline',
      onPress: () => router.push('/analytics'),
      color: '#8E24AA',
    },
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
    {
      title: 'Privacy Policy',
      icon: 'shield-checkmark-outline',
      onPress: () => router.push('/settings/privacy'),
      color: '#8A2BE2',
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
        <View style={styles.earningsWrap}>
          <View style={styles.earningsCard}>
            <View style={styles.earningsTop}>
              <View style={styles.earningsIcon}>
                <Ionicons name="wallet" size={22} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningsLabel}>Your Earnings</Text>
                <Text style={[styles.earningsAmount, !monetizationInfo?.step2Completed && { fontSize: 18, marginTop: 4 }]}>
                  {monetizationInfo?.step2Completed ? `₹${(monetizationInfo?.walletBalance || 0).toFixed(2)}` : 'Ineligible'}
                </Text>
              </View>
              <View style={styles.earningsBadge}>
                <Text style={styles.earningsBadgeText}>
                  {loadingMonetization ? 'Loading...' : 
                   monetizationInfo?.step2Completed ? 'Monetized' :
                   monetizationInfo?.application?.status === 'pending' ? 'Pending Review' :
                   monetizationInfo?.application?.status === 'rejected' ? 'Action Required' :
                   'Task Pending'}
                </Text>
              </View>
            </View>
            <Text style={styles.earningsNote}>
              {loadingMonetization ? 'Loading monetization information...' :
               monetizationInfo?.step2Completed 
                 ? "Congratulations, your account is monetized! Click below to view your balance and payment statements."
                 : monetizationInfo?.application?.status === 'pending'
                 ? "Your monetization details are under verification. Manually audited by Bideo Administrators."
                 : monetizationInfo?.application?.status === 'rejected'
                 ? `Application rejected: ${monetizationInfo.application.reviewMessage || 'Check details.'} Click below to correct and resubmit.`
                 : monetizationInfo?.step1Completed
                 ? "Step 1 complete! You have uploaded 3 original passed videos. Click below to submit your verification details."
                 : `Monetization eligibility milestone: Upload at least 3 original videos. Status: ${monetizationInfo?.passedVideosCount || 0}/3 passed.`}
            </Text>
            <TouchableOpacity
              style={styles.earningsBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/earnings')}
            >
              <Text style={styles.earningsBtnText}>
                {monetizationInfo?.step2Completed ? 'View earnings' : 
                 monetizationInfo?.step1Completed ? 'Apply Now' : 'Check Eligibility'}
              </Text>
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
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/settings/delete-profile')}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#EF444415' }]}>
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </View>
                <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Delete Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>

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
          <Text style={styles.versionText}>Bideo for {Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
          <Text style={styles.versionNumber}>
            Version {Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || '1.0.2'}
          </Text>
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
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 15,
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
    marginLeft: 12,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  earningsWrap: {
    paddingHorizontal: 15,
    paddingTop: 15,
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
    fontSize: 10,
    fontWeight: '700',
  },
  earningsNote: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 14,
  },
  earningsBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  earningsBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  menuSection: {
    paddingHorizontal: 15,
    paddingTop: 15,
  },
    sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    marginBottom: 8,
    marginLeft: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    },
    menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
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
    paddingVertical: 12,
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
    marginLeft: 12,
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 35,
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
