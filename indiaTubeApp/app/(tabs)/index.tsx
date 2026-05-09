import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import CategoryList from '../../components/CategoryList';
import { videoService } from '../../services/api';
import { fetchVideosStart, fetchVideosSuccess, fetchVideosFailure } from '../../redux/slices/videoSlice';
import { RootState } from '../../redux/store';

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
      avatar: 'https://i.pravatar.cc/150?u=tech',
    }
  }
];

export default function HomeScreen() {
  const dispatch = useDispatch();
  const { videos, loading, error } = useSelector((state: RootState) => state.video);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      dispatch(fetchVideosStart());
      const response = await videoService.getVideos();
      if (response.data && response.data.length > 0) {
        dispatch(fetchVideosSuccess(response.data));
      } else {
        // Fallback to sample data if API returns empty
        dispatch(fetchVideosSuccess(SAMPLE_VIDEOS));
      }
    } catch (err: any) {
      // Fallback to sample data on error
      dispatch(fetchVideosSuccess(SAMPLE_VIDEOS));
      console.log('Using sample data due to API error');
    }
  };

  const filteredVideos = selectedCategory === 'All'
    ? videos
    : videos.filter(v => v.category === selectedCategory);

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
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <FlatList
        data={filteredVideos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <VideoCard video={item} />}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadVideos}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No videos found</Text>
          </View>
        }
      />
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
});
