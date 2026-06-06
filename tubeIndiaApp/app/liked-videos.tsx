import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { formatTimeAgo } from '../utils/formatDate';

export default function LikedVideosScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadLikedVideos();
    }, [])
  );

  const loadLikedVideos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/liked-videos');
      if (res.data.success) {
        setVideos(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load liked videos', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
            {item.owner?.channelName || item.owner?.name}
          </Text>
          <Text style={styles.videoMeta}>
            {item.views} views • {formatTimeAgo(item.createdAt)}
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
            <View style={styles.center}>
              <Text style={styles.emptyText}>You haven't liked any videos yet</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={loadLikedVideos}
        />
      )}
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
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
  },
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
