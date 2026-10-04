import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../constants/Colors';
import VerifiedBadge from './VerifiedBadge';
import { showAlert } from './AppAlert';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { chatService, resolveMediaUrl } from '../services/api';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=Group';

interface GroupInfoModalProps {
  visible: boolean;
  conversation: any;
  currentUserId: string;
  onClose: () => void;
  onOpenAddMembers: () => void;
  onGroupUpdated: (updatedGroup: any) => void;
  onLeftGroup: () => void;
}

export default function GroupInfoModal({
  visible,
  conversation,
  currentUserId,
  onClose,
  onOpenAddMembers,
  onGroupUpdated,
  onLeftGroup,
}: GroupInfoModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [memberActionVisible, setMemberActionVisible] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [updating, setUpdating] = useState(false);

  if (!conversation) return null;

  const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
  const groupAdmins = Array.isArray(conversation.groupAdmins) ? conversation.groupAdmins : [];
  const adminIds = new Set(groupAdmins.map((a: any) => (a?._id || a)?.toString()));

  const isCurrentAdmin = adminIds.has(currentUserId);
  const creatorId = (conversation.groupCreator?._id || conversation.groupCreator || conversation.initiator)?.toString();
  const isCurrentCreator = creatorId === currentUserId;

  const handlePickAvatar = async () => {
    if (!isCurrentAdmin) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission Required', 'Please allow media library access to update the group photo.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        const filename = uri.split('/').pop() || `group_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match?.[1] ? match[1].toLowerCase() : 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const formData = new FormData();
        // @ts-ignore
        formData.append('avatar', {
          uri,
          name: filename,
          type: mimeType,
        });

        setUpdating(true);
        const updated = await chatService.updateGroupDetails(conversation._id, formData);
        hapticLight();
        onGroupUpdated(updated);
      }
    } catch (err: any) {
      console.warn('[GroupInfoModal] Error updating avatar:', err);
      showAlert('Update Failed', err?.response?.data?.message || 'Could not update group photo.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (trimmed.length < 2) {
      showAlert('Invalid Name', 'Group name must be at least 2 characters long.');
      return;
    }
    try {
      setUpdating(true);
      const updated = await chatService.updateGroupDetails(conversation._id, { name: trimmed });
      hapticLight();
      setIsEditingName(false);
      onGroupUpdated(updated);
    } catch (err: any) {
      showAlert('Update Failed', err?.response?.data?.message || 'Could not update group name.');
    } finally {
      setUpdating(false);
    }
  };

  const handleMemberAction = (member: any) => {
    const mId = (member?._id || member)?.toString();
    if (mId === currentUserId) return; // Cannot action oneself from list
    setSelectedMember(member);
    setMemberActionVisible(true);
  };

  const handlePromoteAdmin = async () => {
    if (!selectedMember?._id) return;
    try {
      setMemberActionVisible(false);
      hapticLight();
      const updated = await chatService.updateGroupAdminRole(conversation._id, selectedMember._id, 'promote');
      onGroupUpdated(updated);
    } catch (err: any) {
      showAlert('Failed', err?.response?.data?.message || 'Could not promote member to admin.');
    }
  };

  const handleDemoteAdmin = async () => {
    if (!selectedMember?._id) return;
    try {
      setMemberActionVisible(false);
      hapticLight();
      const updated = await chatService.updateGroupAdminRole(conversation._id, selectedMember._id, 'demote');
      onGroupUpdated(updated);
    } catch (err: any) {
      showAlert('Failed', err?.response?.data?.message || 'Could not remove admin role.');
    }
  };

  const handleRemoveMember = () => {
    if (!selectedMember?._id) return;
    const memberName = selectedMember.channelName || selectedMember.name || 'Member';

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setMemberActionVisible(false);
              hapticMedium();
              const updated = await chatService.removeGroupMember(conversation._id, selectedMember._id);
              onGroupUpdated(updated);
            } catch (err: any) {
              showAlert('Failed', err?.response?.data?.message || 'Could not remove member.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? You will no longer receive messages or be able to participate unless an admin adds you back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Group',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await chatService.leaveGroup(conversation._id, currentUserId);
              onClose();
              onLeftGroup();
            } catch (err: any) {
              showAlert('Failed to Leave', err?.response?.data?.message || 'Could not leave group.');
            }
          },
        },
      ]
    );
  };

  const selectedMemberId = (selectedMember?._id || selectedMember)?.toString();
  const isSelectedMemberAdmin = adminIds.has(selectedMemberId);
  const isSelectedMemberCreator = selectedMemberId === creatorId;

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
        {/* Top Navigation */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Info</Text>
          <View style={{ width: 32 }} />
        </View>

        <FlatList
          data={participants}
          keyExtractor={(item) => (item?._id || item)?.toString()}
          ListHeaderComponent={
            <View style={styles.profileHeader}>
              {/* Avatar with Camera badge if admin */}
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handlePickAvatar}
                disabled={!isCurrentAdmin || updating}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: resolveMediaUrl(conversation.groupAvatar) || FALLBACK_AVATAR }}
                  style={styles.groupAvatar}
                  contentFit="cover"
                />
                {isCurrentAdmin && (
                  <View style={styles.avatarEditBadge}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                )}
                {updating && (
                  <View style={styles.updatingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Group Name (Inline edit if admin) */}
              {isEditingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={editedName}
                    onChangeText={setEditedName}
                    maxLength={60}
                    autoFocus
                  />
                  <TouchableOpacity onPress={handleSaveName} style={styles.nameSaveBtn}>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsEditingName(false)}
                    style={styles.nameCancelBtn}
                  >
                    <Ionicons name="close" size={18} color={Colors.textGray} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.groupNameText}>{conversation.groupName || 'Group'}</Text>
                  {isCurrentAdmin && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditedName(conversation.groupName || '');
                        setIsEditingName(true);
                      }}
                      style={styles.editNameBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Description */}
              {Boolean(conversation.groupDescription) && (
                <Text style={styles.groupDescText}>{conversation.groupDescription}</Text>
              )}

              {/* Stats Bar */}
              <View style={styles.statsRow}>
                <View style={styles.statBadge}>
                  <Ionicons name="people" size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.statText}>{participants.length} Members</Text>
                </View>
                <View style={styles.statBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#F97316" style={{ marginRight: 4 }} />
                  <Text style={styles.statText}>{groupAdmins.length} Admins</Text>
                </View>
              </View>

              {/* Add Members Action (Admin only) */}
              {isCurrentAdmin && (
                <TouchableOpacity
                  style={styles.addMembersCard}
                  onPress={onOpenAddMembers}
                  activeOpacity={0.8}
                >
                  <View style={styles.addMembersIconCircle}>
                    <Ionicons name="person-add" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addMembersTitle}>Add Members</Text>
                    <Text style={styles.addMembersSubtitle}>
                      Add from your active connected contacts
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
                </TouchableOpacity>
              )}

              <View style={styles.membersSectionHeader}>
                <Text style={styles.membersSectionTitle}>Members ({participants.length})</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const memberId = (item?._id || item)?.toString();
            const isSelf = memberId === currentUserId;
            const isAdmin = adminIds.has(memberId);
            const isCreator = memberId === creatorId;
            const displayName = item?.channelName || item?.name || 'Member';

            return (
              <TouchableOpacity
                style={styles.memberItem}
                onPress={() => (isCurrentAdmin && !isSelf ? handleMemberAction(item) : null)}
                activeOpacity={isCurrentAdmin && !isSelf ? 0.7 : 1}
              >
                <Image
                  source={{ uri: resolveMediaUrl(item?.avatar) || FALLBACK_AVATAR }}
                  style={styles.memberAvatar}
                />
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {displayName} {isSelf && '(You)'}
                    </Text>
                    {item?.isVerified && <VerifiedBadge size={13} style={{ marginLeft: 4 }} />}
                  </View>
                  <Text style={styles.memberHandle} numberOfLines={1}>
                    @{item?.name || 'user'}
                  </Text>
                </View>

                {/* Role Badge */}
                {isCreator ? (
                  <View style={[styles.roleBadge, styles.roleBadgeCreator]}>
                    <Text style={[styles.roleText, styles.roleTextCreator]}>Creator</Text>
                  </View>
                ) : isAdmin ? (
                  <View style={[styles.roleBadge, styles.roleBadgeAdmin]}>
                    <Text style={[styles.roleText, styles.roleTextAdmin]}>Admin</Text>
                  </View>
                ) : null}

                {isCurrentAdmin && !isSelf && (
                  <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textGray} style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <View style={styles.footerSection}>
              <TouchableOpacity
                style={styles.leaveGroupBtn}
                onPress={handleLeaveGroup}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={styles.leaveGroupText}>Exit Group</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Member Action Modal (Admin management of a member) */}
        <Modal
          visible={memberActionVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMemberActionVisible(false)}
        >
          <TouchableOpacity
            style={styles.actionModalOverlay}
            activeOpacity={1}
            onPress={() => setMemberActionVisible(false)}
          >
            <View style={styles.actionSheetCard}>
              <Text style={styles.actionSheetTitle}>
                {selectedMember?.channelName || selectedMember?.name}
              </Text>

              {/* View Channel */}
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setMemberActionVisible(false);
                  onClose();
                  if (selectedMember?._id) {
                    router.push(`/channel/${selectedMember._id}`);
                  }
                }}
              >
                <Ionicons name="person-circle-outline" size={20} color={Colors.text} style={{ marginRight: 12 }} />
                <Text style={styles.actionRowText}>View Channel Profile</Text>
              </TouchableOpacity>

              {/* Admin Promote / Demote */}
              {isCurrentAdmin && (
                <>
                  {!isSelectedMemberAdmin ? (
                    <TouchableOpacity style={styles.actionRow} onPress={handlePromoteAdmin}>
                      <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} style={{ marginRight: 12 }} />
                      <Text style={[styles.actionRowText, { color: Colors.primary, fontWeight: '600' }]}>
                        Make Group Admin
                      </Text>
                    </TouchableOpacity>
                  ) : !isSelectedMemberCreator ? (
                    <TouchableOpacity style={styles.actionRow} onPress={handleDemoteAdmin}>
                      <Ionicons name="shield-outline" size={20} color="#F97316" style={{ marginRight: 12 }} />
                      <Text style={[styles.actionRowText, { color: '#F97316' }]}>
                        Dismiss as Admin
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Remove from Group */}
                  {(!isSelectedMemberCreator || isCurrentCreator) && (
                    <TouchableOpacity style={styles.actionRow} onPress={handleRemoveMember}>
                      <Ionicons name="person-remove-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                      <Text style={[styles.actionRowText, { color: '#EF4444', fontWeight: '600' }]}>
                        Remove from Group
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity
                style={styles.actionCancelBtn}
                onPress={() => setMemberActionVisible(false)}
              >
                <Text style={styles.actionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerCloseBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#F8FAFC',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  groupAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E5E7EB',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  groupNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  editNameBtn: {
    marginLeft: 8,
    padding: 2,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    paddingVertical: 4,
    marginRight: 8,
  },
  nameSaveBtn: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  nameCancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDescText: {
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  addMembersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 18,
    width: '92%',
  },
  addMembersIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addMembersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  addMembersSubtitle: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  membersSectionHeader: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  membersSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  memberHandle: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleBadgeCreator: {
    backgroundColor: '#FEF3C7',
  },
  roleTextCreator: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  roleBadgeAdmin: {
    backgroundColor: '#EFF6FF',
  },
  roleTextAdmin: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  footerSection: {
    padding: 24,
    alignItems: 'center',
  },
  leaveGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  leaveGroupText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  actionRowText: {
    fontSize: 15,
    color: Colors.text,
  },
  actionCancelBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  actionCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
});
