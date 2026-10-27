import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import StickyBannerAd from '../components/StickyBannerAd';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { EmptyState, LoadMoreFooter } from '../components/ListStates';
import usePagedList from '../hooks/usePagedList';
import { formatTimeAgo, formatViews, formatDuration } from '../utils/formatDate';

const PAGE_SIZE = 20;

const fetchLikedPage = async (offset: number, limit: number) => {
  const res = await api.get('/users/liked-videos', { params: { offset, limit } });
  return { items: res.data?.data || [], hasMore: Boolean(res.data?.hasMore) };
};

export default function LikedVideosScreen() {
  const router = useRouter();
  const {
    items: videos,
    loading,
    refreshing,
    loadingMore,
    reload,
    loadMore,
  } = usePagedList<any>(fetchLikedPage, PAGE_SIZE, 'liked videos');
  const loadedOnceRef = useRef(false);

  // First visit shows the spinner; coming back refreshes quietly
  useFocusEffect(
    useCallback(() => {
      reload(loadedOnceRef.current ? 'silent' : 'initial');
      loadedOnceRef.current = true;
    }, [reload])
  );


  const renderHorizontalCard = (item: any) => {
    return (
      <TouchableOpacity 
        style={styles.horizontalCard} 
        onPress={() => router.push(`/video/${item._id}`)}
      >
        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" transition={250} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration || 0)}</Text>
          </View>
        </View>
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.videoMeta}>
            {item.owner?.channelName || item.owner?.name}
          </Text>
          <Text style={styles.videoMeta}>
            {formatViews(item.views || 0)} views • {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liked Videos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => renderHorizontalCard(item)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="thumbs-up-outline"
              title="No liked videos yet"
              subtitle="Tap the like button on videos you enjoy and they'll appear here."
            />
          }
          refreshing={refreshing}
          onRefresh={() => reload('refresh')}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<LoadMoreFooter visible={loadingMore} />}
        />
      )}
      <StickyBannerAd />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
  },
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    padding: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbnailContainer: {
    width: 160,
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
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
    justifyContent: 'center',
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
});
