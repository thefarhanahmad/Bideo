import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Dimensions, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import PostCard from '../../components/PostCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';
import { formatTimeAgo } from '../../utils/formatDate';

const { width } = Dimensions.get('window');
const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

export default function ChannelScreen() {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'videos' | 'shorts' | 'posts'>('videos');
  const [sort, setSort] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [error, setError] = useState<string | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  useEffect(() => {
    loadChannel(filter, sort);
  }, [id, filter, sort]);

  const loadChannel = async (activeFilter = filter, activeSort = sort) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/channels/${id}`, {
        params: { filter: activeFilter, sort: activeSort }
      });
      if (res.data.success) {
        setChannel(res.data.data.channel);
        setVideos(activeFilter === 'posts' ? [] : res.data.data.videos || []);
        setPosts(activeFilter === 'posts' ? res.data.data.posts || [] : []);
        return;
      }
      throw new Error('Channel not found');
    } catch (err) {
      const apiError: any = err;
      setError(apiError?.response?.data?.message || 'Failed to load channel');
      setChannel(null);
      console.error('Load Channel Error:', apiError);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    if (!channel) return;

    const prevFollowing = channel.isFollowing;
    const prevCount = channel.followersCount || 0;

    setChannel({
      ...channel,
      isFollowing: !prevFollowing,
      followersCount: prevFollowing ? prevCount - 1 : prevCount + 1
    });

    try {
      await api.post(`/followers/${id}`);
    } catch (err) {
      setChannel({
        ...channel,
        isFollowing: prevFollowing,
        followersCount: prevCount
      });
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleShare = async () => {
    if (!channel) return;
    try {
      const url = `https://tubeindia.app/channel/${channel._id}`;
      await Share.share({
        message: `Check out ${channel.channelName || channel.name} on TubeIndia!\n${url}`,
        url: url,
      });
    } catch (error) {
      console.error('Share Error:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderHorizontalVideoCard = (item: any) => {
    return (
      <TouchableOpacity
        style={styles.horizontalCard}
        onPress={() => router.push(`/video/${item._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration || 0)}</Text>
          </View>
        </View>
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.videoMeta}>
            {item.views} views • {formatTimeAgo(item.createdAt)}
          </Text>
          <TouchableOpacity style={styles.menuDots} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-vertical" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderShortGridItem = (item: any) => {
    return (
      <TouchableOpacity
        style={styles.shortGridItem}
        onPress={() => router.push({ pathname: '/shorts', params: { initialShortId: item._id } })}
        activeOpacity={0.9}
      >
        <View style={styles.shortGridThumbnailContainer}>
          <Image source={{ uri: item.thumbnail }} style={styles.shortGridThumbnail} />
          <View style={styles.shortViewsBadge}>
            <Ionicons name="play-outline" size={10} color={Colors.white} />
            <Text style={styles.shortViewsText}>{item.views}</Text>
          </View>
        </View>
        <Text style={styles.shortGridTitle} numberOfLines={2}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  const isOwner = user?._id === id;
  const tabItems = [
    { key: 'videos', label: 'Videos' },
    { key: 'shorts', label: 'Shorts' },
    { key: 'posts', label: 'Posts' },
  ] as const;

  const sortOptions = [
    { key: 'latest', label: 'Latest' },
    { key: 'popular', label: 'Popular' },
    { key: 'oldest', label: 'Oldest' },
  ] as const;

  const content = filter === 'posts'
    ? posts.map((item) => ({ ...item, itemType: 'post' }))
    : videos.map((item) => ({ ...item, itemType: 'video' }));

  if (loading && !channel) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  if (error && !channel) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={60} color={Colors.textGray} />
        <Text style={styles.errorTitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadChannel(filter, sort)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

      <FlatList
        key={filter === 'shorts' ? 'shorts-grid' : 'videos-list'}
        data={content}
        numColumns={filter === 'shorts' ? 3 : 1}
        keyExtractor={(item) => item._id}
        columnWrapperStyle={filter === 'shorts' ? styles.shortsRow : null}
        renderItem={({ item }) => {
          if (item.itemType === 'post') return <PostCard post={item} />;
          if (filter === 'shorts') return renderShortGridItem(item);
          return renderHorizontalVideoCard(item);
        }}
        ListHeaderComponent={
          <View>
            {/* Banner Section */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
              </TouchableOpacity>

              {channel?.coverImage ? (
                <Image source={{ uri: channel.coverImage }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverPlaceholder} />
              )}
            </View>

            {/* Profile Section */}
            <View style={styles.profileSection}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: channel?.avatar || FALLBACK_AVATAR }} style={styles.avatar} />
              </View>

              <View style={styles.identityContainer}>
                <Text style={styles.name} numberOfLines={1}>
                  {channel?.channelName || channel?.name || 'Channel'}
                </Text>
                <Text style={styles.handle}>@{channel?.name || 'user'}</Text>
                <Text style={styles.subscribers}>{channel?.followersCount || 0} subscribers</Text>

                {!!channel?.about && (
                  <TouchableOpacity activeOpacity={0.7} style={styles.aboutContainer} onPress={() => Alert.alert('About', channel.about)}>
                    <Text style={styles.aboutPreview} numberOfLines={2}>
                      {channel.about}
                    </Text>
                    <Text style={styles.moreAboutText}>more <Ionicons name="chevron-forward" size={10} color={Colors.textGray} /></Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.actionRow}>
                {isOwner ? (
                  <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-channel')}>
                    <Text style={styles.editBtnText}>Edit Channel</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.followBtn, channel?.isFollowing && styles.followedBtn]}
                    onPress={handleFollow}
                  >
                    <Text style={[styles.followBtnText, channel?.isFollowing && styles.followedBtnText]}>
                      {channel?.isFollowing ? 'Following' : 'Subscribe'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.iconActionBtn} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tabs & Filters */}
            <View style={styles.tabsSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                {tabItems.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.tabBtn, filter === item.key && styles.tabBtnActive]}
                    onPress={() => setFilter(item.key)}
                  >
                    <Text style={[styles.tabText, filter === item.key && styles.tabTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.sortContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {sortOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortBtn, sort === opt.key && styles.sortBtnActive]}
                    onPress={() => setSort(opt.key)}
                  >
                    <Text style={[styles.sortText, sort === opt.key && styles.sortTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="videocam-outline" size={60} color={Colors.border} />
            <Text style={styles.empty}>No {filter} found yet</Text>
          </View>
        ) : null}
        refreshing={loading}
        onRefresh={() => loadChannel(filter, sort)}
        contentContainerStyle={[
          styles.listContent,
          filter === 'shorts' ? styles.shortsListPadding : null
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header / Banner
  header: { backgroundColor: Colors.white, position: 'relative' },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 40,
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20
  },
  coverImage: {
    width: '100%',
    aspectRatio: 20 / 9, // Restored ratio
    backgroundColor: Colors.border,
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 20 / 9,
    backgroundColor: '#E5E7EB',
  },

  // Profile Info
  profileSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  avatarWrapper: {
    marginTop: -40, // Perfect overlap
    marginBottom: 9,
    alignSelf: 'flex-start',
    padding: 3,
    backgroundColor: Colors.white,
    borderRadius: 45,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.border
  },
  identityContainer: {
    width: '100%',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  handle: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 4,
    fontWeight: '600',
  },
  subscribers: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 4,
    fontWeight: '500',
  },
  aboutContainer: {
    marginTop: 12,
  },
  aboutPreview: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  moreAboutText: {
    fontSize: 13,
    color: Colors.textGray,
    fontWeight: '700',
    marginTop: 4,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
  },
  followBtn: {
    flex: 1,
    backgroundColor: Colors.text,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followedBtn: {
    backgroundColor: '#F2F2F2',
  },
  followBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  followedBtnText: {
    color: Colors.text,
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  iconActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabsSection: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
    marginTop: -10,
  },
  tabsScroll: {
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.text,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textGray,
  },
  tabTextActive: {
    color: Colors.text,
  },

  // Sort Filters
  sortContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sortBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
    marginRight: 10,
  },
  sortBtnActive: {
    backgroundColor: Colors.text,
  },
  sortText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sortTextActive: {
    color: Colors.white,
  },

  // Horizontal Card (Videos)
  horizontalCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  thumbnailContainer: {
    width: 160,
    aspectRatio: 20 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 10,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  videoMeta: {
    fontSize: 12,
    color: Colors.textGray,
  },
  menuDots: {
    position: 'absolute',
    top: -4,
    right: -10,
    padding: 10,
  },

  // Short Grid
  shortsRow: {
    paddingHorizontal: 2,
  },
  shortsListPadding: {
    paddingBottom: 20,
  },
  shortGridItem: {
    flex: 1 / 3,
    aspectRatio: 9 / 16,
    margin: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  shortGridThumbnailContainer: {
    flex: 1,
  },
  shortGridThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  shortViewsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  shortViewsText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  shortGridTitle: {
    position: 'absolute',
    bottom: 25,
    left: 8,
    right: 8,
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Utils
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textGray,
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
