import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
  StatusBar,
  Modal,
  Alert,
  Keyboard,
  Linking,
  Animated,
  PanResponder,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import * as Clipboard from 'expo-clipboard';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import { chatService, resolveMediaUrl } from '../../services/api';
import {
  joinConversationRoom,
  leaveConversationRoom,
  emitTyping,
  requestOnlineStatus,
} from '../../services/socket';
import VerifiedBadge from '../../components/VerifiedBadge';
import GroupInfoModal from '../../components/GroupInfoModal';
import AddGroupMembersModal from '../../components/AddGroupMembersModal';
import { showAlert } from '../../components/AppAlert';
import { hapticLight, hapticSelection } from '../../utils/haptics';
import { AppAdBanner } from '../../components/AppAds';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';
const FALLBACK_THUMBNAIL = 'https://via.placeholder.com/640x360.png?text=Bideo';

export interface ChatTheme {
  id: string;
  name: string;
  previewColors: [string, string];
  bubbleMineGradient: [string, string];
  bubbleMineText: string;
  bubbleOtherBg: string;
  bubbleOtherText: string;
  screenBg: string;
  primary: string;
  inputBg: string;
  inputText: string;
  accentBar: string;
}

export const CHAT_THEMES: Record<string, ChatTheme> = {
  default: {
    id: 'default',
    name: 'Classic Bideo',
    previewColors: ['#FF0033', '#CC0029'],
    bubbleMineGradient: ['#FF0033', '#CC0029'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#F3F4F6',
    bubbleOtherText: '#111827',
    screenBg: '#F9FAFB',
    primary: '#FF0033',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#FF0033',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Glow',
    previewColors: ['#FF512F', '#DD2476'],
    bubbleMineGradient: ['#FF512F', '#DD2476'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#FFF1F2',
    bubbleOtherText: '#881337',
    screenBg: '#FFF5F5',
    primary: '#DD2476',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#FF512F',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    previewColors: ['#00C0FF', '#4286F4'],
    bubbleMineGradient: ['#00C0FF', '#4286F4'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#F0F9FF',
    bubbleOtherText: '#0C4A6E',
    screenBg: '#F8FAFC',
    primary: '#0284C7',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#00C0FF',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Neon',
    previewColors: ['#8A2387', '#E94057'],
    bubbleMineGradient: ['#8A2387', '#E94057'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#FDF4FF',
    bubbleOtherText: '#701A75',
    screenBg: '#FAF5FF',
    primary: '#A855F7',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#8A2387',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Mint',
    previewColors: ['#11998E', '#38EF7D'],
    bubbleMineGradient: ['#11998E', '#38EF7D'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#ECFDF5',
    bubbleOtherText: '#064E3B',
    screenBg: '#F0FDF4',
    primary: '#059669',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#11998E',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Blossom',
    previewColors: ['#FF758C', '#FF7EB3'],
    bubbleMineGradient: ['#FF758C', '#FF7EB3'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#FFF0F5',
    bubbleOtherText: '#831843',
    screenBg: '#FFF5F7',
    primary: '#DB2777',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#FF758C',
  },
  amber: {
    id: 'amber',
    name: 'Cyber Amber',
    previewColors: ['#F2994A', '#F2C94C'],
    bubbleMineGradient: ['#F2994A', '#F2C94C'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#FEFCE8',
    bubbleOtherText: '#713F12',
    screenBg: '#FFFBEB',
    primary: '#D97706',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#F2994A',
  },
  slate: {
    id: 'slate',
    name: 'Steel Slate',
    previewColors: ['#475569', '#1E293B'],
    bubbleMineGradient: ['#475569', '#1E293B'],
    bubbleMineText: '#FFFFFF',
    bubbleOtherBg: '#F1F5F9',
    bubbleOtherText: '#0F172A',
    screenBg: '#F8FAFC',
    primary: '#334155',
    inputBg: '#FFFFFF',
    inputText: '#111827',
    accentBar: '#475569',
  },
};

const SwipeableMessageBubble = ({
  children,
  onSwipeReply,
  isMine,
  themeColor,
}: {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMine: boolean;
  themeColor: string;
}) => {
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 16 &&
            Math.abs(gestureState.dy) < 14
          );
        },
        onPanResponderMove: (_, gestureState) => {
          const maxDrag = 65;
          let clampedX = 0;
          if (gestureState.dx > 0) {
            clampedX = Math.min(gestureState.dx * 0.75, maxDrag);
          } else {
            clampedX = Math.max(gestureState.dx * 0.75, -maxDrag);
          }
          panX.setValue(clampedX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const threshold = 36;
          if (Math.abs(gestureState.dx) >= threshold) {
            hapticLight();
            onSwipeReply();
          }
          Animated.spring(panX, {
            toValue: 0,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(panX, {
            toValue: 0,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onSwipeReply]
  );

  return (
    <View style={styles.swipeContainer}>
      <Animated.View
        style={[
          styles.swipeReplyIconBox,
          isMine ? styles.swipeReplyIconRight : styles.swipeReplyIconLeft,
          {
            backgroundColor: themeColor,
            opacity: panX.interpolate({
              inputRange: [-45, -20, 0, 20, 45],
              outputRange: [1, 0.5, 0, 0.5, 1],
            }),
            transform: [
              {
                scale: panX.interpolate({
                  inputRange: [-45, -20, 0, 20, 45],
                  outputRange: [1, 0.8, 0.4, 0.8, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={17} color="#FFFFFF" />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX: panX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
};

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    isVerified?: string;
    isGroup?: string;
  }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);
  const [groupInfoModalVisible, setGroupInfoModalVisible] = useState(false);
  const [addMembersModalVisible, setAddMembersModalVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const otherParticipantIdRef = useRef<string | null>(null);

  const currentUserId = user?._id?.toString() || user?.id?.toString() || '';
  const currentThemeKey = conversation?.theme || 'default';
  const currentTheme = CHAT_THEMES[currentThemeKey] || CHAT_THEMES.default;

  // Track keyboard height to smoothly position input above keyboard
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 50);
    };

    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load conversation details and message history
  const loadData = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      const [convData, msgData] = await Promise.all([
        chatService.getConversationById(conversationId),
        chatService.getMessages(conversationId, 1, 100),
      ]);

      if (convData) {
        setConversation(convData);
        if (convData.otherParticipant?._id) {
          const targetId = convData.otherParticipant._id.toString();
          otherParticipantIdRef.current = targetId;
          if (convData.otherParticipant.isOnline !== undefined) {
            setIsOtherOnline(Boolean(convData.otherParticipant.isOnline));
          }
          requestOnlineStatus([targetId], (status) => {
            if (status && status[targetId] !== undefined) {
              setIsOtherOnline(Boolean(status[targetId]));
            }
          });
        }
      }

      if (msgData?.data) {
        setMessages(msgData.data);
      }

      // Mark conversation as read
      chatService.markAsRead(conversationId).catch(() => {});
      DeviceEventEmitter.emit('chatViewed');
    } catch (err: any) {
      console.error('Failed to load chat data:', err);
      showAlert('Chat', err?.response?.data?.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadData();

    if (conversationId) {
      joinConversationRoom(conversationId);
    }

    // Socket Event Subscriptions
    const subMsg = DeviceEventEmitter.addListener('chatMessageReceived', (newMsg: any) => {
      const msgConvId =
        (newMsg?.conversationId || newMsg?.conversation)?._id ||
        newMsg?.conversationId ||
        newMsg?.conversation;

      if (msgConvId?.toString() === conversationId?.toString()) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 50);

        // If active in screen, mark as read immediately
        chatService.markAsRead(conversationId).catch(() => {});
        DeviceEventEmitter.emit('chatViewed');
      }
    });

    const subTyping = DeviceEventEmitter.addListener(
      'chatUserTyping',
      (data: { conversationId: string; senderId: string; isTyping: boolean }) => {
        if (
          data?.conversationId?.toString() === conversationId?.toString() &&
          data.senderId?.toString() !== currentUserId
        ) {
          setIsOtherTyping(Boolean(data.isTyping));
        }
      }
    );

    const subStatus = DeviceEventEmitter.addListener(
      'chatUserStatusChanged',
      (data: { userId: string; isOnline: boolean }) => {
        const targetId = otherParticipantIdRef.current;
        if (targetId && data?.userId?.toString() === targetId) {
          setIsOtherOnline(Boolean(data.isOnline));
        }
      }
    );

    const subOnlineStatus = DeviceEventEmitter.addListener(
      'chatOnlineUsersStatus',
      (statusMap: Record<string, boolean>) => {
        const targetId = otherParticipantIdRef.current;
        if (targetId && statusMap && statusMap[targetId] !== undefined) {
          setIsOtherOnline(Boolean(statusMap[targetId]));
        }
      }
    );

    const subSocketConnected = DeviceEventEmitter.addListener('socketConnected', () => {
      if (conversationId) {
        joinConversationRoom(conversationId);
      }
      const targetId = otherParticipantIdRef.current;
      if (targetId) {
        requestOnlineStatus([targetId], (status) => {
          if (status && status[targetId] !== undefined) {
            setIsOtherOnline(Boolean(status[targetId]));
          }
        });
      }
      if (conversationId) {
        chatService.markAsRead(conversationId).catch(() => {});
      }
    });

    const subConvStatus = DeviceEventEmitter.addListener(
      'chatConversationStatusChanged',
      (data: { conversationId: string; status: string; blockedBy?: string }) => {
        if (data?.conversationId?.toString() === conversationId?.toString()) {
          setConversation((prev: any) => ({
            ...prev,
            status: data.status,
            blockedBy: data.blockedBy ?? prev?.blockedBy,
            isBlockedByMe: data.status === 'blocked' && data.blockedBy?.toString() === currentUserId,
            isBlockedByOther: data.status === 'blocked' && data.blockedBy?.toString() !== currentUserId,
          }));
        }
      }
    );

    const subRead = DeviceEventEmitter.addListener(
      'chatMessagesRead',
      (data: { conversationId: string; readBy: string }) => {
        if (
          data?.conversationId?.toString() === conversationId?.toString() &&
          data.readBy?.toString() !== currentUserId
        ) {
          setMessages((prev) =>
            prev.map((m) => {
              const senderId = (m.sender?._id || m.sender)?.toString();
              return senderId === currentUserId ? { ...m, isRead: true } : m;
            })
          );
        }
      }
    );

    const subUnsend = DeviceEventEmitter.addListener(
      'chatMessageUnsent',
      (data: { conversationId: string; messageId: string }) => {
        if (data?.conversationId?.toString() === conversationId?.toString()) {
          setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
        }
      }
    );

    const subDeleteForMe = DeviceEventEmitter.addListener(
      'chatMessageDeletedForMe',
      (data: { conversationId: string; messageId: string }) => {
        if (data?.conversationId?.toString() === conversationId?.toString()) {
          setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
        }
      }
    );

    const subGroupMembers = DeviceEventEmitter.addListener(
      'chatGroupMembersUpdated',
      (updatedGroup: any) => {
        if (updatedGroup?._id?.toString() === conversationId?.toString()) {
          setConversation((prev: any) => ({ ...prev, ...updatedGroup }));
        }
      }
    );

    const subGroupDetails = DeviceEventEmitter.addListener(
      'chatGroupDetailsUpdated',
      (updatedGroup: any) => {
        if (updatedGroup?._id?.toString() === conversationId?.toString()) {
          setConversation((prev: any) => ({ ...prev, ...updatedGroup }));
        }
      }
    );

    const subConvRemoved = DeviceEventEmitter.addListener(
      'chatConversationRemoved',
      (data: { conversationId: string }) => {
        if (data?.conversationId?.toString() === conversationId?.toString()) {
          showAlert('Group', 'You are no longer a member of this group.');
          router.back();
        }
      }
    );

    const subTheme = DeviceEventEmitter.addListener(
      'chatThemeChanged',
      (data: { conversationId: string; theme: string }) => {
        if (data?.conversationId?.toString() === conversationId?.toString()) {
          setConversation((prev: any) => ({
            ...prev,
            theme: data.theme,
          }));
        }
      }
    );

    return () => {
      if (conversationId) {
        leaveConversationRoom(conversationId);
      }
      subMsg.remove();
      subTyping.remove();
      subStatus.remove();
      subOnlineStatus.remove();
      subSocketConnected.remove();
      subConvStatus.remove();
      subRead.remove();
      subUnsend.remove();
      subDeleteForMe.remove();
      subGroupMembers.remove();
      subGroupDetails.remove();
      subConvRemoved.remove();
      subTheme.remove();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, currentUserId, loadData]);

  // Handle typing debounce
  const handleInputChange = (text: string) => {
    setInputText(text);

    if (isGroup) {
      if (conversationId) {
        emitTyping(conversationId, '', true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          emitTyping(conversationId, '', false);
        }, 1500);
      }
      return;
    }

    const targetId = otherParticipantIdRef.current || conversation?.otherParticipant?._id;
    if (targetId && conversationId) {
      emitTyping(conversationId, targetId.toString(), true);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        emitTyping(conversationId, targetId.toString(), false);
      }, 1500);
    }
  };

  // Send message
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    if (isBlocked) {
      showAlert('Blocked', 'You cannot send messages in this conversation.');
      return;
    }

    hapticLight();
    setSending(true);
    setInputText('');

    // Stop typing indicator
    if (isGroup) {
      if (conversationId) emitTyping(conversationId, '', false);
    } else if (conversation?.otherParticipant?._id && conversationId) {
      emitTyping(conversationId, conversation.otherParticipant._id, false);
    }

    const replyPayload = replyingTo
      ? {
          message: replyingTo._id,
          senderName:
            (replyingTo.sender?._id || replyingTo.sender)?.toString() === currentUserId
              ? 'You'
              : replyingTo.sender?.channelName || replyingTo.sender?.name || 'User',
          text: replyingTo.text || (replyingTo.video ? '🎥 Video' : replyingTo.post ? '📝 Post' : 'Message'),
        }
      : undefined;

    setReplyingTo(null);

    try {
      const newMsg = await chatService.sendMessage({
        conversationId,
        text: trimmed,
        replyTo: replyPayload,
      });

      if (newMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 50);
      }
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to send message');
      setInputText(trimmed); // Restore message
    } finally {
      setSending(false);
    }
  };

  const handleSelectTheme = async (themeKey: string) => {
    hapticSelection();
    setThemeModalVisible(false);
    setConversation((prev: any) => ({ ...prev, theme: themeKey }));
    try {
      await chatService.updateChatTheme(conversationId, themeKey);
    } catch (err: any) {
      showAlert('Theme Error', err?.response?.data?.message || 'Failed to change theme');
    }
  };

  const scrollToMessage = (targetMessageId: string) => {
    if (!targetMessageId) return;
    const targetIdx = reversedMessages.findIndex(
      (m) => (m._id || m.id)?.toString() === targetMessageId.toString()
    );
    if (targetIdx !== -1) {
      hapticLight();
      try {
        flatListRef.current?.scrollToIndex({
          index: targetIdx,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        flatListRef.current?.scrollToOffset({
          offset: targetIdx * 65,
          animated: true,
        });
      }
    }
  };

  // Accept message request (Continue chat)
  const handleAccept = async () => {
    setMenuVisible(false);
    try {
      hapticSelection();
      const updated = await chatService.acceptChat(conversationId);
      setConversation((prev: any) => ({
        ...prev,
        ...updated,
        status: 'accepted',
        blockedBy: null,
        isBlockedByMe: false,
        isBlockedByOther: false,
      }));
      showAlert('Request Accepted', 'You can now chat freely with this user.');
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to accept chat');
    }
  };

  // Decline / Dismiss message request or conversation
  const handleDecline = () => {
    setMenuVisible(false);
    Alert.alert(
      'Dismiss Chat',
      'Are you sure you want to dismiss this chat? It will be removed from your active conversations list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSelection();
              await chatService.declineChat(conversationId);
              router.back();
            } catch (err: any) {
              showAlert('Error', err?.response?.data?.message || 'Failed to dismiss chat');
            }
          },
        },
      ]
    );
  };

  // Unsend message for everyone
  const handleUnsendMessage = () => {
    if (!selectedMessage) return;
    const msgId = selectedMessage._id;
    setMessageActionModalVisible(false);
    setSelectedMessage(null);

    Alert.alert(
      'Unsend Message',
      'Are you sure you want to unsend this message? It will be removed for everyone in this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsend',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSelection();
              await chatService.unsendMessage(msgId);
              setMessages((prev) => prev.filter((m) => m._id !== msgId));
            } catch (err: any) {
              showAlert('Error', err?.response?.data?.message || 'Failed to unsend message');
            }
          },
        },
      ]
    );
  };

  // Delete message for current user only
  const handleDeleteMessage = () => {
    if (!selectedMessage) return;
    const msgId = selectedMessage._id;
    setMessageActionModalVisible(false);
    setSelectedMessage(null);

    Alert.alert(
      'Delete Message',
      'This message will be deleted for you. Other participants will still be able to see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for me',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSelection();
              await chatService.deleteMessage(msgId);
              setMessages((prev) => prev.filter((m) => m._id !== msgId));
            } catch (err: any) {
              showAlert('Error', err?.response?.data?.message || 'Failed to delete message');
            }
          },
        },
      ]
    );
  };

  // Copy message text to clipboard
  const handleCopyMessageText = async () => {
    if (!selectedMessage?.text) return;
    try {
      await Clipboard.setStringAsync(selectedMessage.text);
      hapticLight();
    } catch {}
    setMessageActionModalVisible(false);
    setSelectedMessage(null);
  };

  // Block user
  const handleBlock = async () => {
    setMenuVisible(false);
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? They will not be able to message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticSelection();
              const updated = await chatService.blockUser(conversationId);
              setConversation((prev: any) => ({
                ...prev,
                ...updated,
                status: 'blocked',
                blockedBy: currentUserId,
                isBlockedByMe: true,
              }));
              showAlert('Blocked', 'User has been blocked.');
            } catch (err: any) {
              showAlert('Error', err?.response?.data?.message || 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  // Unblock user
  const handleUnblock = async () => {
    setMenuVisible(false);
    try {
      hapticSelection();
      const updated = await chatService.unblockUser(conversationId);
      setConversation((prev: any) => ({
        ...prev,
        ...updated,
        status: 'accepted',
        blockedBy: null,
        isBlockedByMe: false,
        isBlockedByOther: false,
      }));
      showAlert('Unblocked', 'User has been unblocked.');
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to unblock user');
    }
  };

  const isGroup = Boolean(params.isGroup === '1' || conversation?.isGroup);
  const other = conversation?.otherParticipant;
  const displayName = isGroup
    ? (conversation?.groupName || params.name || 'Group Chat')
    : (other?.channelName || other?.name || params.name || 'Chat');
  const rawAvatar = isGroup
    ? (conversation?.groupAvatar || params.avatar)
    : (other?.avatar || params.avatar);
  const displayAvatar = rawAvatar ? resolveMediaUrl(rawAvatar) : FALLBACK_AVATAR;
  const isVerifiedUser = !isGroup && Boolean(other?.isVerified ?? (params.isVerified === '1'));
  const isInitiator = !isGroup && conversation?.initiator?.toString() === currentUserId;
  const isPendingForMe = !isGroup && conversation?.status === 'pending' && !isInitiator;
  const isBlocked = !isGroup && conversation?.status === 'blocked';
  const isBlockedByMe = isBlocked && Boolean(conversation?.isBlockedByMe || (conversation?.blockedBy ? conversation.blockedBy.toString() === currentUserId : true));
  const isBlockedByOther = isBlocked && !isBlockedByMe;

  const formatDuration = (seconds: number) => {
    let totalSecs = Math.round(Number(seconds) || 0);
    if (totalSecs > 1000) totalSecs = Math.round(totalSecs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const parseTextWithLinks = (text: string) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts: { type: 'text' | 'link'; value: string }[] = [];
    let lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'link', value: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.substring(lastIndex) });
    }
    return parts;
  };

  const handleLinkPress = async (rawUrl: string) => {
    let url = rawUrl.trim();
    if (url.startsWith('www.')) {
      url = `https://${url}`;
    }

    // Check for internal Bideo video link (/v/:id or /video/:id)
    const videoMatch = url.match(/(?:bideo\.in|bideo\.app|\/)\/(?:v|video)\/([a-zA-Z0-9_-]+)/i);
    if (videoMatch && videoMatch[1]) {
      hapticSelection();
      router.push(`/v/${videoMatch[1]}`);
      return;
    }

    // Check for internal Bideo shorts link
    const shortsMatch = url.match(/(?:bideo\.in|bideo\.app|\/)\/shorts\/([a-zA-Z0-9_-]+)/i);
    if (shortsMatch && shortsMatch[1]) {
      hapticSelection();
      router.push({ pathname: '/shorts', params: { initialShortId: shortsMatch[1] } });
      return;
    }

    // Check for internal Bideo channel link (/c/:id or /channel/:id)
    const channelMatch = url.match(/(?:bideo\.in|bideo\.app|\/)\/(?:c|channel)\/([a-zA-Z0-9_-]+)/i);
    if (channelMatch && channelMatch[1]) {
      hapticSelection();
      router.push(`/channel/${channelMatch[1]}`);
      return;
    }

    // Check for internal Bideo post link (/p/:id or /post/:id)
    const postMatch = url.match(/(?:bideo\.in|bideo\.app|\/)\/(?:p|post)\/([a-zA-Z0-9_-]+)/i);
    if (postMatch && postMatch[1]) {
      hapticSelection();
      router.push(`/post/${postMatch[1]}`);
      return;
    }

    // External URL
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch {
      showAlert('Link Error', 'Unable to open this link: ' + url);
    }
  };

  const reversedMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  const renderMessageBubble = ({ item }: { item: any }) => {
    // Check if system message
    if (item.system) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessagePill}>
            <Text style={styles.systemMessageText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    const isMine =
      (item.sender?._id || item.sender)?.toString() === currentUserId;

    const timeFormatted = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const hasVideo = Boolean(item.video && item.video._id);
    const hasPost = Boolean(item.post && item.post._id);

    // If message text is just the URL of the attached media, hide redundant raw string
    const isRedundantMediaUrl =
      (hasVideo && item.text?.trim() === `https://bideo.in/v/${item.video._id}`) ||
      (hasPost && item.text?.trim() === `https://bideo.in/p/${item.post._id}`);

    const showText = Boolean(item.text && !isRedundantMediaUrl);
    const textParts = showText ? parseTextWithLinks(item.text) : [];

    const renderBubbleInner = () => (
      <>
        {/* Quoted Message / Replying To Snippet */}
        {Boolean(item.replyTo && (item.replyTo.text || item.replyTo.senderName)) && (
          <TouchableOpacity
            style={[
              styles.quotedMessageContainer,
              isMine ? styles.quotedMessageRight : styles.quotedMessageLeft,
            ]}
            activeOpacity={0.8}
            onPress={() => item.replyTo?.message && scrollToMessage(item.replyTo.message)}
          >
            <View
              style={[
                styles.quotedMessageBar,
                { backgroundColor: isMine ? '#FFFFFF' : currentTheme.primary },
              ]}
            />
            <View style={styles.quotedMessageContent}>
              <Text
                style={[
                  styles.quotedMessageSender,
                  { color: isMine ? '#FFFFFF' : currentTheme.primary },
                ]}
                numberOfLines={1}
              >
                {item.replyTo.senderName || 'Replied message'}
              </Text>
              <Text
                style={[
                  styles.quotedMessageText,
                  isMine ? styles.quotedMessageTextRight : styles.quotedMessageTextLeft,
                ]}
                numberOfLines={2}
              >
                {item.replyTo.text || 'Message'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Group Sender Name Header */}
        {isGroup && !isMine && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const sId = item.sender?._id || item.sender;
              if (sId) router.push(`/channel/${sId}`);
            }}
            style={styles.groupSenderNameRow}
          >
            <Text style={[styles.groupSenderNameText, { color: currentTheme.primary }]} numberOfLines={1}>
              {item.sender?.channelName || item.sender?.name || 'Member'}
            </Text>
            {Boolean(item.sender?.isVerified) && (
              <VerifiedBadge size={11} style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
        )}

        {/* Embedded Video Card */}
        {hasVideo && (
          <TouchableOpacity
            style={styles.embeddedMediaCard}
            activeOpacity={0.85}
            onPress={() => {
              hapticSelection();
              if (item.video.isShort) {
                router.push({ pathname: '/shorts', params: { initialShortId: item.video._id } });
              } else {
                router.push(`/v/${item.video._id}`);
              }
            }}
          >
            <View style={styles.embeddedThumbContainer}>
              <Image
                source={{ uri: resolveMediaUrl(item.video.thumbnail) || FALLBACK_THUMBNAIL }}
                style={styles.embeddedThumb}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.embeddedPlayOverlay}>
                <View style={styles.embeddedPlayBtn}>
                  <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
              </View>
              {item.video.duration > 0 && (
                <View style={styles.embeddedDurationBadge}>
                  <Text style={styles.embeddedDurationText}>
                    {formatDuration(item.video.duration)}
                  </Text>
                </View>
              )}
              {item.video.isShort && (
                <View style={styles.embeddedShortBadge}>
                  <Ionicons name="flash" size={10} color="#FFFFFF" />
                  <Text style={styles.embeddedShortText}>Short</Text>
                </View>
              )}
            </View>

            <View style={styles.embeddedInfo}>
              <Text
                style={[styles.embeddedTitle, isMine && styles.embeddedTitleRight]}
                numberOfLines={2}
              >
                {item.video.title || 'Shared Video'}
              </Text>

              {item.video.owner && (
                <View style={styles.embeddedOwnerRow}>
                  <Image
                    source={{ uri: resolveMediaUrl(item.video.owner.avatar) || FALLBACK_AVATAR }}
                    style={styles.embeddedOwnerAvatar}
                    contentFit="cover"
                  />
                  <Text
                    style={[styles.embeddedOwnerName, isMine && styles.embeddedOwnerNameRight]}
                    numberOfLines={1}
                  >
                    {item.video.owner.channelName || item.video.owner.name || 'Creator'}
                  </Text>
                  {Boolean(item.video.owner.isVerified) && (
                    <VerifiedBadge size={12} style={{ marginLeft: 3 }} />
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Embedded Post Card */}
        {hasPost && (
          <TouchableOpacity
            style={styles.embeddedPostCard}
            activeOpacity={0.85}
            onPress={() => {
              hapticSelection();
              router.push(`/post/${item.post._id}`);
            }}
          >
            <View style={styles.embeddedPostHeader}>
              <View style={styles.embeddedOwnerRow}>
                <Image
                  source={{ uri: resolveMediaUrl(item.post.author?.avatar) || FALLBACK_AVATAR }}
                  style={styles.embeddedOwnerAvatar}
                  contentFit="cover"
                />
                <Text
                  style={[styles.embeddedOwnerName, isMine && styles.embeddedOwnerNameRight]}
                  numberOfLines={1}
                >
                  {item.post.author?.channelName || item.post.author?.name || 'Creator'}
                </Text>
                {Boolean(item.post.author?.isVerified) && (
                  <VerifiedBadge size={12} style={{ marginLeft: 3 }} />
                )}
              </View>
              <View style={[styles.postBadgePill, isMine && styles.postBadgePillRight]}>
                <Text style={[styles.postBadgePillText, isMine && styles.postBadgePillTextRight]}>
                  Post
                </Text>
              </View>
            </View>

            {Boolean(item.post.text) && (
              <Text
                style={[styles.embeddedPostText, isMine && styles.embeddedPostTextRight]}
                numberOfLines={3}
              >
                {item.post.text}
              </Text>
            )}

            {Boolean(item.post.image || item.post.imageUrl) && (
              <Image
                source={{ uri: resolveMediaUrl(item.post.image || item.post.imageUrl) }}
                style={styles.embeddedPostImage}
                contentFit="cover"
                transition={150}
              />
            )}
          </TouchableOpacity>
        )}

        {/* Text message with clickable URLs */}
        {showText && (
          <Text
            style={[
              styles.bubbleText,
              isMine ? styles.bubbleTextRight : [styles.bubbleTextLeft, { color: currentTheme.bubbleOtherText }],
              (hasVideo || hasPost) && { marginTop: 4, paddingHorizontal: 6 },
            ]}
          >
            {textParts.map((part, idx) => {
              if (part.type === 'link') {
                return (
                  <Text
                    key={idx}
                    style={[
                      styles.bubbleLinkText,
                      isMine ? styles.bubbleLinkTextRight : [styles.bubbleLinkTextLeft, { color: currentTheme.primary }],
                    ]}
                    onPress={() => handleLinkPress(part.value)}
                  >
                    {part.value}
                  </Text>
                );
              }
              return <Text key={idx}>{part.value}</Text>;
            })}
          </Text>
        )}

        <View style={styles.bubbleFooter}>
          <Text
            style={[
              styles.bubbleTime,
              isMine ? styles.bubbleTimeRight : styles.bubbleTimeLeft,
            ]}
          >
            {timeFormatted}
          </Text>

          {isMine && (
            <Ionicons
              name={item.isRead ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={item.isRead ? '#93C5FD' : 'rgba(255,255,255,0.7)'}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </>
    );

    return (
      <SwipeableMessageBubble
        onSwipeReply={() => {
          hapticLight();
          setReplyingTo(item);
        }}
        isMine={isMine}
        themeColor={currentTheme.primary}
      >
        <View
          style={[
            styles.bubbleWrapper,
            isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
          ]}
        >
          {isGroup && !isMine && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                const sId = item.sender?._id || item.sender;
                if (sId) router.push(`/channel/${sId}`);
              }}
              style={styles.groupSenderAvatarTouch}
            >
              <Image
                source={{ uri: resolveMediaUrl(item.sender?.avatar) || FALLBACK_AVATAR }}
                style={styles.groupSenderAvatar}
                contentFit="cover"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.92}
            style={[
              styles.bubbleTouch,
              isMine ? styles.bubbleTouchRight : styles.bubbleTouchLeft,
              (hasVideo || hasPost) && styles.bubbleTouchMedia,
            ]}
            onLongPress={() => {
              hapticSelection();
              setSelectedMessage(item);
              setMessageActionModalVisible(true);
            }}
            delayLongPress={280}
          >
            {isMine ? (
              <LinearGradient
                colors={currentTheme.bubbleMineGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.bubble,
                  styles.bubbleRight,
                  (hasVideo || hasPost) && styles.bubbleWithMedia,
                ]}
              >
                {renderBubbleInner()}
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.bubble,
                  styles.bubbleLeft,
                  { backgroundColor: currentTheme.bubbleOtherBg },
                  (hasVideo || hasPost) && styles.bubbleWithMedia,
                ]}
              >
                {renderBubbleInner()}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SwipeableMessageBubble>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Top Banner Ad */}
      <AppAdBanner containerStyle={styles.topBannerContainer} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileHeaderTouch}
            activeOpacity={0.8}
            onPress={() => {
              if (isGroup) {
                setGroupInfoModalVisible(true);
              } else if (other?._id) {
                router.push(`/channel/${other._id}`);
              }
            }}
          >
            <View style={styles.avatarWrapper}>
              {isGroup ? (
                displayAvatar && displayAvatar !== FALLBACK_AVATAR ? (
                  <Image
                    source={{ uri: displayAvatar }}
                    style={styles.headerAvatar}
                    contentFit="cover"
                    transition={0}
                  />
                ) : (
                  <View style={[styles.headerAvatar, styles.groupAvatarFallback]}>
                    <Ionicons name="people" size={20} color="#FFFFFF" />
                  </View>
                )
              ) : (
                <Image
                  source={{ uri: displayAvatar }}
                  style={styles.headerAvatar}
                  contentFit="cover"
                  transition={0}
                />
              )}
              {!isGroup && isOtherOnline && <View style={styles.headerOnlineBadge} />}
            </View>

            <View style={styles.headerTitleContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {displayName}
                </Text>
                {isVerifiedUser && (
                  <VerifiedBadge size={14} style={{ marginLeft: 4 }} />
                )}
              </View>

              <Text style={styles.headerSubtitle}>
                {isGroup ? (
                  `${conversation?.participants?.length || 0} members • Tap for info`
                ) : isOtherTyping ? (
                  <Text style={styles.typingText}>typing...</Text>
                ) : isOtherOnline ? (
                  <Text style={styles.onlineText}>Online</Text>
                ) : (
                  'Offline'
                )}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            setMenuVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={[styles.contentContainer, { backgroundColor: currentTheme.screenBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* First Message Restriction Banner */}
        {isPendingForMe && (
          <View style={styles.requestBanner}>
            <View style={styles.requestInfoRow}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>Message Request</Text>
                <Text style={styles.requestSubtitle}>
                  {other?.channelName || other?.name} wants to chat with you. You must accept to reply back.
                </Text>
              </View>
            </View>
            <View style={styles.requestActionRow}>
              <TouchableOpacity
                style={styles.declineActionButton}
                onPress={handleDecline}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={16} color={Colors.text} style={{ marginRight: 4 }} />
                <Text style={styles.declineActionText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.blockActionButton}
                onPress={handleBlock}
                activeOpacity={0.8}
              >
                <Ionicons name="ban" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                <Text style={styles.blockActionText}>Block</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueActionButton}
                onPress={handleAccept}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color={Colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.continueActionText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Blocked State Notice */}
        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.blockedBannerText}>
              {isBlockedByMe
                ? 'You have blocked this user.'
                : 'You cannot reply to this conversation because you are blocked.'}
            </Text>
            {isBlockedByMe && (
              <TouchableOpacity onPress={handleUnblock} style={{ marginLeft: 8 }}>
                <Text style={styles.unblockLinkText}>Unblock</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Message Stream */}
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          inverted
          keyExtractor={(item, index) => item._id || String(index)}
          renderItem={renderMessageBubble}
          contentContainerStyle={styles.messagesList}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength > 0 ? info.index * info.averageItemLength : info.index * 60,
              animated: true,
            });
          }}
          ListEmptyComponent={
            loading && messages.length === 0 ? (
              <View style={[styles.emptyMessages, { transform: [{ scaleY: -1 }], paddingVertical: 40 }]}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <View style={[styles.emptyMessages, { transform: [{ scaleY: -1 }] }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.textGray} />
                <Text style={styles.emptyText}>
                  {isGroup
                    ? 'Welcome to the group! Send a message to start chatting with members.'
                    : `Send a message to start chatting with ${displayName}!`}
                </Text>
              </View>
            )
          }
        />

        {/* Typing Bar Footer */}
        {isOtherTyping && (
          <View style={styles.typingIndicatorBar}>
            <Text style={styles.typingIndicatorText}>
              {isGroup ? 'Someone is typing...' : `${other?.channelName || other?.name} is typing...`}
            </Text>
          </View>
        )}

        {/* Reply Preview Banner */}
        {Boolean(replyingTo) && (
          <View style={[styles.replyBanner, { borderLeftColor: currentTheme.primary, backgroundColor: currentTheme.inputBg }]}>
            <View style={styles.replyBannerContent}>
              <View style={styles.replyBannerHeader}>
                <Ionicons name="arrow-undo" size={13} color={currentTheme.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.replyBannerSender, { color: currentTheme.primary }]} numberOfLines={1}>
                  Replying to {(replyingTo.sender?._id || replyingTo.sender)?.toString() === currentUserId ? 'yourself' : (replyingTo.sender?.channelName || replyingTo.sender?.name || 'User')}
                </Text>
              </View>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyingTo.text || (replyingTo.video ? '🎥 Shared Video' : replyingTo.post ? '📝 Shared Post' : 'Message')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setReplyingTo(null);
              }}
              style={styles.replyBannerCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: currentTheme.inputBg,
              paddingBottom:
                keyboardHeight > 0
                  ? Platform.OS === 'android'
                    ? keyboardHeight + 8
                    : 10
                  : Math.max(insets.bottom, 14) + 6,
            },
          ]}
        >
          <TextInput
            placeholder={
              isBlockedByMe
                ? 'You blocked this user'
                : isBlockedByOther
                ? 'You cannot message this user'
                : isPendingForMe
                ? 'Accept request to reply...'
                : 'Type a message...'
            }
            placeholderTextColor={Colors.textGray}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={2000}
            editable={!isBlocked && !isPendingForMe}
            style={[
              styles.input,
              { color: currentTheme.inputText },
              (isBlocked || isPendingForMe) && styles.inputDisabled,
            ]}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: currentTheme.primary },
              (!inputText.trim() || sending || isBlocked || isPendingForMe) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || isBlocked || isPendingForMe}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Options Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuDropdown}>
            {isGroup ? (
              <>
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setMenuVisible(false);
                    setGroupInfoModalVisible(true);
                  }}
                >
                  <Ionicons name="information-circle-outline" size={18} color={Colors.text} style={{ marginRight: 10 }} />
                  <Text style={styles.menuOptionText}>Group Info</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setMenuVisible(false);
                    setThemeModalVisible(true);
                  }}
                >
                  <Ionicons name="color-palette-outline" size={18} color={currentTheme.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.menuOptionText, { color: currentTheme.primary, fontWeight: '700' }]}>Change Theme</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* View Channel */}
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setMenuVisible(false);
                    if (other?._id) router.push(`/channel/${other._id}`);
                  }}
                >
                  <Ionicons name="person-outline" size={18} color={Colors.text} style={{ marginRight: 10 }} />
                  <Text style={styles.menuOptionText}>View Channel</Text>
                </TouchableOpacity>

                {/* Change Theme */}
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setMenuVisible(false);
                    setThemeModalVisible(true);
                  }}
                >
                  <Ionicons name="color-palette-outline" size={18} color={currentTheme.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.menuOptionText, { color: currentTheme.primary, fontWeight: '700' }]}>Change Theme</Text>
                </TouchableOpacity>

                {/* Block / Unblock Option */}
                {isBlockedByMe ? (
                  <TouchableOpacity style={styles.menuOption} onPress={handleUnblock}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} style={{ marginRight: 10 }} />
                    <Text style={[styles.menuOptionText, { color: Colors.primary, fontWeight: '600' }]}>Unblock User</Text>
                  </TouchableOpacity>
                ) : !isBlocked ? (
                  <TouchableOpacity style={styles.menuOption} onPress={handleBlock}>
                    <Ionicons name="ban-outline" size={18} color="#EF4444" style={{ marginRight: 10 }} />
                    <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Block User</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Continue Chat (Accept) if pending, or Dismiss Option */}
                {isPendingForMe ? (
                  <>
                    <TouchableOpacity style={styles.menuOption} onPress={handleAccept}>
                      <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} style={{ marginRight: 10 }} />
                      <Text style={[styles.menuOptionText, { color: Colors.primary, fontWeight: '600' }]}>Continue Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuOption} onPress={handleDecline}>
                      <Ionicons name="close-circle-outline" size={18} color="#F97316" style={{ marginRight: 10 }} />
                      <Text style={[styles.menuOptionText, { color: '#F97316' }]}>Dismiss Chat</Text>
                    </TouchableOpacity>
                  </>
                ) : !isBlocked ? (
                  <TouchableOpacity style={styles.menuOption} onPress={handleDecline}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 10 }} />
                    <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Dismiss Chat</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Message Actions Modal (Instagram-style Reply, Unsend & Delete) */}
      <Modal
        visible={messageActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMessageActionModalVisible(false);
          setSelectedMessage(null);
        }}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => {
            setMessageActionModalVisible(false);
            setSelectedMessage(null);
          }}
        >
          <View style={styles.actionSheetContainer}>
            <View style={styles.actionSheetGrabber} />

            {Boolean(selectedMessage?.text) && (
              <View style={styles.actionSheetSnippetBox}>
                <Text style={styles.actionSheetSnippetText} numberOfLines={2}>
                  "{selectedMessage?.text}"
                </Text>
              </View>
            )}

            <View style={styles.actionSheetButtonsGroup}>
              {/* Reply shortcut */}
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  const targetMsg = selectedMessage;
                  setMessageActionModalVisible(false);
                  setSelectedMessage(null);
                  hapticLight();
                  setReplyingTo(targetMsg);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-undo" size={20} color={currentTheme.primary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionSheetItemText, { color: currentTheme.primary, fontWeight: '700' }]}>
                    Reply
                  </Text>
                  <Text style={styles.actionSheetItemSubtext}>
                    Quote message in your reply
                  </Text>
                </View>
              </TouchableOpacity>
              {/* Unsend - only for current user's sent messages */}
              {((selectedMessage?.sender?._id || selectedMessage?.sender)?.toString() === currentUserId) && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={handleUnsendMessage}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-undo-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionSheetItemText, { color: '#EF4444', fontWeight: '700' }]}>
                      Unsend
                    </Text>
                    <Text style={styles.actionSheetItemSubtext}>
                      Remove message for everyone
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Delete for you - available on any message */}
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={handleDeleteMessage}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#DC2626" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionSheetItemText, { color: '#DC2626' }]}>
                    Delete for you
                  </Text>
                  <Text style={styles.actionSheetItemSubtext}>
                    Remove message only for you
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Copy Text */}
              {Boolean(selectedMessage?.text) && (
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={handleCopyMessageText}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={20} color={Colors.text} style={{ marginRight: 12 }} />
                  <Text style={styles.actionSheetItemText}>Copy Text</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => {
                setMessageActionModalVisible(false);
                setSelectedMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Group Info Modal */}
      {isGroup && (
        <GroupInfoModal
          visible={groupInfoModalVisible}
          conversation={conversation}
          currentUserId={currentUserId}
          onClose={() => setGroupInfoModalVisible(false)}
          onOpenAddMembers={() => {
            setGroupInfoModalVisible(false);
            setAddMembersModalVisible(true);
          }}
          onGroupUpdated={(updatedGroup) => {
            setConversation((prev: any) => ({
              ...prev,
              ...updatedGroup,
            }));
            loadData();
          }}
          onLeftGroup={() => {
            setGroupInfoModalVisible(false);
            router.back();
          }}
        />
      )}

      {/* Add Group Members Modal */}
      {isGroup && (
        <AddGroupMembersModal
          visible={addMembersModalVisible}
          groupId={conversationId}
          existingMemberIds={(conversation?.participants || []).map((p: any) => (p?._id || p)?.toString())}
          onClose={() => setAddMembersModalVisible(false)}
          onMembersAdded={() => {
            setAddMembersModalVisible(false);
            loadData();
          }}
        />
      )}

      {/* Chat Theme Picker Modal */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.themeModalOverlay}
          activeOpacity={1}
          onPress={() => setThemeModalVisible(false)}
        >
          <View style={styles.themeModalContent}>
            <View style={styles.themeModalGrabber} />
            <View style={styles.themeModalTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.themeModalTitle}>Chat Theme</Text>
                <Text style={styles.themeModalSubtitle}>
                  Select a theme to personalize this conversation
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setThemeModalVisible(false)}
                style={styles.themeModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.themeModalGrid}
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(CHAT_THEMES).map(([themeKey, tItem]) => {
                const isSelected = currentThemeKey === themeKey;
                return (
                  <TouchableOpacity
                    key={themeKey}
                    style={[
                      styles.themeCard,
                      isSelected && {
                        borderColor: tItem.primary,
                        backgroundColor: '#F8FAFC',
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectTheme(themeKey)}
                  >
                    <LinearGradient
                      colors={tItem.bubbleMineGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.themePreviewCircle}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      ) : null}
                    </LinearGradient>
                    <Text
                      style={[
                        styles.themeCardName,
                        isSelected && [
                          styles.themeCardNameSelected,
                          { color: tItem.primary },
                        ],
                      ]}
                      numberOfLines={1}
                    >
                      {tItem.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  topBannerContainer: {
    width: '100%',
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
    paddingVertical: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: Colors.white,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  profileHeaderTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEEEEE',
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  headerTitleContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 1,
  },
  onlineText: {
    color: '#10B981',
    fontWeight: '600',
  },
  typingText: {
    color: Colors.primary,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestBanner: {
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
    padding: 14,
  },
  requestInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 2,
  },
  requestSubtitle: {
    fontSize: 12,
    color: '#7C2D12',
    lineHeight: 17,
  },
  requestActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  declineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  declineActionText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  blockActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  blockActionText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  continueActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  continueActionText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  blockedBannerText: {
    fontSize: 12,
    color: '#B91C1C',
    flex: 1,
  },
  unblockLinkText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  bubbleWrapper: {
    marginVertical: 3,
    width: '100%',
    flexDirection: 'row',
  },
  bubbleWrapperRight: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapperLeft: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleTouch: {
    maxWidth: '80%',
  },
  bubbleTouchRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleTouchLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleTouchMedia: {
    width: '80%',
    maxWidth: 320,
  },
  bubble: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleWithMedia: {
    width: '100%',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  bubbleRight: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  bubbleLeft: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#ECECEC',
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextRight: {
    color: Colors.white,
  },
  bubbleTextLeft: {
    color: Colors.text,
  },
  bubbleLinkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  bubbleLinkTextRight: {
    color: '#FFFFFF',
  },
  bubbleLinkTextLeft: {
    color: '#0284C7',
  },
  embeddedMediaCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  embeddedThumbContainer: {
    position: 'relative',
    width: '100%',
    height: 144,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    overflow: 'hidden',
  },
  embeddedThumb: {
    width: '100%',
    height: '100%',
  },
  embeddedPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embeddedPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embeddedDurationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  embeddedDurationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  embeddedShortBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  embeddedShortText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  embeddedInfo: {
    padding: 8,
  },
  embeddedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 17,
    marginBottom: 4,
  },
  embeddedTitleRight: {
    color: Colors.white,
  },
  embeddedOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  embeddedOwnerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    marginRight: 6,
  },
  embeddedOwnerName: {
    fontSize: 11,
    color: Colors.textGray,
    fontWeight: '600',
    maxWidth: '80%',
  },
  embeddedOwnerNameRight: {
    color: 'rgba(255,255,255,0.85)',
  },
  embeddedPostCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
  },
  embeddedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  postBadgePill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  postBadgePillRight: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  postBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  postBadgePillTextRight: {
    color: Colors.white,
  },
  embeddedPostText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text,
    marginBottom: 6,
  },
  embeddedPostTextRight: {
    color: Colors.white,
  },
  embeddedPostImage: {
    width: '100%',
    height: 130,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#E5E7EB',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 10,
  },
  bubbleTimeRight: {
    color: 'rgba(255,255,255,0.75)',
  },
  bubbleTimeLeft: {
    color: Colors.textGray,
  },
  typingIndicatorBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  typingIndicatorText: {
    fontSize: 12,
    color: Colors.textGray,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.text,
    marginRight: 8,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: Colors.textGray,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: 16,
  },
  menuDropdown: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  menuOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  actionSheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  actionSheetSnippetBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionSheetSnippetText: {
    fontSize: 13,
    color: Colors.textGray,
    fontStyle: 'italic',
  },
  actionSheetButtonsGroup: {
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 12,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  actionSheetItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  actionSheetItemSubtext: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  actionSheetCancelBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  groupSenderAvatarTouch: {
    marginRight: 6,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  groupSenderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  groupSenderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  groupSenderNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  groupAvatarFallback: {
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    width: '100%',
  },
  systemMessagePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: '85%',
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Swipe to reply styles
  swipeContainer: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  swipeReplyIconBox: {
    position: 'absolute',
    top: '50%',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  swipeReplyIconLeft: {
    left: 10,
  },
  swipeReplyIconRight: {
    right: 10,
  },

  // Quoted message preview inside bubble
  quotedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  quotedMessageLeft: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  quotedMessageRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  quotedMessageBar: {
    width: 3.5,
    borderRadius: 2,
    marginRight: 8,
  },
  quotedMessageContent: {
    flex: 1,
    paddingVertical: 5,
    paddingRight: 8,
  },
  quotedMessageSender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  quotedMessageText: {
    fontSize: 12,
    lineHeight: 16,
  },
  quotedMessageTextLeft: {
    color: Colors.textGray,
  },
  quotedMessageTextRight: {
    color: 'rgba(255, 255, 255, 0.88)',
  },

  // Reply preview banner above input composer
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderLeftWidth: 3.5,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  replyBannerContent: {
    flex: 1,
    marginRight: 10,
  },
  replyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  replyBannerSender: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyBannerText: {
    fontSize: 13,
    color: Colors.textGray,
  },
  replyBannerCloseBtn: {
    padding: 4,
  },

  // Chat Theme Modal styles
  themeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  themeModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  themeModalGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  themeModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  themeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  themeModalSubtitle: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  themeModalCloseBtn: {
    padding: 6,
  },
  themeModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  themeCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  themePreviewCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  themeCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  themeCardNameSelected: {
    fontWeight: '700',
  },
});
