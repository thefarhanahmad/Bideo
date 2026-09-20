import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import { chatService } from '../../services/api';
import { requestOnlineStatus } from '../../services/socket';
import VerifiedBadge from '../../components/VerifiedBadge';
import AuthModal from '../../components/AuthModal';
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

  const currentUserId = user?._id?.toString() || user?.id?.toString() || '';

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
          .filter(Boolean) as string[];

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
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
    } else {
      loadConversations();
    }

    // Real-time Socket Event Listeners
    const subMsg = DeviceEventEmitter.addListener('chatMessageReceived', () => {
      loadConversations(true);
    });

    const subConv = DeviceEventEmitter.addListener('chatConversationUpdated', (updatedConv: any) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c._id === updatedConv._id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...updatedConv };
          return updated.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
        return [updatedConv, ...prev];
      });
    });

    const subStatus = DeviceEventEmitter.addListener(
      'chatUserStatusChanged',
      (data: { userId: string; isOnline: boolean }) => {
        if (data?.userId) {
          setOnlineMap((prev) => ({
            ...prev,
            [data.userId]: data.isOnline,
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

    return () => {
      subMsg.remove();
      subConv.remove();
      subStatus.remove();
      subOnlineStatus.remove();
    };
  }, [isAuthenticated, loadConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations(true);
  };

  // Online / Active users list
  const onlineConversations = useMemo(() => {
    return conversations.filter((c) => {
      const otherId = c.otherParticipant?._id;
      return otherId && Boolean(onlineMap[otherId] ?? c.otherParticipant.isOnline);
    });
  }, [conversations, onlineMap]);

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
    const isOnline = Boolean(other?._id && (onlineMap[other._id] ?? other.isOnline));
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
          router.push(`/chat/${item._id}`);
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

      {/* Active Now Section (Horizontal Avatars Carousel) */}
      {!searchQuery && onlineConversations.length > 0 && (
        <View style={styles.onlineSection}>
          <Text style={styles.onlineSectionHeader}>ONLINE NOW</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.onlineScroll}
          >
            {onlineConversations.map((c) => {
              const other = c.otherParticipant;
              return (
                <TouchableOpacity
                  key={c._id}
                  style={styles.onlineUserItem}
                  activeOpacity={0.75}
                  onPress={() => {
                    hapticLight();
                    router.push(`/chat/${c._id}`);
                  }}
                >
                  <View style={styles.onlineAvatarWrapper}>
                    <Image
                      source={{ uri: other?.avatar || FALLBACK_AVATAR }}
                      style={styles.onlineAvatar}
                      contentFit="cover"
                      transition={150}
                    />
                    <View style={styles.onlineDot} />
                  </View>
                  <Text style={styles.onlineName} numberOfLines={1}>
                    {other?.channelName || other?.name}
                  </Text>
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

  // Active Now Section
  onlineSection: {
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  onlineSectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textGray,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  onlineScroll: {
    paddingHorizontal: 12,
    gap: 12,
  },
  onlineUserItem: {
    alignItems: 'center',
    width: 64,
  },
  onlineAvatarWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  onlineAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  onlineDot: {
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
  onlineName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
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
});
