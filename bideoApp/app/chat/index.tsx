import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  DeviceEventEmitter,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import { chatService, storyService, resolveMediaUrl } from '../../services/api';
import { requestOnlineStatus } from '../../services/socket';
import VerifiedBadge from '../../components/VerifiedBadge';
import AuthModal from '../../components/AuthModal';
import StoryViewerModal from '../../components/StoryViewerModal';
import { showAlert } from '../../components/AppAlert';
import { AppAdBanner } from '../../components/AppAds';
import { hapticSelection, hapticLight } from '../../utils/haptics';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

/**
 * Format timestamps professionally like Telegram/WhatsApp
 */
const formatChatListTime = (dateStr: string | Date | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // If today
  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  // If within last 7 days
  if (diffHours < 24 * 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }

  // Older
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function ChatListScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'requests'>('all');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  // Stories State
  const [storyTray, setStoryTray] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [selectedStoryUserIndex, setSelectedStoryUserIndex] = useState(0);

  const currentUserId = user?._id?.toString() || user?.id?.toString() || '';
  const conversationsRef = useRef<any[]>([]);
  conversationsRef.current = conversations;

  const loadStoryTray = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingStories(true);
      const data = await storyService.getStoryTray();
      if (Array.isArray(data)) {
        setStoryTray(data);

        // Fetch presence status for followed users in story tray
        const storyUserIds = data
          .filter((g: any) => !g.isSelf && g.user?._id)
          .map((g: any) => g.user._id.toString());
        if (storyUserIds.length > 0) {
          requestOnlineStatus(storyUserIds, (status) => {
            if (status) {
              setOnlineMap((prev) => ({ ...prev, ...status }));
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to load story tray:', err);
    } finally {
      setLoadingStories(false);
    }
  }, [isAuthenticated]);

  const loadConversations = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (!isRefresh) setLoading(true);
      const data = await chatService.getConversations();
      if (Array.isArray(data)) {
        setConversations(data);

        // Gather participant user IDs to query live presence status
        const participantIds = data
          .map((c) => c.otherParticipant?._id)
          .filter((id) => id && id.toString() !== currentUserId) as string[];

        if (participantIds.length > 0) {
          requestOnlineStatus(participantIds, (status) => {
            if (status) {
              setOnlineMap((prev) => ({ ...prev, ...status }));
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, currentUserId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
    } else {
      loadConversations();
      loadStoryTray();
    }

    // Real-time Socket Event Listeners
    const subMsg = DeviceEventEmitter.addListener('chatMessageReceived', () => {
      loadConversations(true);
    });

    const subConv = DeviceEventEmitter.addListener('chatConversationUpdated', (updatedConv: any) => {
      if (!updatedConv?._id) return;
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id?.toString() === updatedConv._id?.toString());
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...updatedConv };
          return updated.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
        return [updatedConv, ...prev];
      });

      if (updatedConv.otherParticipant?._id) {
        const otherId = updatedConv.otherParticipant._id.toString();
        if (updatedConv.otherParticipant.isOnline !== undefined) {
          setOnlineMap((prev) => ({ ...prev, [otherId]: Boolean(updatedConv.otherParticipant.isOnline) }));
        }
      }
    });

    const subStatus = DeviceEventEmitter.addListener(
      'chatUserStatusChanged',
      (data: { userId: string; isOnline: boolean }) => {
        if (data?.userId && data.userId.toString() !== currentUserId) {
          setOnlineMap((prev) => ({
            ...prev,
            [data.userId.toString()]: Boolean(data.isOnline),
          }));
        }
      }
    );

    const subOnlineStatus = DeviceEventEmitter.addListener(
      'chatOnlineUsersStatus',
      (statusMap: Record<string, boolean>) => {
        if (statusMap) {
          setOnlineMap((prev) => ({ ...prev, ...statusMap }));
        }
      }
    );

    const subSocket = DeviceEventEmitter.addListener('socketConnected', () => {
      loadConversations(true);
      loadStoryTray();
      const participantIds = conversationsRef.current
        .map((c: any) => c.otherParticipant?._id)
        .filter((id: any) => id && id.toString() !== currentUserId) as string[];
      if (participantIds.length > 0) {
        requestOnlineStatus(participantIds);
      }
    });

    const subRead = DeviceEventEmitter.addListener(
      'chatMessagesRead',
      (data: { conversationId: string; readBy: string }) => {
        if (data?.conversationId) {
          const isReadByMe = data.readBy?.toString() === currentUserId;
          setConversations((prev) =>
            prev.map((c) => {
              if (c._id?.toString() === data.conversationId.toString()) {
                return {
                  ...c,
                  unreadCount: isReadByMe ? 0 : c.unreadCount,
                  lastMessage: c.lastMessage
                    ? {
                        ...c.lastMessage,
                        isRead: true,
                      }
                    : c.lastMessage,
                };
              }
              return c;
            })
          );
        }
      }
    );

    const subChatViewed = DeviceEventEmitter.addListener('chatViewed', () => {
      loadConversations(true);
      loadStoryTray();
    });

    return () => {
      subMsg.remove();
      subConv.remove();
      subStatus.remove();
      subOnlineStatus.remove();
      subSocket.remove();
      subRead.remove();
      subChatViewed.remove();
    };
  }, [isAuthenticated, loadConversations, loadStoryTray, currentUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConversations(true), loadStoryTray()]);
  }, [loadConversations, loadStoryTray]);

  const isGroupSelf = useCallback(
    (g: any) =>
      Boolean(
        g?.isSelf ||
        g?.isOwn ||
        (currentUserId &&
          (g?.user?._id?.toString() === currentUserId || g?.user?.id?.toString() === currentUserId))
      ),
    [currentUserId]
  );

  // Groups with active stories for StoryViewerModal
  const activeStoryGroups = useMemo(() => {
    return storyTray.filter((g) => Array.isArray(g.stories) && g.stories.length > 0);
  }, [storyTray]);

  const pickAndUploadStory = useCallback(async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }

    const ownGroup = storyTray.find(isGroupSelf);
    const activeCount = ownGroup?.stories?.length || 0;
    if (activeCount >= 5) {
      showAlert(
        'Story Limit Reached',
        'You can have up to 5 active stories at a time. Please wait for an existing story to expire after 24 hours or delete one before adding a new photo.'
      );
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission Required', 'Please allow photo library access to upload a story.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const asset = res.assets[0];
      const uri = asset.uri;
      const filename = uri.split('/').pop() || `story_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match?.[1] ? match[1].toLowerCase() : 'jpeg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      setUploadingStory(true);
      const formData = new FormData();
      // @ts-ignore
      formData.append('image', {
        uri,
        name: filename,
        type: mimeType,
      });

      await storyService.createStory(formData);
      hapticLight();
      await loadStoryTray();
    } catch (err: any) {
      console.error('Failed to upload story:', err);
      showAlert(
        'Upload Failed',
        err?.response?.data?.message || 'Could not upload your story. Please try again.'
      );
    } finally {
      setUploadingStory(false);
    }
  }, [isAuthenticated, storyTray, isGroupSelf, loadStoryTray]);

  const handlePressStoryGroup = useCallback(
    (group: any) => {
      hapticLight();
      if (isGroupSelf(group)) {
        if (!group.stories || group.stories.length === 0) {
          pickAndUploadStory();
          return;
        }
        const idx = activeStoryGroups.findIndex(isGroupSelf);
        setSelectedStoryUserIndex(idx !== -1 ? idx : 0);
        setStoryViewerVisible(true);
      } else {
        const idx = activeStoryGroups.findIndex(
          (g) => g.user?._id?.toString() === group.user?._id?.toString()
        );
        if (idx !== -1) {
          setSelectedStoryUserIndex(idx);
          setStoryViewerVisible(true);
        }
      }
    },
    [activeStoryGroups, isGroupSelf, pickAndUploadStory]
  );

  const handleStoryDeleted = useCallback(
    (storyId: string) => {
      if (!storyId) return;
      setStoryTray((prev) =>
        prev.map((g) => {
          if (isGroupSelf(g)) {
            const updatedStories = (g.stories || []).filter(
              (s: any) => s._id?.toString() !== storyId.toString()
            );
            const hasUnviewed = updatedStories.some(
              (s: any) => !s.isViewed && !s.ownerViewed
            );
            const lastStoryAt =
              updatedStories.length > 0
                ? updatedStories[updatedStories.length - 1].createdAt
                : null;
            return {
              ...g,
              stories: updatedStories,
              hasUnviewed,
              lastStoryAt,
            };
          }
          return g;
        })
      );
    },
    [isGroupSelf]
  );

  const handleStoryViewed = useCallback((storyId: string) => {
    setStoryTray((prev) =>
      prev.map((g) => {
        if (g.stories?.some((s: any) => s._id?.toString() === storyId)) {
          const updatedStories = g.stories.map((s: any) => {
            if (s._id?.toString() === storyId) {
              const views = Array.isArray(s.views) ? s.views : [];
              if (!views.includes(currentUserId)) {
                return { ...s, views: [...views, currentUserId], isViewed: true };
              }
            }
            return s;
          });
          const hasUnviewed = updatedStories.some(
            (s: any) => !s.isViewed && !s.views?.includes(currentUserId)
          );
          return { ...g, stories: updatedStories, hasUnviewed };
        }
        return g;
      })
    );
  }, [currentUserId]);



  // Total unread count across all chats
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  // Total pending message requests count
  const pendingRequestsCount = useMemo(() => {
    return conversations.filter(
      (c) => c.status === 'pending' && c.initiator !== currentUserId
    ).length;
  }, [conversations, currentUserId]);

  // Filtered conversations based on search query and active tab
  const filteredConversations = useMemo(() => {
    let list = conversations;

    if (activeTab === 'unread') {
      list = list.filter((c) => (c.unreadCount || 0) > 0);
    } else if (activeTab === 'requests') {
      list = list.filter((c) => c.status === 'pending' && c.initiator !== currentUserId);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((c) => {
      const name = c.otherParticipant?.name?.toLowerCase() || '';
      const channelName = c.otherParticipant?.channelName?.toLowerCase() || '';
      const lastMsg = c.lastMessage?.text?.toLowerCase() || '';
      return name.includes(q) || channelName.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, activeTab, searchQuery, currentUserId]);

  const renderConversationItem = ({ item }: { item: any }) => {
    const other = item.otherParticipant;
    const otherId = other?._id?.toString();
    const isOnline = Boolean(
      otherId &&
      otherId !== currentUserId &&
      (onlineMap[otherId] !== undefined ? onlineMap[otherId] : other?.isOnline)
    );
    const unreadCount = item.unreadCount || 0;
    const isPending = item.status === 'pending';
    const isBlocked = item.status === 'blocked';
    const isLastSenderMe =
      (item.lastMessage?.sender?._id || item.lastMessage?.sender)?.toString() === currentUserId;

    return (
      <TouchableOpacity
        style={[styles.convItem, unreadCount > 0 && styles.convItemUnread]}
        activeOpacity={0.65}
        onPress={() => {
          hapticLight();
          DeviceEventEmitter.emit('chatViewed');
          router.push({
            pathname: `/chat/${item._id}`,
            params: {
              name: other?.channelName || other?.name || '',
              avatar: other?.avatar || '',
              isVerified: other?.isVerified ? '1' : '0',
            },
          });
        }}
      >
        {/* Avatar + Online Indicator */}
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: other?.avatar || FALLBACK_AVATAR }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
          />
          {isOnline && <View style={styles.onlineBadge} />}
        </View>

        {/* Conversation Details */}
        <View style={styles.convDetails}>
          {/* Top Row: Name + Time */}
          <View style={styles.convHeaderRow}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.participantName, unreadCount > 0 && styles.participantNameUnread]}
                numberOfLines={1}
              >
                {other?.channelName || other?.name || 'User'}
              </Text>
              {Boolean(other?.isVerified) && (
                <VerifiedBadge size={14} style={{ marginLeft: 4 }} />
              )}
            </View>

            {item.lastMessage?.createdAt && (
              <Text style={[styles.timeAgo, unreadCount > 0 && styles.timeAgoUnread]}>
                {formatChatListTime(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>

          {/* Bottom Row: Message Snippet + Status + Badges */}
          <View style={styles.convMessageRow}>
            <View style={styles.snippetContainer}>
              {isLastSenderMe && !isBlocked && (
                <Ionicons
                  name={item.lastMessage?.isRead ? 'checkmark-done' : 'checkmark'}
                  size={15}
                  color={item.lastMessage?.isRead ? '#0284C7' : Colors.textGray}
                  style={{ marginRight: 4 }}
                />
              )}

              <Text
                style={[
                  styles.lastMessageText,
                  unreadCount > 0 && styles.unreadMessageText,
                  isBlocked && styles.blockedMessageText,
                ]}
                numberOfLines={1}
              >
                {isBlocked ? (
                  '🚫 Conversation blocked'
                ) : isPending && item.initiator !== currentUserId ? (
                  '📬 Sent you a message request'
                ) : isLastSenderMe ? (
                  `You: ${item.lastMessage?.text || 'Sent an attachment'}`
                ) : (
                  item.lastMessage?.text || 'Started a conversation'
                )}
              </Text>
            </View>

            {/* Right Badge */}
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : isPending && item.initiator !== currentUserId ? (
              <View style={styles.requestPill}>
                <Text style={styles.requestPillText}>Request</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnreadCount > 0 && (
            <View style={styles.headerUnreadPill}>
              <Text style={styles.headerUnreadPillText}>{totalUnreadCount} new</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerActionButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}
        >
          <Ionicons name="compass-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Modern Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={Colors.textGray} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by name or message..."
            placeholderTextColor={Colors.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Instagram-style Stories Tray */}
      {!searchQuery && (
        <View style={styles.storyTraySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.storyTrayScroll}
          >
            {/* "Your story" Item */}
            {(() => {
              const ownGroup = storyTray.find(isGroupSelf);
              const ownStories = ownGroup?.stories || [];
              const hasOwnStories = ownStories.length > 0;
              const hasUnviewed = Boolean(ownGroup?.hasUnviewed);
              const ownAvatar = resolveMediaUrl(user?.avatar) || FALLBACK_AVATAR;

              // If user has not added any story yet: Show simple centered Plus icon (no avatar)
              if (!hasOwnStories) {
                return (
                  <TouchableOpacity
                    key="my-story"
                    style={styles.storyItem}
                    activeOpacity={0.75}
                    onPress={pickAndUploadStory}
                  >
                    <View style={styles.storyEmptyPlusCircle}>
                      {uploadingStory ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Ionicons name="add" size={26} color={Colors.text} />
                      )}
                    </View>
                    <Text style={styles.storyUsername} numberOfLines={1}>
                      Add story
                    </Text>
                  </TouchableOpacity>
                );
              }

              // User has added stories: Show filled avatar with colored (unviewed) or grey (watched) ring
              return (
                <TouchableOpacity
                  key="my-story"
                  style={styles.storyItem}
                  activeOpacity={0.8}
                  onPress={() => handlePressStoryGroup(ownGroup)}
                >
                  <View style={styles.storyRingWrapper}>
                    {hasUnviewed ? (
                      <LinearGradient
                        colors={['#F58529', '#DD2A7B', '#8134AF']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.storyGradientRing}
                      >
                        <View style={styles.storyInnerBorder}>
                          <Image
                            source={{ uri: ownAvatar }}
                            style={styles.storyAvatar}
                            contentFit="cover"
                            transition={150}
                          />
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={styles.storyViewedRing}>
                        <Image
                          source={{ uri: ownAvatar }}
                          style={styles.storyAvatar}
                          contentFit="cover"
                          transition={150}
                        />
                      </View>
                    )}

                    {/* Plus badge to add/upload another story */}
                    <TouchableOpacity
                      style={styles.storyPlusBadge}
                      activeOpacity={0.85}
                      onPress={pickAndUploadStory}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="add" size={13} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Uploading loading spinner */}
                    {uploadingStory && (
                      <View style={styles.storyUploadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                  </View>

                  <View style={styles.storyUsernameRow}>
                    <Text style={styles.storyUsername} numberOfLines={1}>
                      Your story
                    </Text>
                    {Boolean(user?.isVerified) && (
                      <VerifiedBadge size={11} style={{ marginLeft: 2 }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* Followed Users' Stories (Latest uploaded first) */}
            {storyTray
              .filter((g) => !isGroupSelf(g) && Array.isArray(g.stories) && g.stories.length > 0)
              .sort((a, b) => {
                if (a.hasUnviewed && !b.hasUnviewed) return -1;
                if (!a.hasUnviewed && b.hasUnviewed) return 1;
                const timeA = a.lastStoryAt ? new Date(a.lastStoryAt).getTime() : 0;
                const timeB = b.lastStoryAt ? new Date(b.lastStoryAt).getTime() : 0;
                return timeB - timeA;
              })
              .map((group) => {
                const groupUser = group.user || {};
                const hasUnviewed = Boolean(group.hasUnviewed);
                const isOnline = Boolean(
                  groupUser._id && onlineMap[groupUser._id.toString()]
                );
                const avatarUri = resolveMediaUrl(groupUser.avatar) || FALLBACK_AVATAR;
                const displayName = groupUser.channelName || groupUser.name || 'User';

                return (
                  <TouchableOpacity
                    key={groupUser._id || group.latestStoryTime}
                    style={styles.storyItem}
                    activeOpacity={0.8}
                    onPress={() => handlePressStoryGroup(group)}
                  >
                    <View style={styles.storyRingWrapper}>
                      {hasUnviewed ? (
                        <LinearGradient
                          colors={['#F58529', '#DD2A7B', '#8134AF']}
                          start={{ x: 0, y: 1 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.storyGradientRing}
                        >
                          <View style={styles.storyInnerBorder}>
                            <Image
                              source={{ uri: avatarUri }}
                              style={styles.storyAvatar}
                              contentFit="cover"
                              transition={150}
                            />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={styles.storyViewedRing}>
                          <Image
                            source={{ uri: avatarUri }}
                            style={styles.storyAvatar}
                            contentFit="cover"
                            transition={150}
                          />
                        </View>
                      )}

                      {/* Online dot indicator on story */}
                      {isOnline && <View style={styles.storyOnlineDot} />}
                    </View>

                    <View style={styles.storyUsernameRow}>
                      <Text style={styles.storyUsername} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {Boolean(groupUser.isVerified) && (
                        <VerifiedBadge size={11} style={{ marginLeft: 2 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>
      )}

      {/* Segmented Filter Pills (All / Unread / Requests) */}
      {!searchQuery && (
        <View style={styles.filterTabsContainer}>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'all' && styles.filterTabActive]}
            onPress={() => {
              hapticSelection();
              setActiveTab('all');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, activeTab === 'all' && styles.filterTabTextActive]}>
              All Chats
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'unread' && styles.filterTabActive]}
            onPress={() => {
              hapticSelection();
              setActiveTab('unread');
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.filterTabText, activeTab === 'unread' && styles.filterTabTextActive]}
            >
              Unread
            </Text>
            {totalUnreadCount > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 'unread' ? styles.tabBadgeActive : styles.tabBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 'unread'
                      ? styles.tabBadgeTextActive
                      : styles.tabBadgeTextInactive,
                  ]}
                >
                  {totalUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {pendingRequestsCount > 0 && (
            <TouchableOpacity
              style={[styles.filterTab, activeTab === 'requests' && styles.filterTabActive]}
              onPress={() => {
                hapticSelection();
                setActiveTab('requests');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeTab === 'requests' && styles.filterTabTextActive,
                ]}
              >
                Requests
              </Text>
              <View style={styles.tabBadgeActive}>
                <Text style={styles.tabBadgeTextActive}>{pendingRequestsCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Conversation List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Syncing messages...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item._id}
          renderItem={renderConversationItem}
          style={styles.mainList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={
            filteredConversations.length === 0 ? styles.emptyListContent : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubble-ellipses-outline" size={42} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'No matching conversations'
                  : activeTab === 'unread'
                  ? 'No unread messages'
                  : activeTab === 'requests'
                  ? 'No message requests'
                  : 'Start a Conversation'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Check the spelling or try searching for another creator'
                  : activeTab === 'unread'
                  ? 'You are all caught up! When new messages arrive, they appear here.'
                  : activeTab === 'requests'
                  ? 'You have no pending chat requests from new users.'
                  : 'Visit any creator’s channel and tap Chat to message them directly.'}
              </Text>
              {!searchQuery && activeTab === 'all' && (
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => router.push('/(tabs)')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="compass" size={17} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.browseButtonText}>Explore Channels</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Bottom Sticky Banner Ad */}
      <View style={styles.bottomBannerWrapper}>
        <AppAdBanner containerStyle={styles.bottomBannerContainer} />
      </View>

      {/* Instagram Story Viewer Modal */}
      <StoryViewerModal
        visible={storyViewerVisible}
        onClose={() => setStoryViewerVisible(false)}
        storyGroups={activeStoryGroups}
        initialUserIndex={selectedStoryUserIndex}
        currentUserId={currentUserId}
        onStoryDeleted={handleStoryDeleted}
        onStoryViewed={handleStoryViewed}
        onAddStory={pickAndUploadStory}
      />

      <AuthModal
        visible={authModalVisible}
        onClose={() => {
          setAuthModalVisible(false);
          if (!isAuthenticated) router.back();
        }}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: Colors.white,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerUnreadPill: {
    backgroundColor: '#FFF4EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  headerUnreadPillText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },

  // Instagram-style Stories Tray Section
  storyTraySection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: Colors.white,
  },
  storyTrayScroll: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
    marginRight: 12,
  },
  storyRingWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyGradientRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyInnerBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: Colors.white,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyViewedRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  storyEmptyPlusCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F3F4F6',
  },
  storyPlusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0095F6',
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  storyUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
  storyUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    maxWidth: 72,
  },
  storyUsername: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    flexShrink: 1,
  },

  // Filter Tabs
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: Colors.text,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textGray,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary,
  },
  tabBadgeInactive: {
    backgroundColor: '#E5E7EB',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: Colors.white,
  },
  tabBadgeTextInactive: {
    color: Colors.textGray,
  },

  // List & Items
  mainList: {
    backgroundColor: Colors.white,
    flex: 1,
  },
  listContent: {
    paddingBottom: 28,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  convItemUnread: {
    backgroundColor: '#FAFAFA',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginHorizontal: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
  convDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  convHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  participantNameUnread: {
    fontWeight: '800',
  },
  timeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timeAgoUnread: {
    color: Colors.primary,
    fontWeight: '700',
  },
  convMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snippetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  lastMessageText: {
    fontSize: 13,
    color: Colors.textGray,
    flex: 1,
  },
  unreadMessageText: {
    color: Colors.text,
    fontWeight: '700',
  },
  blockedMessageText: {
    color: '#EF4444',
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  unreadBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  requestPill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  requestPillText: {
    color: '#EA580C',
    fontSize: 11,
    fontWeight: '700',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textGray,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF4EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  browseButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBannerWrapper: {
    width: '100%',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBannerContainer: {
    paddingVertical: 4,
    marginVertical: 0,
  },
});
