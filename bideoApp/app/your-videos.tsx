import { showAlert } from '../components/AppAlert';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import StickyBannerAd from '../components/StickyBannerAd';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/Colors';
import api, { normalizeVideo } from '../services/api';
import { formatTimeAgo, formatViews, formatDuration } from '../utils/formatDate';
import { shareVideo } from '../utils/shareHelper';
import ShareModal from '../components/ShareModal';
import BottomSheet, { SheetItem, SheetCancel } from '../components/BottomSheet';
import { LoadMoreFooter } from '../components/ListStates';
import usePagedList from '../hooks/usePagedList';

const PAGE_SIZE = 24;

export default function YourVideosScreen() {
  const router = useRouter();
  const { autoOpenId } = useLocalSearchParams<{ autoOpenId?: string }>();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [filter, setFilter] = useState<'videos' | 'shorts'>('videos');

  // Newest first, one page per tab (the server filters videos / shorts)
  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const type = filter === 'shorts' ? 'short' : 'video';
      const res = await api.get('/videos/me', { params: { type, offset, limit } });
      return { items: res.data?.data || [], hasMore: Boolean(res.data?.hasMore) };
    },
    [filter]
  );
  const {
    items: filteredVideos,
    loading,
    refreshing,
    loadingMore,
    reload,
    loadMore,
    updateItems,
  } = usePagedList<any>(fetchPage, PAGE_SIZE, 'your videos');

  // Switching tab starts that tab from its first page
  const shownFilterRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const tabChanged = shownFilterRef.current !== filter;
      shownFilterRef.current = filter;
      reload(tabChanged ? 'initial' : 'silent', { reset: tabChanged });
    }, [filter, reload])
  );

  // Opened from the Library ⋮ button: show that video's menu once
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenId || autoOpenedRef.current || loading) return;
    autoOpenedRef.current = true;
    const openFor = (video: any) => {
      setSelectedVideo(video);
      setMenuVisible(true);
    };
    const loaded = filteredVideos.find((v: any) => v._id === autoOpenId);
    if (loaded) {
      openFor(loaded);
      return;
    }
    api
      .get(`/videos/${autoOpenId}`)
      .then((res) => res.data?.data && openFor(normalizeVideo(res.data.data)))
      .catch((err) => console.error('Failed to open video menu', err));
  }, [autoOpenId, loading, filteredVideos]);


  const handleDelete = async () => {
    const id = selectedVideo?._id;
    setMenuVisible(false);
    
    showAlert(
      'Delete Video',
      'Are you sure you want to delete this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/videos/${id}`);
              updateItems((prev) => prev.filter((v) => v._id !== id));
              showAlert('Success', 'Video deleted');
            } catch (err) {
              showAlert('Error', 'Failed to delete video');
            }
          }
        }
      ]
    );
  };

  const handleShare = () => {
    if (!selectedVideo) return;
    setMenuVisible(false);
    setShareModalVisible(true);
  };

  const handleEdit = () => {
    const id = selectedVideo?._id;
    setMenuVisible(false);
    router.push({ pathname: '/upload-video', params: { editId: id }});
  };

  const openMenu = (video: any) => {
    setSelectedVideo(video);
    setMenuVisible(true);
  };

  const renderHorizontalCard = (item: any) => {
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
            {formatViews(item.views || 0)} views • {formatTimeAgo(item.createdAt)}
          </Text>
          <TouchableOpacity style={styles.menuDots} onPress={(e) => {
            e.stopPropagation();
            openMenu(item);
          }}>
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
            <Text style={styles.shortViewsText}>{formatViews(item.views || 0)}</Text>
          </View>
          <TouchableOpacity style={styles.gridMenuDots} onPress={(e) => {
            e.stopPropagation();
            openMenu(item);
          }}>
            <Ionicons name="ellipsis-vertical" size={14} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.shortGridTitle} numberOfLines={2}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Videos</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/upload', params: { editId: undefined }})}>
          <Ionicons name="add" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterBtn, filter === 'videos' && styles.filterBtnActive]}
          onPress={() => setFilter('videos')}
        >
          <Text style={[styles.filterText, filter === 'videos' && styles.filterTextActive]}>Videos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, filter === 'shorts' && styles.filterBtnActive]}
          onPress={() => setFilter('shorts')}
        >
          <Text style={[styles.filterText, filter === 'shorts' && styles.filterTextActive]}>Shorts</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          key={filter}
          data={filteredVideos}
          numColumns={filter === 'shorts' ? 3 : 1}
          keyExtractor={(item) => item._id}
          columnWrapperStyle={filter === 'shorts' ? styles.shortsRow : null}
          renderItem={({ item }) => filter === 'shorts' ? renderShortGridItem(item) : renderHorizontalCard(item)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>You haven't uploaded any {filter} yet</Text>
            </View>
          }
          refreshing={refreshing}
          onRefresh={() => reload('refresh')}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<LoadMoreFooter visible={loadingMore} />}
        />
      )}

      <StickyBannerAd />

      {/* Action Menu Modal */}
      <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)} title={selectedVideo?.title}>
        <SheetItem icon="pencil-outline" label="Edit Video" onPress={handleEdit} />
        <SheetItem icon="share-social-outline" label="Share Video" onPress={handleShare} />
        <SheetItem icon="trash-outline" label="Delete Video" destructive onPress={handleDelete} />
        <SheetCancel onPress={() => setMenuVisible(false)} />
      </BottomSheet>

      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        item={
          selectedVideo
            ? {
                type: 'video',
                _id: selectedVideo._id,
                title: selectedVideo.title,
                thumbnail: selectedVideo.thumbnail,
                isShort: Boolean(selectedVideo.isShort),
                duration: selectedVideo.duration,
              }
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
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
    paddingBottom: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  filterTextActive: {
    color: Colors.white,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
  },
  
  // Horizontal Card Styles
  horizontalCard: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 12,
  },
  thumbnailContainer: {
    width: 160,
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
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
    paddingRight: 20,
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

  // Short Grid Styles
  shortsRow: {
    paddingHorizontal: 2,
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
  gridMenuDots: {
    position: 'absolute',
    top: 4,
    right: 0,
    padding: 6,
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

});
