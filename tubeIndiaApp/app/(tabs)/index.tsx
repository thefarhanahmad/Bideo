import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from 'expo-router';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import PostCard from '../../components/PostCard';
import CategoryList from '../../components/CategoryList';
import { videoService, categoryService } from '../../services/api';
import { fetchVideosStart, fetchVideosSuccess, fetchVideosFailure } from '../../redux/slices/videoSlice';
import { RootState } from '../../redux/store';
import api from '../../services/api';

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

export default function HomeScreen() {
  const dispatch = useDispatch();
  const { videos, loading, error } = useSelector((state: RootState) => state.video);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoriesList, setCategoriesList] = useState<string[]>(['All']);
  const [posts, setPosts] = useState<any[]>([]);
  const [reportVideo, setReportVideo] = useState<any>(null);
  const [reportReason, setReportReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadVideos();
      loadPosts();
      loadCategories();
    }, [isAuthenticated])
  );

  const loadVideos = async () => {
    try {
      dispatch(fetchVideosStart());
      const data = await videoService.getVideos();
      // data: array of videos
      console.log('Fetched videos from API:', data);
      if (data && data.length > 0) {
        // normalize category to name if populated
        const normalized = data.map((v: any) => ({
          ...v,
          category: v.category && (v.category.name || v.category),
        }));
        const ordered = [...normalized].sort((a: any, b: any) => {
          const aFollowing = a?.isFollowing ? 1 : 0;
          const bFollowing = b?.isFollowing ? 1 : 0;
          if (aFollowing !== bFollowing) return bFollowing - aFollowing;
          const aTime = new Date(a?.createdAt || 0).getTime();
          const bTime = new Date(b?.createdAt || 0).getTime();
          return bTime - aTime;
        });
        dispatch(fetchVideosSuccess(ordered));
      } else {
        // Fallback to sample data if API returns empty
        dispatch(fetchVideosSuccess(SAMPLE_VIDEOS));
      }
    } catch (err: any) {
      // Fallback to sample data on error
      console.error('Error fetching videos:', err);
      dispatch(fetchVideosSuccess(SAMPLE_VIDEOS));
      console.log('Using sample data due to API error');
    }
  };

  const loadCategories = async () => {
    try {
      const res = await categoryService.getCategories();
      if (res && res.length > 0) {
        const names = res.map((c: any) => c.name);
        setCategoriesList(['All', 'Posts', ...names]);
      } else {
        setCategoriesList(['All', 'Posts']);
      }
    } catch (e) {
      setCategoriesList(['All', 'Posts']);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadVideos(), loadPosts()]);
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

  const feedItems = [...filteredVideos.map((item: any) => ({ ...item, itemType: 'video' })), ...filteredPosts.map((item: any) => ({ ...item, itemType: 'post' }))]
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  if (loading && videos.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CategoryList
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <FlatList
        data={feedItems}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => item.itemType === 'post' ? <PostCard post={item} /> : <VideoCard video={item} />}
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
      <Modal visible={!!reportVideo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.reportBox}>
            <Text style={styles.reportTitle}>Report video</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Tell us what is wrong"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <View style={styles.reportActions}>
              <TouchableOpacity onPress={() => { setReportVideo(null); setReportReason(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitReport}
                onPress={async () => {
                  try {
                    await api.post(`/videos/${reportVideo._id}/report`, { reason: reportReason });
                    Alert.alert('Report sent', 'Thanks for helping keep Tube India safe.');
                    setReportVideo(null);
                    setReportReason('');
                  } catch (err: any) {
                    Alert.alert('Report failed', err.response?.data?.message || 'Please try again');
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
    paddingBottom: 20,
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
    borderRadius: 8,
    padding: 16,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    minHeight: 90,
    padding: 10,
    textAlignVertical: 'top',
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    gap: 18,
  },
  cancelText: { color: Colors.textGray, fontWeight: '600' },
  submitReport: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  submitReportText: { color: Colors.white, fontWeight: 'bold' },
});
