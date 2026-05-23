import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import api from '../../services/api';

export default function PlaylistDetailsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlaylistVideos();
  }, [id]);

  const loadPlaylistVideos = async () => {
    setLoading(true);
    try {
      // In a real app, we might have a dedicated GET /api/playlists/:id
      // For now we fetch all and find this one, or assume the backend supports it.
      const res = await api.get('/playlists');
      if (res.data.success) {
        const playlist = res.data.data.find((p: any) => p._id === id);
        if (playlist) {
          setVideos(playlist.videos || []);
        }
      }
    } catch (err) {
      console.error('Failed to load playlist videos', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name || 'Playlist'}</Text>
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
          renderItem={({ item }) => <VideoCard video={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No videos in this playlist</Text>
            </View>
          }
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
});
