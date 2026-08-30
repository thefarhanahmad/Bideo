import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { logout, updateUser } from '../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { clearAuthSession, setAuthToken } from '../services/api';
import { showAlert } from '../components/AppAlert';

const RECOVERY_REASON_OPTIONS = [
  'Changed my mind & want to stay',
  'Accidental deletion request',
  'Account security issue resolved',
  'Resolved platform/privacy concerns',
  'Other reason',
];

export default function AccountRecoveryScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [deletionData, setDeletionData] = useState<any>(null);

  const [selectedReason, setSelectedReason] = useState<string>(RECOVERY_REASON_OPTIONS[0]);
  const [recoveryNotes, setRecoveryNotes] = useState<string>('');

  // Lock hardware back button when on Account Recovery screen
  useEffect(() => {
    const onBackPress = () => {
      return true; // Consume back button event, preventing navigation back to locked screens
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const fetchStatus = async () => {
    setFetchingStatus(true);
    try {
      const res = await api.get('/users/deletion-status');
      if (res.data.success) {
        setDeletionData(res.data.data);

        if (!res.data.data.deletionScheduled) {
          dispatch(updateUser(res.data.data));
          showAlert('Account Restored', 'Your account has been fully restored by the Admin!', [
            { text: 'Continue to App', onPress: () => router.replace('/(tabs)/library') },
          ]);
        }
      }
    } catch (err) {
      console.log('Failed to fetch deletion status', err);
    } finally {
      setFetchingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const calculateTimeRemaining = (targetDateStr?: string) => {
    if (!targetDateStr) return '5 days';
    const target = new Date(targetDateStr).getTime();
    const now = Date.now();
    const diff = Math.max(0, target - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} days ${hours} hours`;
    }
    return `${hours} hours ${minutes} mins`;
  };

  const handleSubmitRecoveryRequest = async () => {
    if (!selectedReason) {
      showAlert('Required', 'Please select a reason why you want to recover your profile.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/users/recover-account', {
        recoveryReason: selectedReason,
        recoveryNotes: recoveryNotes.trim(),
      });

      if (res.data.success) {
        showAlert(
          'Request Submitted',
          'Your account recovery request has been submitted to the Admin for review. You will be notified once approved.',
          [{ text: 'OK', onPress: () => fetchStatus() }]
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to submit recovery request. Please try again.';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAuthSession();
    dispatch(logout());
    router.replace('/');
  };

  const isPendingAdminReview = deletionData?.deletionStatus === 'recovery_requested' || deletionData?.recoveryRequested;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account Recovery</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20 }}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.iconBg, isPendingAdminReview && { backgroundColor: '#FEF3C7' }]}>
            <Ionicons
              name={isPendingAdminReview ? 'hourglass-outline' : 'timer-outline'}
              size={38}
              color={isPendingAdminReview ? '#D97706' : '#EAB308'}
            />
          </View>

          <Text style={styles.title}>
            {isPendingAdminReview ? 'Recovery Request Pending Admin Review' : 'Account Scheduled For Deletion'}
          </Text>
          <Text style={styles.subtitle}>
            {isPendingAdminReview
              ? 'Your recovery request has been sent to the Admin. Deletion is paused pending Admin approval.'
              : 'Your profile is currently in the 5-day grace period. Submit a recovery request below to ask Admin to restore your account.'}
          </Text>

          {fetchingStatus ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 15 }} />
          ) : (
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>Time remaining on deletion schedule:</Text>
              <Text style={styles.timeValue}>
                {calculateTimeRemaining(deletionData?.scheduledDeletionDate || user?.scheduledDeletionDate)}
              </Text>
            </View>
          )}

          {deletionData?.deletionReason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Original Deletion Reason:</Text>
              <Text style={styles.reasonText}>"{deletionData.deletionReason}"</Text>
            </View>
          ) : null}
        </View>

        {/* Dynamic Form or Submitted State */}
        {isPendingAdminReview ? (
          <View style={styles.pendingCard}>
            <View style={styles.pendingHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#059669" />
              <Text style={styles.pendingTitle}>Recovery Application Submitted</Text>
            </View>
            <Text style={styles.pendingText}>
              Selected Reason: <Text style={styles.boldText}>{deletionData?.recoveryReason || selectedReason}</Text>
            </Text>
            {deletionData?.recoveryNotes ? (
              <Text style={[styles.pendingText, { marginTop: 4 }]}>
                Notes: "{deletionData.recoveryNotes}"
              </Text>
            ) : null}

            <TouchableOpacity style={styles.refreshBtn} onPress={fetchStatus}>
              <Ionicons name="refresh-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.refreshBtnText}>Check Review Status</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Request Profile Recovery</Text>

            <Text style={styles.label}>Why do you want to recover your profile? *</Text>
            {RECOVERY_REASON_OPTIONS.map((opt, idx) => {
              const isSelected = selectedReason === opt;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setSelectedReason(opt)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? Colors.primary : '#9CA3AF'}
                  />
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.label, { marginTop: 14 }]}>Additional Explanation (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Provide any details for the admin to help review your recovery..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={recoveryNotes}
              onChangeText={setRecoveryNotes}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.recoverButton, loading && styles.disabledBtn]}
              onPress={handleSubmitRecoveryRequest}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.recoverButtonText}>Submit Request To Admin</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
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
    paddingTop: 45,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  iconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  timeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B45309',
  },
  reasonBox: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 10,
    marginTop: 2,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textGray,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: Colors.text,
    fontStyle: 'italic',
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 10,
    flex: 1,
  },
  chipTextSelected: {
    fontWeight: '700',
    color: Colors.primary,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  textArea: {
    height: 70,
  },
  recoverButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  recoverButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pendingCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    marginLeft: 8,
  },
  pendingText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    height: 40,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  logoutBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
});
