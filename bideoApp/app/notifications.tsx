import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import api, { resolveMediaUrl } from '../services/api';
import { EmptyState, LoadMoreFooter } from '../components/ListStates';
import usePagedList from '../hooks/usePagedList';
import { formatTimeAgo } from '../utils/formatDate';
import { RootState } from '../redux/store';
import AuthModal from '../components/AuthModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { AppAdBanner } from '../components/AppAds';
import { PLACEHOLDER_AVATAR } from '../constants/placeholders';

const FALLBACK_AVATAR = PLACEHOLDER_AVATAR;
const PAGE_SIZE = 30;

const fetchNotificationsPage = async (offset: number, limit: number) => {
  const res = await api.get('/notifications', { params: { offset, limit } });
  if (offset === 0) DeviceEventEmitter.emit('notificationsViewed');
  return { items: res.data?.data || [], hasMore: Boolean(res.data?.hasMore) };
};

// Server messages start with "Recommended for you: …"; users read that as the title, so drop it.
const RECOMMENDED_PREFIX = /^\s*recommended for you\s*:\s*/i;
const stripRecommendedPrefix = (msg: string) => msg.replace(RECOMMENDED_PREFIX, '') || msg;

/**
 * Extracts clean video/post title, actor/channel name, and upload action from notification.
 * Enables showing the content title first, followed by the channel name and timestamp below.
 */
const parseUploadNotification = (item: any) => {
  const isVideoUpload = item.type === 'video_upload' || !!item.video;
  const isPostUpload = item.type === 'post_upload' || (!!item.post && !item.type?.includes('like') && !item.type?.includes('comment'));

  const actorName = item.actor?.channelName || item.actor?.name || '';
  const isShort = Boolean(item.video?.isShort);

  // 1. Check if populated video title or post text is available
  if (isVideoUpload && item.video?.title) {
    return {
      isContentUpload: true,
      contentTitle: item.video.title.trim(),
      channelName: actorName,
      contentTypeLabel: isShort ? 'Short' : 'video',
    };
  }

  if (isPostUpload && item.post?.text) {
    return {
      isContentUpload: true,
      contentTitle: item.post.text.trim(),
      channelName: actorName,
      contentTypeLabel: 'post',
    };
  }

  // 2. Parse from message string (e.g. 'Papppu uploaded a new Short: "Title"' or 'Recommended for you: Channel uploaded a new video: "Title"')
  const rawMsg = stripRecommendedPrefix(item.message || '');

  // Check newline format: `${cleanTitle}\n${creatorName} • ${type}`
  if (rawMsg.includes('\n')) {
    const [titlePart, subPart] = rawMsg.split('\n');
    const channelPart = subPart?.split('•')[0]?.trim() || actorName;
    return {
      isContentUpload: true,
      contentTitle: titlePart.trim(),
      channelName: channelPart,
      contentTypeLabel: subPart?.toLowerCase().includes('short') ? 'Short' : subPart?.toLowerCase().includes('post') ? 'post' : 'video',
    };
  }

  // Match: ChannelName uploaded a new (Short|video): "Title"
  const videoMatch = rawMsg.match(/^(.*?)\s+uploaded\s+a\s+new\s+(Short|video)\s*:\s*"?([^"]*)"?$/i);
  if (videoMatch) {
    const extractedChannel = videoMatch[1]?.trim() || actorName;
    const typeLabel = videoMatch[2]?.toLowerCase() === 'short' ? 'Short' : 'video';
    const extractedTitle = videoMatch[3]?.trim();
    if (extractedTitle) {
      return {
        isContentUpload: true,
        contentTitle: extractedTitle,
        channelName: extractedChannel,
        contentTypeLabel: typeLabel,
      };
    }
  }

  // Match: ChannelName shared a new (community )?post(: "Title")?
  const postMatch = rawMsg.match(/^(.*?)\s+shared\s+a\s+(?:new\s+)?(?:community\s+)?post(?:\s*:\s*"?([^"]*)"?)?$/i);
  if (postMatch) {
    const extractedChannel = postMatch[1]?.trim() || actorName;
    const extractedTitle = postMatch[2]?.trim() || item.post?.text?.trim() || 'Shared a new community post';
    return {
      isContentUpload: true,
      contentTitle: extractedTitle,
      channelName: extractedChannel,
      contentTypeLabel: 'post',
    };
  }

  return { isContentUpload: false };
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const {
    items,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    reload,
    loadMore,
    updateItems,
  } = usePagedList<any>(fetchNotificationsPage, PAGE_SIZE, 'notifications');
  const [activeTab, setActiveTab] = useState<'all' | 'activity' | 'recommendations'>('all');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const isNavigatingRef = useRef(false);

  const isRecommendationNotification = (item: any) => {
    const msg = (item.message || '').toLowerCase();
    return msg.includes('recommended') || item.type === 'recommendation';
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'recommendations') {
      return isRecommendationNotification(item);
    }
    if (activeTab === 'activity') {
      return !isRecommendationNotification(item);
    }
    return true;
  });

  const loadNotifications = useCallback(
    (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (isAuthenticated) reload(mode);
    },
    [isAuthenticated, reload]
  );

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      // Reset notification badge on header and update checkpoint on backend
      api.put('/notifications/viewed').catch(() => {});
      DeviceEventEmitter.emit('notificationsViewed');
    }
  }, [isAuthenticated, loadNotifications]);

  // The Activity / Recommendations tabs filter the loaded rows. If a page held none of them,
  // scrolling would not ask for more, so keep loading until the tab has a screenful.
  useEffect(() => {
    if (activeTab !== 'all' && filteredItems.length < PAGE_SIZE && hasMore && !loading && !loadingMore) {
      loadMore();
    }
  }, [activeTab, filteredItems.length, hasMore, loading, loadingMore, loadMore]);

  const openItem = async (item: any) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1200);

    if (!item.read) {
      api.put(`/notifications/${item._id}/read`).catch(() => {});
      updateItems((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, read: true } : n))
      );
    }

    const videoObj = item.video;
    const postObj = item.post;
    const actorObj = item.actor;

    if (videoObj) {
      const vidId = (videoObj._id || videoObj).toString();
      const isShort = Boolean(videoObj.isShort);
      if (isShort) {
        router.push({ pathname: '/channel-shorts', params: { initialShortId: vidId } });
      } else {
        router.push(`/video/${vidId}`);
      }
      return;
    }

    if (postObj) {
      const pId = (postObj._id || postObj).toString();
      router.push(`/post/${pId}`);
      return;
    }

    if (item.type === 'new_follower' && actorObj) {
      const actId = (actorObj._id || actorObj).toString();
      router.push(`/channel/${actId}`);
      return;
    }

    if (item.type === 'milestone') {
      router.push('/(tabs)');
      return;
    }

    if (item.type === 'system') {
      const msg = (item.message || '').toLowerCase();
      if (msg.includes('monetiz')) {
        router.push('/monetization');
      } else if (msg.includes('withdrawal') || msg.includes('payout')) {
        router.push('/earnings');
      } else {
        router.push('/(tabs)');
      }
      return;
    }

    if (actorObj) {
      const actId = (actorObj._id || actorObj).toString();
      router.push(`/channel/${actId}`);
      return;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'new_follower':
        return { name: 'person-add', color: '#10B981', bg: '#D1FAE5' };
      case 'video_upload':
        return { name: 'videocam', color: '#EA580C', bg: '#FFEDD5' };
      case 'post_upload':
        return { name: 'newspaper', color: '#3B82F6', bg: '#DBEAFE' };
      case 'milestone':
        return { name: 'trophy', color: '#F59E0B', bg: '#FEF3C7' };
      case 'video_like':
      case 'post_like':
      case 'comment_like':
      case 'comment_heart':
        return { name: 'heart', color: '#EF4444', bg: '#FEE2E2' };
      case 'video_comment':
      case 'comment_reply':
      case 'post_comment':
        return { name: 'chatbubble', color: '#6366F1', bg: '#E0E7FF' };
      case 'system':
      default:
        return { name: 'notifications', color: Colors.primary, bg: '#FFF7ED' };
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.authContainer}>
          <View style={styles.authIconCircle}>
            <Ionicons name="notifications-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.authTitle}>Sign in to view notifications</Text>
          <Text style={styles.authSubtitle}>
            Activity, comments, likes, follower updates, and alerts from your favorite creators will appear here once you sign in.
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.signInButtonText}>Sign In / Sign Up</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          onPress={() => {
            api.put('/notifications/read-all').then(() => loadNotifications('silent')).catch(() => {});
          }}
        >
          <Text style={styles.readAll}>Read all</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'activity', label: 'Activity' },
            { id: 'recommendations', label: 'Recommendations' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isAuthenticated && loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const iconInfo = getTypeIcon(item.type);
            const isSystemOrMilestone = item.type === 'milestone' || item.type === 'system';
            const thumbnailUri = item.video?.thumbnail
              ? resolveMediaUrl(item.video.thumbnail)
              : item.post?.image || item.post?.imageUrl
              ? resolveMediaUrl(item.post.image || item.post.imageUrl)
              : null;

            return (
              <TouchableOpacity
                style={[styles.item, !item.read && styles.unread]}
                onPress={() => openItem(item)}
                activeOpacity={0.7}
              >
                {/* Avatar with Type Badge */}
                <View style={styles.avatarWrapper}>
                  {isSystemOrMilestone && !item.actor ? (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: iconInfo.bg }]}>
                      <Ionicons name={iconInfo.name as any} size={22} color={iconInfo.color} />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: resolveMediaUrl(item.actor?.avatar) || FALLBACK_AVATAR }}
                      style={styles.avatar}
                      contentFit="cover"
                      transition={150}
                    />
                  )}
                  {/* Floating Icon Badge */}
                  <View style={[styles.floatingBadge, { backgroundColor: iconInfo.color }]}>
                    <Ionicons name={iconInfo.name as any} size={10} color="#FFFFFF" />
                  </View>
                </View>

                {/* Message & Content Details */}
                <View style={styles.itemText}>
                  {(() => {
                    const parsed = parseUploadNotification(item);
                    if (parsed.isContentUpload && parsed.contentTitle) {
                      return (
                        <>
                          <Text style={styles.contentTitle} numberOfLines={2}>
                            {parsed.contentTitle}
                          </Text>
                          {parsed.channelName ? (
                            <Text style={styles.channelSubtitle} numberOfLines={1}>
                              {parsed.channelName}
                            </Text>
                          ) : null}
                          <View style={styles.metaRow}>
                            <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
                            {isRecommendationNotification(item) && (
                              <View style={styles.recommendedChip}>
                                <Text style={styles.recommendedChipText}>Recommended</Text>
                              </View>
                            )}
                          </View>
                        </>
                      );
                    }

                    const actorName = item.actor?.channelName || item.actor?.name;
                    // "Recommended for you:" is shown as a small chip below, not as part of the message
                    const msg = stripRecommendedPrefix(item.message || 'New activity on your content');
                    const hasActorPrefix = actorName && (msg.toLowerCase().startsWith(actorName.toLowerCase()) || msg.toLowerCase().startsWith('recommended'));

                    return (
                      <>
                        <Text style={styles.message} numberOfLines={3}>
                          {!hasActorPrefix && actorName ? (
                            <Text style={styles.actorName}>{actorName} </Text>
                          ) : null}
                          {msg}
                        </Text>
                        <View style={styles.metaRow}>
                          <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
                          {isRecommendationNotification(item) && (
                            <View style={styles.recommendedChip}>
                              <Text style={styles.recommendedChipText}>Recommended</Text>
                            </View>
                          )}
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Thumbnail Preview on Right if Video or Post Attached */}
                {thumbnailUri && (
                  <Image
                    source={{ uri: thumbnailUri }}
                    style={styles.thumbnailPreview}
                    contentFit="cover"
                    transition={150}
                  />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            activeTab === 'recommendations' ? (
              <EmptyState
                icon="bulb-outline"
                title="No recommendations yet"
                subtitle="Personalized video and post recommendations will appear here."
              />
            ) : activeTab === 'activity' ? (
              <EmptyState
                icon="notifications-outline"
                title="No activity yet"
                subtitle="Likes, comments, followers, and creator alerts will appear here."
              />
            ) : (
              <EmptyState
                icon="notifications-outline"
                title="You're all caught up"
                subtitle="Likes, comments, follows, milestones, and uploads from creators will show up here."
              />
            )
          }
          refreshing={refreshing}
          onRefresh={() => loadNotifications('refresh')}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<LoadMoreFooter visible={loadingMore} />}
        />
      )}

      {/* Bottom Sticky Banner Ad */}
      <View style={styles.bottomBannerWrapper}>
        <AppAdBanner containerStyle={styles.bottomBannerContainer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  tabButtonTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  readAll: { color: Colors.primary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  unread: { backgroundColor: '#FFF7ED' },
  avatarWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  itemText: { flex: 1, marginLeft: 12, marginRight: 8 },
  contentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 2,
  },
  channelSubtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#4B5563',
    lineHeight: 17,
  },
  actorName: { fontWeight: '700', color: Colors.text },
  message: { color: Colors.text, fontSize: 13.5, lineHeight: 18 },
  time: { color: Colors.textGray, fontSize: 11.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  recommendedChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: `${Colors.primary}15`,
  },
  recommendedChipText: { color: Colors.primary, fontSize: 10, fontWeight: '600' },
  thumbnailPreview: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: Colors.border,
    marginRight: 6,
    marginTop: 2,
  },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  authIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF4EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  signInButtonText: {
    color: Colors.white,
    fontSize: 15,
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
