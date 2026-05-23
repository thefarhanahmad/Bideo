import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import VideoCard from '../components/VideoCard';
import api from '../services/api';

export default function YourVideosScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyVideos();
  }, []);

  const loadMyVideos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/videos/me');
      if (res.data.success) {
        setVideos(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load your videos', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Videos</Text>
        <TouchableOpacity onPress={() => router.push('/upload')}>
          <Ionicons name="add" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View>
              <VideoCard video={item} />
              <View style={styles.itemActions}>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => router.push({ pathname: '/upload', params: { editId: item._id }})}
                >
                  <Ionicons name="pencil" size={18} color={Colors.textGray} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => handleDelete(item._id)}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.primary} />
                  <Text style={[styles.actionText, { color: Colors.primary }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>You haven't uploaded any videos yet</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={loadMyVideos}
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
  itemActions: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
    marginTop: -10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    marginLeft: 5,
    fontSize: 14,
    color: Colors.textGray,
  },
});
