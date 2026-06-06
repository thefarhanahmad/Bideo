import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/Colors';
import VideoCard from '../components/VideoCard';
import api from '../services/api';

export default function YourVideosScreen() {
  const router = useRouter();
  const { autoOpenId } = useLocalSearchParams<{ autoOpenId?: string }>();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);

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
        const data = res.data.data;
        setVideos(data);
        if (autoOpenId) {
          const video = data.find((v: any) => v._id === autoOpenId);
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
        message: `Check out this video on TubeIndia: ${selectedVideo.title}\n${selectedVideo.videoUrl || ''}`,
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <VideoCard 
              video={item} 
              onMenuPress={() => openMenu(item)}
            />
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
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
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
