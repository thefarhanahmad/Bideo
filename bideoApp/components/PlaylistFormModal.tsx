import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

export const PLAYLIST_NAME_MAX = 100;

interface PlaylistFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialPrivate?: boolean;
  onClose: () => void;
  /** Resolve when saved; throw to keep the sheet open (the caller shows the error). */
  onSubmit: (name: string, isPrivate: boolean) => Promise<void>;
}

/** Bottom sheet to create a playlist or edit its name and Public/Private setting. */
export default function PlaylistFormModal({
  visible,
  mode,
  initialName = '',
  initialPrivate = true,
  onClose,
  onSubmit,
}: PlaylistFormModalProps) {
  const [name, setName] = useState(initialName);
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the sheet opens
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setIsPrivate(initialPrivate);
      setSaving(false);
    }
  }, [visible, initialName, initialPrivate]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit(trimmed, isPrivate);
    } catch {
      // caller already showed the error; keep the sheet open
    } finally {
      setSaving(false);
    }
  };

  const options: Array<{ value: boolean; label: string; icon: any; hint: string }> = [
    { value: false, label: 'Public', icon: 'globe-outline', hint: 'Anyone can see it on your channel' },
    { value: true, label: 'Private', icon: 'lock-closed-outline', hint: 'Only you can see it' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{mode === 'create' ? 'New playlist' : 'Edit playlist'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter playlist name"
            placeholderTextColor={Colors.textGray}
            value={name}
            onChangeText={setName}
            maxLength={PLAYLIST_NAME_MAX}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Visibility</Text>
          {options.map((opt) => {
            const selected = isPrivate === opt.value;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setIsPrivate(opt.value)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Ionicons name={opt.icon} size={20} color={selected ? Colors.primary : Colors.textGray} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, selected && { color: Colors.primary }]}>{opt.label}</Text>
                  <Text style={styles.optionHint}>{opt.hint}</Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? Colors.primary : Colors.textGray}
                />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{mode === 'create' ? 'Create' : 'Save'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    gap: 12,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7F0',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  optionHint: {
    fontSize: 12.5,
    color: Colors.textGray,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
