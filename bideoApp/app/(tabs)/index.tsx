import { showAlert } from '../../components/AppAlert';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, Modal, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect, useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import PostCard from '../../components/PostCard';
import CategoryList from '../../components/CategoryList';
import { videoService, categoryService } from '../../services/api';
import { fetchVideosStart, fetchVideosSuccess, appendVideos, fetchVideosFailure } from '../../redux/slices/videoSlice';
import { RootState } from '../../redux/store';
import api from '../../services/api';
import AuthModal from '../../components/AuthModal';
import PlaylistModal from '../../components/PlaylistModal';
import { formatViews } from '../../utils/formatDate';
import { AppAdBanner } from '../../components/AppAds';

const SAMPLE_VIDEOS = [
  {
    _id: '1',
    title: 'How To Earn money with youtube from day one 🚀',
    thumbnail: 'https://instagram.fblr14-1.fna.fbcdn.net/v/t51.82787-19/683793881_18351517948215879_3075963706721152161_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr14-1.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFsDBpHkWema8qY4QkhinxORUc93F9Wy6CMTJzt0UxuzFhkFay8IfmQkiLqwdowab8&_nc_ohc=XnL1huEZ2EIQ7kNvwHPmoRb&_nc_gid=LfzUtg5yBmFjJs41K8zqxA&edm=AOmX9WgBAAAA&ccb=7-5&oh=00_Af7Q1IjKnik3TD3pZLnEJ2OHGALRv70O0-p-iJB2zuYNJA&oe=6A04FEBB&_nc_sid=bfaa47',
    views: 285000,
    duration: 742,
    createdAt: new Date().toISOString(),
    category: 'Education',
    owner: {
      name: 'Irfan Technical',
      channelName: 'Irfan Technical',
      avatar: 'https://instagram.fblr14-1.fna.fbcdn.net/v/t51.82787-19/683793881_18351517948215879_3075963706721152161_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr14-1.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFsDBpHkWema8qY4QkhinxORUc93F9Wy6CMTJzt0UxuzFhkFay8IfmQkiLqwdowab8&_nc_ohc=XnL1huEZ2EIQ7kNvwHPmoRb&_nc_gid=LfzUtg5yBmFjJs41K8zqxA&edm=AOmX9WgBAAAA&ccb=7-5&oh=00_Af7Q1IjKnik3TD3pZLnEJ2OHGALRv70O0-p-iJB2zuYNJA&oe=6A04FEBB&_nc_sid=bfaa47',
    }
  },
  {
    _id: '2',
    title: 'Hyderabad Vlog 🇮🇳 | Charminar, Biryani & Night Street Life',
    thumbnail: 'https://instagram.fblr14-1.fna.fbcdn.net/v/t51.82787-19/541493858_18319939237215842_3331823820218590243_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr14-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gFKUTa7axaZK7rtRCiKv-B-UoJx10n8GUkorsb6NDn19cUClcGKxP6VoCWPrx_FR7A&_nc_ohc=JxcAavXR2ckQ7kNvwGoOA7a&_nc_gid=73mQnu13SN0avJDEBTaXcw&edm=APoiHPcBAAAA&ccb=7-5&oh=00_Af6GV2Qol-SvuujoFJdVJr0hBDFXY1XQ7Z5guw8KZvV0cQ&oe=6A050634&_nc_sid=22de04',
    views: 850000,
    duration: 1230,
    createdAt: new Date().toISOString(),
    category: 'Vlog',
    owner: {
      name: 'Ataul Vlogs',
      channelName: 'Ataul Vlogs',
      avatar: 'https://instagram.fblr14-1.fna.fbcdn.net/v/t51.82787-19/541493858_18319939237215842_3331823820218590243_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr14-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gFKUTa7axaZK7rtRCiKv-B-UoJx10n8GUkorsb6NDn19cUClcGKxP6VoCWPrx_FR7A&_nc_ohc=JxcAavXR2ckQ7kNvwGoOA7a&_nc_gid=73mQnu13SN0avJDEBTaXcw&edm=APoiHPcBAAAA&ccb=7-5&oh=00_Af6GV2Qol-SvuujoFJdVJr0hBDFXY1XQ7Z5guw8KZvV0cQ&oe=6A050634&_nc_sid=22de04',
    }
  },
  {
    _id: '3',
    title: 'Top 10 Tech Gadgets You Need in 2026',
    thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    views: 2500000,
    duration: 900,
    createdAt: new Date().toISOString(),
    category: 'Tech',
    owner: {
      name: 'Tech Master',
      channelName: 'Tech Master',
      avatar: 'https://i.pravatar.cc/150?u=tech',
    }
  }
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function HomeScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { videos, loading, error } = useSelector((state: RootState) => state.video);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoriesList, setCategoriesList] = useState<string[]>(['All']);
  const [posts, setPosts] = useState<any[]>([]);

  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    loadVideos();
    loadPosts();
    loadCategories();
  }, [isAuthenticated]);

  const loadVideos = async () => {
    try {
      dispatch(fetchVideosStart());
      const data = await videoService.getVideos();
      if (data && data.length > 0) {
        const normalized = data.map((v: any) => ({
          ...v,
          category: v.category && (v.category.name || v.category),
          isPinned: v.isPinned === true || v.isPinned === 'true',
        }));
        const pinned = normalized.filter((v: any) => v.isPinned);
        const regular = normalized.filter((v: any) => !v.isPinned);
        const randomized = [...pinned, ...shuffleArray(regular)];
        dispatch(fetchVideosSuccess(randomized));
      } else {
        dispatch(fetchVideosSuccess(shuffleArray(SAMPLE_VIDEOS)));
      }
    } catch (err: any) {
      console.error('Error fetching videos:', err);
      dispatch(fetchVideosSuccess(shuffleArray(SAMPLE_VIDEOS)));
    }
  };

  const loadCategories = async () => {
    try {
      const res = await categoryService.getCategories();
      if (res && res.length > 0) {
        let names = res.map((c: any) => c.name);
        for (let i = names.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [names[i], names[j]] = [names[j], names[i]];
        }
        setCategoriesList(['All', 'Posts', ...names]);
      } else {
        setCategoriesList(['All', 'Posts']);
      }
    } catch (e) {
      setCategoriesList(['All', 'Posts']);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadVideos(), loadPosts(), loadCategories()]);
  };

  const loadPosts = async () => {
    try {
      const res = await api.get('/posts');
      if (res.data.success) setPosts(res.data.data || []);
    } catch (err) {
      setPosts([]);
    }
  };

  const filteredVideos = selectedCategory === 'All'
    ? videos
    : selectedCategory === 'Posts'
      ? []
      : videos.filter(v => v.category === selectedCategory);

  const filteredPosts = (selectedCategory === 'All' || selectedCategory === 'Posts')
    ? posts
    : [];

  const pinnedVideos = filteredVideos
    .filter((v: any) => v.isPinned === true || v.isPinned === 'true')
    .map((item: any) => ({ ...item, itemType: 'video' }));

  const regularLong = filteredVideos
    .filter((v: any) => !v.isPinned && v.isPinned !== 'true' && !v.isShort)
    .map((item: any) => ({ ...item, itemType: 'video' }));

  const postItems = filteredPosts.map((item: any) => ({ ...item, itemType: 'post' }));

  const longVideosAndPosts = selectedCategory === 'All'
    ? [...pinnedVideos, ...regularLong, ...postItems]
    : [...pinnedVideos, ...[...regularLong, ...postItems].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())];

  const shortsItems = filteredVideos.filter(v => v.isShort);

  const baseItems: any[] = [];
  if (selectedCategory === 'All') {
    baseItems.push(...longVideosAndPosts.slice(0, 2));

    if (shortsItems.length > 0) {
      baseItems.push({
        _id: 'shorts_shelf',
        itemType: 'shorts_shelf',
        data: shortsItems.slice(0, 4),
      });
    }

    baseItems.push(...longVideosAndPosts.slice(2));
  } else if (selectedCategory === 'Posts') {
    baseItems.push(...filteredPosts.map((p) => ({ ...p, itemType: 'post' })));
  } else {
    baseItems.push(
      ...filteredVideos
        .filter((v) => !v.isShort)
        .map((v) => ({ ...v, itemType: 'video' }))
    );
  }

  const feedData: any[] = [];
  for (let i = 0; i < baseItems.length; i++) {
    feedData.push(baseItems[i]);
    if ((i + 1) % 5 === 0) {
      const prevId = baseItems[i]?._id || `pos_${i}`;
      feedData.push({
        _id: `feed_ad_${prevId}`,
        itemType: 'ad_banner',
      });
    }
  }

  const renderShortsShelf = (shortsList: any[]) => (
    <View style={styles.shortsShelf}>
      <View style={styles.shelfHeader}>
        <View style={styles.shelfHeaderLeft}>
          <View style={styles.shelfIconBadge}>
            <Ionicons name="play" size={14} color={Colors.white} />
          </View>
          <Text style={styles.shelfTitle}>Shorts</Text>
        </View>
        <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push('/shorts')}>
          <Text style={styles.seeAllText}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.shortsGrid}>
        {shortsList.map((item) => (
          <TouchableOpacity
            key={item._id}
            style={styles.shortGridItem}
            activeOpacity={0.9}
            onPress={() => router.push({ pathname: '/shorts', params: { initialShortId: item._id } })}
          >
            <View style={styles.shortThumbWrap}>
              <Image source={{ uri: item.thumbnail }} style={styles.shortThumbnail} contentFit="cover" transition={150} cachePolicy="memory-disk" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.shortThumbGradient} pointerEvents="none" />
              <View style={styles.shortPlayBadge}>
                <Ionicons name="play" size={12} color={Colors.white} />
                <Text style={styles.shortViewsOverlay}>{formatViews(item.views || 0)}</Text>
              </View>
            </View>
            <Text style={styles.shortTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <CategoryList
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      {loading && videos.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={feedData}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            if (item.itemType === 'ad_banner') {
              return <AppAdBanner />;
            }
            if (item.itemType === 'shorts_shelf') {
              return renderShortsShelf(item.data);
            }
            if (item.itemType === 'post') {
              return <PostCard post={item} />;
            }
            return (
              <VideoCard
                video={item}
                onPlaylistPress={(id) => {
                  if (!isAuthenticated) return setAuthModalVisible(true);
                  setSelectedVideo(item);
                  setPlaylistModalVisible(true);
                }}
                onReportPress={(v) => {
                  if (!isAuthenticated) return setAuthModalVisible(true);
                  setSelectedVideo(v);
                  setReportModalVisible(true);
                }}
              />
            );
          }}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No videos found</Text>
            </View>
          }
        />
      )}

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
      />

      <PlaylistModal
        visible={playlistModalVisible}
        onClose={() => {
          setPlaylistModalVisible(false);
          setSelectedVideo(null);
        }}
        videoId={selectedVideo?._id}
      />

      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.reportBox}>
            <Text style={styles.reportTitle}>Report video</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Tell us what is wrong"
              placeholderTextColor={Colors.textGray}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <View style={styles.reportActions}>
              <TouchableOpacity onPress={() => { setReportModalVisible(false); setSelectedVideo(null); setReportReason(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitReport}
                onPress={async () => {
                  try {
                    await api.post(`/videos/${selectedVideo?._id}/report`, { reason: reportReason });
                    showAlert('Report sent', 'Thanks for helping keep Bideo safe.');
                    setReportModalVisible(false);
                    setSelectedVideo(null);
                    setReportReason('');
                  } catch (err: any) {
                    showAlert('Report failed', err.response?.data?.message || 'Please try again');
                  }
                }}
              >
                <Text style={styles.submitReportText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContainer: {
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  reportBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    gap: 18,
  },
  cancelText: { color: Colors.textGray, fontWeight: '600' },
  submitReport: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  submitReportText: { color: Colors.white, fontWeight: 'bold' },
  // Shorts Shelf Styles
  shortsShelf: {
    paddingVertical: 14,
    backgroundColor: Colors.white,
    marginBottom: 5,
    marginHorizontal: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  shelfHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shelfIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  shelfTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginRight: 2,
  },
  shortsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 9,
  },
  shortGridItem: {
    width: '50%',
    padding: 5,
    marginBottom: 8,
  },
  shortThumbWrap: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  shortThumbnail: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#E5E7EB',
  },
  shortThumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
  },
  shortPlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shortViewsOverlay: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  shortTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 7,
    paddingHorizontal: 2,
  },
});
