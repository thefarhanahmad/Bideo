import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout, updateUser } from '../../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../../services/api';
import { showAlert } from '../../components/AppAlert';

export default function DeleteProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isPhoneUser = user?.authProvider === 'phone' || !!user?.phone;

  const handleInitialClick = () => {
    if (!reason.trim()) {
      showAlert('Required Field', 'Please enter a reason for deleting your profile.');
      return;
    }

    if (isPhoneUser) {
      if (!password) {
        showAlert('Password Required', 'Please enter your password to proceed.');
        return;
      }
      if (password !== confirmPassword) {
        showAlert('Password Mismatch', 'Password and Confirm Password do not match.');
        return;
      }
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      const res = await api.post('/users/schedule-deletion', {
        reason: reason.trim(),
        password: isPhoneUser ? password : undefined,
      });

      if (res.data.success) {
        if (res.data.data) {
          dispatch(updateUser(res.data.data));
        } else {
          dispatch(updateUser({ deletionScheduled: true }));
        }

        showAlert(
          'Deletion Scheduled',
          'Your profile deletion has been scheduled. You have 5 days to recover your account if you change your mind.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/account-recovery');
              },
            },
          ]
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to schedule profile deletion. Please try again.';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Instructions Card */}
        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <Ionicons name="alert-circle" size={24} color="#DC2626" />
            <Text style={styles.warningTitle}>Profile Deletion Policy</Text>
          </View>
          <Text style={styles.warningSubtitle}>
            Please read these instructions carefully before proceeding:
          </Text>

          <View style={styles.instructionItem}>
            <View style={styles.bulletPoint}>
              <Ionicons name="time-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.boldText}>5-Day Grace Period:</Text> Your profile will be scheduled for deletion. Permanent deletion happens automatically after 5 days (120 hours).
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.bulletPoint}>
              <Ionicons name="lock-closed-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.boldText}>Account Lock:</Text> During this 5-day period, you will be logged out and cannot perform any account activities.
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.bulletPoint}>
              <Ionicons name="refresh-circle-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.boldText}>Account Recovery:</Text> You can restore your profile anytime within the 5 days by applying for account recovery upon login.
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.bulletPoint}>
              <Ionicons name="trash-bin-outline" size={18} color="#DC2626" />
            </View>
            <Text style={styles.instructionText}>
              <Text style={styles.boldText}>Permanent Data Loss:</Text> After 5 days, all your channel videos, comments, playlists, and account data will be permanently wiped out.
            </Text>
          </View>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Deletion Details</Text>

          {/* Reason Input */}
          <Text style={styles.label}>Reason for leaving *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us why you want to delete your profile..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />

          {/* Password Input (If applicable) */}
          {isPhoneUser && (
            <>
              <Text style={styles.label}>Current Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your current password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.deleteButton, loading && styles.disabledBtn]}
            onPress={handleInitialClick}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.deleteButtonText}>Delete Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="warning" size={32} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete your profile? Your account will be scheduled for permanent deletion in 5 days.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalBtn}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.confirmModalBtnText}>Yes, Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    padding: 15,
  },
  warningCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#991B1B',
    marginLeft: 8,
  },
  warningSubtitle: {
    fontSize: 14,
    color: '#7F1D1D',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletPoint: {
    marginRight: 8,
    marginTop: 2,
  },
  instructionText: {
    fontSize: 13,
    color: '#7F1D1D',
    flex: 1,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 30,
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
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 10,
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
    height: 90,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  cancelModalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  confirmModalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
