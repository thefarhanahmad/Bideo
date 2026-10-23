import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from './AppAlert';

interface ReportVideoModalProps {
  visible: boolean;
  videoId?: string | null;
  onClose: () => void;
}

/** "Report video" popup (same look, request and messages as the home feed's). */
export default function ReportVideoModal({ visible, videoId, onClose }: ReportVideoModalProps) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason('');
      setSending(false);
    }
  }, [visible, videoId]);

  const submit = async () => {
    if (!videoId || sending) return;
    setSending(true);
    try {
      await api.post(`/videos/${videoId}/report`, { reason });
      showAlert('Report sent', 'Thanks for helping keep Bideo safe.');
      onClose();
    } catch (err: any) {
      showAlert('Report failed', err?.response?.data?.message || 'Please try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Report video</Text>
          <TextInput
            style={styles.input}
            placeholder="Tell us what is wrong"
            placeholderTextColor={Colors.textGray}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} disabled={sending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submit} onPress={submit} disabled={sending}>
              {sending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  box: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    gap: 18,
  },
  cancelText: { color: Colors.textGray, fontWeight: '600' },
  submit: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11, minWidth: 90, alignItems: 'center' },
  submitText: { color: Colors.white, fontWeight: 'bold' },
});
