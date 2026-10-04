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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import VerifiedBadge from './VerifiedBadge';
import { showAlert } from './AppAlert';
import { hapticLight, hapticSelection } from '../utils/haptics';
import { chatService, resolveMediaUrl } from '../services/api';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export default function CreateGroupModal({
  visible,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const insets = useSafeAreaInsets();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load eligible contacts when modal opens
  useEffect(() => {
    if (visible) {
      setGroupName('');
      setDescription('');
      setAvatarUri(null);
      setSelectedUserIds([]);
      setSearchQuery('');
      loadContacts();
    }
  }, [visible]);

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await chatService.getEligibleContacts();
      setContacts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('[CreateGroupModal] Error loading contacts:', err?.message);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission Required', 'Please grant photo library access to choose a group photo.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        hapticLight();
        setAvatarUri(res.assets[0].uri);
      }
    } catch (err) {
      console.warn('[CreateGroupModal] Avatar pick error:', err);
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

  const selectedUsers = useMemo(() => {
    return contacts.filter((c) => selectedUserIds.includes(c._id?.toString()));
  }, [contacts, selectedUserIds]);

  const canCreate = groupName.trim().length >= 2 && selectedUserIds.length >= 1;

  const handleCreate = async () => {
    const trimmedName = groupName.trim();
    if (trimmedName.length < 2) {
      showAlert('Group Name Required', 'Please enter a group name with at least 2 characters.');
      return;
    }
    if (selectedUserIds.length === 0) {
      showAlert('Members Required', 'Please select at least 1 member to add to the group.');
      return;
    }

    try {
      setCreating(true);
      hapticLight();

      let payload: any;
      if (avatarUri) {
        const formData = new FormData();
        formData.append('name', trimmedName);
        if (description.trim()) {
          formData.append('description', description.trim());
        }
        formData.append('memberIds', JSON.stringify(selectedUserIds));

        const filename = avatarUri.split('/').pop() || `group_avatar_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match?.[1] ? match[1].toLowerCase() : 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        // @ts-ignore
        formData.append('avatar', {
          uri: avatarUri,
          name: filename,
          type: mimeType,
        });
        payload = formData;
      } else {
        payload = {
          name: trimmedName,
          description: description.trim(),
          memberIds: selectedUserIds,
        };
      }

      const newGroup = await chatService.createGroup(payload);
      hapticLight();
      onClose();
      if (newGroup && onGroupCreated) {
        onGroupCreated(newGroup);
      }
    } catch (err: any) {
      console.error('[CreateGroupModal] Error creating group:', err);
      showAlert(
        'Could Not Create Group',
        err?.response?.data?.message || 'Something went wrong while creating the group. Please try again.'
      );
    } finally {
      setCreating(false);
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
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerCancelBtn} activeOpacity={0.7}>
            <Text style={styles.headerCancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>New Group</Text>

          <TouchableOpacity
            onPress={handleCreate}
            disabled={!canCreate || creating}
            style={[styles.headerCreateBtn, (!canCreate || creating) && styles.headerCreateBtnDisabled]}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.headerCreateText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Group Profile Setup */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarPicker}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.groupAvatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera" size={26} color={Colors.textGray} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.inputsColumn}>
            <TextInput
              style={styles.nameInput}
              placeholder="Group Name (required)"
              placeholderTextColor={Colors.textGray}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={60}
              returnKeyType="next"
            />
            <TextInput
              style={styles.descInput}
              placeholder="Group Description (optional)"
              placeholderTextColor={Colors.textGray}
              value={description}
              onChangeText={setDescription}
              maxLength={300}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Selected Members Chips */}
        {selectedUsers.length > 0 && (
          <View style={styles.selectedRowContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedRowScroll}
            >
              {selectedUsers.map((user) => (
                <TouchableOpacity
                  key={user._id}
                  style={styles.memberChip}
                  onPress={() => toggleSelectUser(user._id?.toString())}
                  activeOpacity={0.75}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(user.avatar) || FALLBACK_AVATAR }}
                    style={styles.chipAvatar}
                  />
                  <Text style={styles.chipName} numberOfLines={1}>
                    {user.channelName || user.name}
                  </Text>
                  <Ionicons name="close-circle" size={16} color={Colors.textGray} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Search Contacts Bar */}
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

        {/* Members Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Add Members {selectedUserIds.length > 0 ? `(${selectedUserIds.length} selected)` : ''}
          </Text>
          <Text style={styles.sectionSubtitle}>
            Only users with whom you have chatted and accepted can be added
          </Text>
        </View>

        {/* Contacts FlatList */}
        {loadingContacts ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading your contacts...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={Colors.textGray} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No contacts match search' : 'No eligible contacts yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Connect with people on Bideo by chatting. Once they accept your message request, they will appear here to add to your group!'}
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
  headerCreateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCreateBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  headerCreateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  avatarPicker: {
    position: 'relative',
    marginRight: 14,
  },
  groupAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  inputsColumn: {
    flex: 1,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
  },
  descInput: {
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 6,
    minHeight: 36,
  },
  selectedRowContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  selectedRowScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  chipName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 4,
    maxWidth: 90,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
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
