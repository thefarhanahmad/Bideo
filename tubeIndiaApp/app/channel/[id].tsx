import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import PostCard from '../../components/PostCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';
import { formatTimeAgo } from '../../utils/formatDate';

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
      const status = apiError?.response?.status;
      const message =
        status === 404
          ? 'Channel profile not found'
          : apiError?.response?.data?.message || 'Failed to load channel';
      setError(message);
      setChannel(null);
      setVideos([]);
      setPosts([]);
      console.error('Failed to load channel', apiError);
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
          <TouchableOpacity style={styles.menuDots}>
            <Ionicons name="ellipsis-vertical" size={16} color={Colors.text} />
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
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Image source={{ uri: channel?.avatar || FALLBACK_AVATAR }} style={styles.avatar} />
              <Text style={styles.name}>{channel?.channelName || channel?.name || 'Channel'}</Text>
              <Text style={styles.username}>@{channel?.name || 'user'}</Text>
              <Text style={styles.metaText}>{channel?.followersCount || 0} subscribers</Text>
              
              {isOwner ? (
                <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-channel')}>
                  <Ionicons name="create-outline" size={18} color={Colors.white} />
                  <Text style={styles.editBtnText}>Edit Channel</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.followBtn, channel?.isFollowing && styles.followedBtn]} 
                  onPress={handleFollow}
                >
                  <Text style={[styles.followBtnText, channel?.isFollowing && styles.followedBtnText]}>
                    {channel?.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}

              {!!channel?.about && <Text style={styles.about}>{channel.about}</Text>}
            </View>
            
            <View style={styles.tabsContainer}>
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
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No {filter} found</Text> : null}
        refreshing={loading}
        onRefresh={() => loadChannel(filter, sort)}
        contentContainerStyle={filter === 'shorts' ? styles.shortsListPadding : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 20, paddingTop: 52, alignItems: 'center' },
  backBtn: { position: 'absolute', left: 16, top: 52, padding: 4, zIndex: 10 },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: Colors.border },
  name: { marginTop: 12, fontSize: 22, fontWeight: 'bold', color: Colors.text },
  username: { marginTop: 3, color: Colors.textGray, fontSize: 14 },
  metaText: { marginTop: 4, color: Colors.textGray, marginBottom: 15 },
  followBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 10,
  },
  followedBtn: {
    backgroundColor: '#F3F4F6',
  },
  followBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  followedBtnText: {
    color: Colors.text,
  },
  editBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  about: { marginTop: 10, color: Colors.textGray, textAlign: 'center', lineHeight: 19 },
  
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 10,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.text,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textGray,
  },
  tabTextActive: {
    color: Colors.text,
  },

  sortContainer: {
    paddingVertical: 12,
    paddingHorizontal: 15,
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

  horizontalCard: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 12,
  },
  thumbnailContainer: {
    width: 160,
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  videoInfo: {
    flex: 1,
    paddingRight: 15,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  videoMeta: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 4,
  },
  menuDots: {
    position: 'absolute',
    top: 0,
    right: -10,
    padding: 10,
  },

  shortsRow: {
    paddingHorizontal: 2,
  },
  shortsListPadding: {
    paddingBottom: 20,
  },
  shortGridItem: {
    flex: 1/3,
    aspectRatio: 9 / 16,
    margin: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  shortViewsText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  shortGridTitle: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  empty: { textAlign: 'center', color: Colors.textGray, marginTop: 40 },
  errorTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
