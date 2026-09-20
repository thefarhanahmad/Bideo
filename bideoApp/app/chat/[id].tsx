import React, { useEffect, useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
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
import { showAlert } from '../../components/AppAlert';
import { hapticLight, hapticSelection } from '../../utils/haptics';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';
const FALLBACK_THUMBNAIL = 'https://via.placeholder.com/640x360.png?text=Bideo';

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
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

  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentUserId = user?._id?.toString() || user?.id?.toString() || '';

  // Track keyboard height to smoothly position input above keyboard
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
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
          requestOnlineStatus([convData.otherParticipant._id], (status) => {
            if (status && status[convData.otherParticipant._id] !== undefined) {
              setIsOtherOnline(Boolean(status[convData.otherParticipant._id]));
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
      if (newMsg?.conversationId?.toString() === conversationId?.toString()) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        // If active, mark as read immediately
        chatService.markAsRead(conversationId).catch(() => {});
        DeviceEventEmitter.emit('chatViewed');
      }
    });

    const subTyping = DeviceEventEmitter.addListener(
      'chatUserTyping',
      (data: { conversationId: string; senderId: string; isTyping: boolean }) => {
        if (
          data?.conversationId?.toString() === conversationId?.toString() &&
          data.senderId !== currentUserId
        ) {
          setIsOtherTyping(Boolean(data.isTyping));
        }
      }
    );

    const subStatus = DeviceEventEmitter.addListener(
      'chatUserStatusChanged',
      (data: { userId: string; isOnline: boolean }) => {
        if (
          conversation?.otherParticipant?._id &&
          data?.userId?.toString() === conversation.otherParticipant._id.toString()
        ) {
          setIsOtherOnline(Boolean(data.isOnline));
        }
      }
    );

    const subConvStatus = DeviceEventEmitter.addListener(
      'chatConversationStatusChanged',
      (data: { conversationId: string; status: string; blockedBy?: string }) => {
        if (data?.conversationId?.toString() === conversationId?.toString()) {
          setConversation((prev: any) => ({
            ...prev,
            status: data.status,
            blockedBy: data.blockedBy ?? prev?.blockedBy,
            isBlockedByMe: data.status === 'blocked' && data.blockedBy === currentUserId,
            isBlockedByOther: data.status === 'blocked' && data.blockedBy !== currentUserId,
          }));
        }
      }
    );

    const subRead = DeviceEventEmitter.addListener(
      'chatMessagesRead',
      (data: { conversationId: string; readBy: string }) => {
        if (
          data?.conversationId?.toString() === conversationId?.toString() &&
          data.readBy !== currentUserId
        ) {
          setMessages((prev) =>
            prev.map((m) =>
              m.sender?._id === currentUserId || m.sender === currentUserId
                ? { ...m, isRead: true }
                : m
            )
          );
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
      subConvStatus.remove();
      subRead.remove();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, currentUserId, loadData, conversation?.otherParticipant?._id]);

  // Handle typing debounce
  const handleInputChange = (text: string) => {
    setInputText(text);

    if (conversation?.otherParticipant?._id && conversationId) {
      emitTyping(conversationId, conversation.otherParticipant._id, true);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        emitTyping(conversationId, conversation.otherParticipant._id, false);
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
    if (conversation?.otherParticipant?._id && conversationId) {
      emitTyping(conversationId, conversation.otherParticipant._id, false);
    }

    try {
      const newMsg = await chatService.sendMessage({
        conversationId,
        text: trimmed,
      });

      if (newMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to send message');
      setInputText(trimmed); // Restore message
    } finally {
      setSending(false);
    }
  };

  // Accept message request (Continue chat)
  const handleAccept = async () => {
    try {
      hapticSelection();
      const updated = await chatService.acceptChat(conversationId);
      setConversation((prev: any) => ({
        ...prev,
        ...updated,
        status: 'accepted',
      }));
      showAlert('Request Accepted', 'You can now chat freely with this user.');
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to accept chat');
    }
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

  const other = conversation?.otherParticipant;
  const isInitiator = conversation?.initiator?.toString() === currentUserId;
  const isPendingForMe = conversation?.status === 'pending' && !isInitiator;
  const isBlocked = conversation?.status === 'blocked';
  const isBlockedByMe = isBlocked && conversation?.blockedBy?.toString() === currentUserId;
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

  const renderMessageBubble = ({ item }: { item: any }) => {
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

    return (
      <View
        style={[
          styles.bubbleWrapper,
          isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleRight : styles.bubbleLeft,
            (hasVideo || hasPost) && styles.bubbleWithMedia,
          ]}
        >
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
                isMine ? styles.bubbleTextRight : styles.bubbleTextLeft,
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
                        isMine ? styles.bubbleLinkTextRight : styles.bubbleLinkTextLeft,
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
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

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
              if (other?._id) {
                router.push(`/channel/${other._id}`);
              }
            }}
          >
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: other?.avatar || FALLBACK_AVATAR }}
                style={styles.headerAvatar}
                contentFit="cover"
                transition={150}
              />
              {isOtherOnline && <View style={styles.headerOnlineBadge} />}
            </View>

            <View style={styles.headerTitleContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {other?.channelName || other?.name || 'Chat'}
                </Text>
                {Boolean(other?.isVerified) && (
                  <VerifiedBadge size={14} style={{ marginLeft: 4 }} />
                )}
              </View>

              <Text style={styles.headerSubtitle}>
                {isOtherTyping ? (
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
          onPress={() => setMenuVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* First Message Restriction Banner (Requirement 6) */}
        {isPendingForMe && (
          <View style={styles.requestBanner}>
            <View style={styles.requestInfoRow}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>Message Request</Text>
                <Text style={styles.requestSubtitle}>
                  {other?.channelName || other?.name} wants to chat with you. You can accept to reply or block this user.
                </Text>
              </View>
            </View>
            <View style={styles.requestActionRow}>
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
                <Text style={styles.continueActionText}>Continue</Text>
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
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => item._id || String(index)}
            renderItem={renderMessageBubble}
            contentContainerStyle={styles.messagesList}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.textGray} />
                <Text style={styles.emptyText}>
                  Send a message to start chatting with {other?.channelName || other?.name}!
                </Text>
              </View>
            }
          />
        )}

        {/* Typing Bar Footer */}
        {isOtherTyping && (
          <View style={styles.typingIndicatorBar}>
            <Text style={styles.typingIndicatorText}>
              {other?.channelName || other?.name} is typing...
            </Text>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
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
                : 'Type a message...'
            }
            placeholderTextColor={Colors.textGray}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={2000}
            editable={!isBlocked}
            style={[styles.input, isBlocked && styles.inputDisabled]}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending || isBlocked) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || isBlocked}
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

            {isBlockedByMe ? (
              <TouchableOpacity style={styles.menuOption} onPress={handleUnblock}>
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} style={{ marginRight: 10 }} />
                <Text style={[styles.menuOptionText, { color: Colors.primary }]}>Unblock User</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuOption} onPress={handleBlock}>
                <Ionicons name="ban-outline" size={18} color="#EF4444" style={{ marginRight: 10 }} />
                <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Block User</Text>
              </TouchableOpacity>
            )}
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
    gap: 10,
  },
  blockActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
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
    paddingHorizontal: 18,
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
    paddingVertical: 14,
    flexGrow: 1,
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
    marginVertical: 4,
    flexDirection: 'row',
  },
  bubbleWrapperRight: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperLeft: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleWithMedia: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
    width: '84%',
    maxWidth: 320,
  },
  bubbleRight: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleLeft: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#ECECEC',
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
});
