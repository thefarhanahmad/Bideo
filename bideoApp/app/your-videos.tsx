import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, Share, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { formatTimeAgo, formatViews } from '../utils/formatDate';

export default function YourVideosScreen() {
  const router = useRouter();
  const { autoOpenId } = useLocalSearchParams<{ autoOpenId?: string }>();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [filter, setFilter] = useState<'videos' | 'shorts'>('videos');

  useFocusEffect(
    useCallback(() => {
      loadMyVideos();
    }, [])
  );

  const loadMyVideos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/videos/me');
      if (res.data.success) {
        const data = res.data.data || [];
        // Sort by latest by default
        const sortedData = [...data].sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setVideos(sortedData);
        if (autoOpenId) {
          const video = sortedData.find((v: any) => v._id === autoOpenId);
          if (video) {
            setSelectedVideo(video);
            setMenuVisible(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load your videos', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredVideos = videos.filter(v => filter === 'shorts' ? v.isShort : !v.isShort);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleDelete = async () => {
    const id = selectedVideo?._id;
    setMenuVisible(false);
    
    Alert.alert(
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
              setVideos(videos.filter(v => v._id !== id));
              Alert.alert('Success', 'Video deleted');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete video');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    if (!selectedVideo) return;
    setMenuVisible(false);
    try {
      await Share.share({
        message: `Check out this video on Bideo: ${selectedVideo.title}\n${selectedVideo.videoUrl || ''}`,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleEdit = () => {
    const id = selectedVideo?._id;
    setMenuVisible(false);
    router.push({ pathname: '/upload', params: { editId: id }});
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
          refreshing={loading}
          onRefresh={loadMyVideos}
        />
      )}

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContent}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Ionicons name="pencil-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Edit Video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Share Video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.deleteItem]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color={Colors.primary} />
              <Text style={[styles.menuText, { color: Colors.primary }]}>Delete Video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelItem} onPress={() => setMenuVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: Colors.text,
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
  cancelItem: {
    marginTop: 10,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
});
