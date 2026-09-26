import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import api, { resolveMediaUrl } from '../services/api';
import { EmptyState } from '../components/ListStates';
import { formatTimeAgo } from '../utils/formatDate';
import { RootState } from '../redux/store';
import AuthModal from '../components/AuthModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { AppAdBanner } from '../components/AppAds';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

export default function NotificationsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const isNavigatingRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setItems(res.data.data || []);
        DeviceEventEmitter.emit('notificationsViewed');
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      // Reset notification badge on header and update checkpoint on backend
      api.put('/notifications/viewed').catch(() => {});
      DeviceEventEmitter.emit('notificationsViewed');
    }
  }, [isAuthenticated, loadNotifications]);

  const openItem = async (item: any) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1200);

    if (!item.read) {
      api.put(`/notifications/${item._id}/read`).catch(() => {});
      setItems((prev) =>
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
        router.push({ pathname: '/shorts', params: { initialShortId: vidId } });
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
            api.put('/notifications/read-all').then(loadNotifications).catch(() => {});
          }}
        >
          <Text style={styles.readAll}>Read all</Text>
        </TouchableOpacity>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
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
                  <Text style={styles.message} numberOfLines={3}>
                    {item.actor?.channelName || item.actor?.name ? (
                      <Text style={styles.actorName}>
                        {item.actor.channelName || item.actor.name}{' '}
                      </Text>
                    ) : null}
                    {item.message || 'New activity on your content'}
                  </Text>
                  <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
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

                {/* Unread indicator dot */}
                {!item.read && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              subtitle="Likes, comments, follows, milestones, and uploads from creators will show up here."
            />
          }
          refreshing={loading}
          onRefresh={loadNotifications}
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
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  readAll: { color: Colors.primary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actorName: { fontWeight: '700', color: Colors.text },
  message: { color: Colors.text, fontSize: 13.5, lineHeight: 18 },
  time: { color: Colors.textGray, fontSize: 11.5, marginTop: 4 },
  thumbnailPreview: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: Colors.border,
    marginRight: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 4,
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
