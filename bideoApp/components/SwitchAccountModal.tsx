/**
 * SwitchAccountModal
 *
 * A bottom-sheet style modal that lists all stored Bideo accounts, lets the
 * user switch between them with a single tap, add a new account, or manage
 * (remove) saved accounts. Matches the app's brand theme (orange/white).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Colors from '../constants/Colors';
import {
  StoredAccount,
  getStoredAccounts,
  switchToAccount,
  removeStoredAccount,
  logoutCurrentAccount,
  logoutAllAccounts,
} from '../services/accountManager';
import { showAlert } from './AppAlert';
import VerifiedBadge from './VerifiedBadge';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Avatar helper (same logic as library.tsx) ────────────────────────────────
const getAvatarUri = (avatar?: string | null): string | null => {
  if (!avatar) return null;
  const value = avatar.trim();
  if (!value || value === 'default-avatar.png') return null;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('content://') ||
    value.startsWith('data:image/')
  ) {
    return value;
  }
  return null;
};

interface SwitchAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onAddAccount: () => void;
}

const SwitchAccountModal: React.FC<SwitchAccountModalProps> = ({
  visible,
  onClose,
  onAddAccount,
}) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const loadAccounts = useCallback(async () => {
    const stored = await getStoredAccounts();
    setAccounts(stored);
  }, []);

  useEffect(() => {
    if (visible) {
      loadAccounts();
      setManageMode(false);
      setSwitching(null);
      // Animate slide up
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Animate slide down
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, loadAccounts, slideAnim]);

  const handleSwitch = useCallback(
    async (targetId: string) => {
      if (targetId === user?._id) {
        onClose();
        return;
      }
      setSwitching(targetId);
      try {
        const success = await switchToAccount(targetId, dispatch);
        if (!success) {
          showAlert(
            'Switch Failed',
            'This account session has expired. Please sign in again.',
          );
          // Refresh the list (the expired account was removed)
          await loadAccounts();
        } else {
          onClose();
        }
      } catch {
        showAlert('Error', 'Something went wrong while switching accounts.');
      } finally {
        setSwitching(null);
      }
    },
    [user?._id, dispatch, onClose, loadAccounts],
  );

  const handleRemoveAccount = useCallback(
    async (accountId: string) => {
      const account = accounts.find((a) => a.id === accountId);
      const displayName = account?.channelName || account?.name || 'this account';

      showAlert(
        'Remove Account',
        `Remove @${displayName} from this device? You'll need to sign in again to use it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              if (accountId === user?._id) {
                // Removing the active account — log out and switch
                const switched = await logoutCurrentAccount(dispatch, accountId);
                if (!switched) {
                  onClose();
                }
              } else {
                await removeStoredAccount(accountId);
              }
              await loadAccounts();
            },
          },
        ],
      );
    },
    [accounts, user?._id, dispatch, onClose, loadAccounts],
  );

  const handleLogoutAll = useCallback(() => {
    showAlert(
      'Log Out of All Accounts',
      'This will sign you out of all accounts on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All',
          style: 'destructive',
          onPress: async () => {
            await logoutAllAccounts(dispatch);
            onClose();
          },
        },
      ],
    );
  }, [dispatch, onClose]);

  const handleAddAccount = useCallback(() => {
    onClose();
    // Small delay to let the modal close animation finish
    setTimeout(() => {
      onAddAccount();
    }, 300);
  }, [onClose, onAddAccount]);

  const activeId = user?._id;
  const otherAccounts = accounts.filter((a) => a.id !== activeId);
  const activeAccount = accounts.find((a) => a.id === activeId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              style={[
                styles.sheet,
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Title */}
              <View style={styles.titleRow}>
                <Text style={styles.title}>Accounts</Text>
                {accounts.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setManageMode(!manageMode)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.manageText}>
                      {manageMode ? 'Done' : 'Manage'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Active account */}
              {activeAccount && (
                <View style={styles.accountRow}>
                  <View style={styles.accountLeft}>
                    {getAvatarUri(activeAccount.avatar) ? (
                      <Image
                        source={{ uri: getAvatarUri(activeAccount.avatar)! }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Ionicons
                          name="person"
                          size={20}
                          color={Colors.textGray}
                        />
                      </View>
                    )}
                    <View style={styles.accountInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.channelName} numberOfLines={1}>
                          {activeAccount.channelName || activeAccount.name}
                        </Text>
                        {activeAccount.isVerified && (
                          <VerifiedBadge size={14} style={{ marginLeft: 3 }} />
                        )}
                      </View>
                      <Text style={styles.handle} numberOfLines={1}>
                        @{activeAccount.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.activeIndicator}>
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={Colors.primary}
                    />
                  </View>
                </View>
              )}

              {/* Divider */}
              {otherAccounts.length > 0 && <View style={styles.divider} />}

              {/* Other accounts */}
              {otherAccounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.accountRow}
                  onPress={() => {
                    if (!manageMode && !switching) {
                      handleSwitch(account.id);
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={!!switching}
                >
                  <View style={styles.accountLeft}>
                    {getAvatarUri(account.avatar) ? (
                      <Image
                        source={{ uri: getAvatarUri(account.avatar)! }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Ionicons
                          name="person"
                          size={20}
                          color={Colors.textGray}
                        />
                      </View>
                    )}
                    <View style={styles.accountInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.channelName} numberOfLines={1}>
                          {account.channelName || account.name}
                        </Text>
                        {account.isVerified && (
                          <VerifiedBadge size={14} style={{ marginLeft: 3 }} />
                        )}
                      </View>
                      <Text style={styles.handle} numberOfLines={1}>
                        @{account.name}
                      </Text>
                    </View>
                  </View>
                  {switching === account.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : manageMode ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveAccount(account.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.removeBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color="#FF3B30"
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.activeIndicator}>
                      <Ionicons
                        name="ellipse-outline"
                        size={22}
                        color="#D1D5DB"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Add account button */}
              <TouchableOpacity
                style={styles.addAccountRow}
                onPress={handleAddAccount}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, styles.addAvatar]}>
                  <Ionicons name="add" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.addAccountText}>Add Account</Text>
              </TouchableOpacity>

              {/* Log out all - only show when multiple accounts */}
              {accounts.length > 1 && (
                <TouchableOpacity
                  style={styles.logoutAllRow}
                  onPress={handleLogoutAll}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color="#FF3B30"
                  />
                  <Text style={styles.logoutAllText} numberOfLines={1}>
                    Log out of all accounts
                  </Text>
                </TouchableOpacity>
              )}

              {/* Bottom safe area padding */}
              <View style={{ height: 20 }} />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default SwitchAccountModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: SCREEN_HEIGHT * 0.65,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  manageText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  handle: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 1,
  },
  activeIndicator: {
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  removeBtn: {
    padding: 4,
  },
  addAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addAvatar: {
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  addAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 12,
  },
  logoutAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 6,
  },
  logoutAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
});
