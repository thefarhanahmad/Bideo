import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import VerifiedBadge from './VerifiedBadge';
import { showAlert } from './AppAlert';
import { hapticLight, hapticSelection } from '../utils/haptics';
import { chatService, resolveMediaUrl } from '../services/api';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

interface AddGroupMembersModalProps {
  visible: boolean;
  groupId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onMembersAdded: () => void;
}

export default function AddGroupMembersModal({
  visible,
  groupId,
  existingMemberIds = [],
  onClose,
  onMembersAdded,
}: AddGroupMembersModalProps) {
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedUserIds([]);
      setSearchQuery('');
      loadContacts();
    }
  }, [visible]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await chatService.getEligibleContacts();
      // Filter out members who are already in the group
      const existingSet = new Set(existingMemberIds.map((id) => id?.toString()));
      const available = (Array.isArray(data) ? data : []).filter(
        (c) => !existingSet.has(c._id?.toString())
      );
      setContacts(available);
    } catch (err: any) {
      console.warn('[AddGroupMembersModal] Error loading contacts:', err?.message);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectUser = useCallback((userId: string) => {
    hapticSelection();
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  }, []);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.channelName && c.channelName.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) {
      showAlert('No Members Selected', 'Please select at least 1 member to add.');
      return;
    }

    try {
      setSubmitting(true);
      hapticLight();
      await chatService.addGroupMembers(groupId, selectedUserIds);
      onMembersAdded();
      onClose();
    } catch (err: any) {
      console.error('[AddGroupMembersModal] Error adding members:', err);
      showAlert(
        'Could Not Add Members',
        err?.response?.data?.message || 'Something went wrong while adding members. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerCancelBtn} activeOpacity={0.7}>
            <Text style={styles.headerCancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Add Members</Text>

          <TouchableOpacity
            onPress={handleAddMembers}
            disabled={selectedUserIds.length === 0 || submitting}
            style={[
              styles.headerAddBtn,
              (selectedUserIds.length === 0 || submitting) && styles.headerAddBtnDisabled,
            ]}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.headerAddText}>
                Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color={Colors.textGray} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search eligible contacts..."
              placeholderTextColor={Colors.textGray}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textGray} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={Colors.textGray} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No contacts match search' : 'No more contacts to add'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term.'
                : 'All your eligible connected contacts have already been added to this group!'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item._id?.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const uId = item._id?.toString();
              const isSelected = selectedUserIds.includes(uId);

              return (
                <TouchableOpacity
                  style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                  onPress={() => toggleSelectUser(uId)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(item.avatar) || FALLBACK_AVATAR }}
                    style={styles.contactAvatar}
                  />

                  <View style={styles.contactInfo}>
                    <View style={styles.contactNameRow}>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {item.channelName || item.name}
                      </Text>
                      {item.isVerified && <VerifiedBadge size={14} style={{ marginLeft: 4 }} />}
                    </View>
                    <Text style={styles.contactSub} numberOfLines={1}>
                      @{item.name}
                    </Text>
                  </View>

                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerCancelBtn: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  headerCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerAddBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  headerAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contactItemSelected: {
    backgroundColor: '#F8FAFC',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  contactSub: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textGray,
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
