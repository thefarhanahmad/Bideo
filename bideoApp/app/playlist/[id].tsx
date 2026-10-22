import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import PlaylistFormModal from '../../components/PlaylistFormModal';
import { showAlert } from '../../components/AppAlert';
import { RootState } from '../../redux/store';
import { hapticLight } from '../../utils/haptics';
import api from '../../services/api';

// Let the menu alert finish fading out before opening the next popup (iOS cannot stack them)
const AFTER_ALERT_MS = 350;
const afterAlertCloses = (fn: () => void) => setTimeout(fn, AFTER_ALERT_MS);

interface PlaylistInfo {
  name: string;
  isPrivate: boolean;
  isOwner: boolean;
  owner?: { _id: string; name?: string; channelName?: string } | null;
}

export default function PlaylistDetailsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [info, setInfo] = useState<PlaylistInfo>({ name: name || 'Playlist', isPrivate: false, isOwner: false });
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPlaylist();
    }, [id])
  );

  // Older servers only list the signed-in user's own playlists
  const loadFromOwnPlaylists = async () => {
    const res = await api.get('/playlists');
    const playlist = res.data?.success ? res.data.data.find((p: any) => p._id === id) : null;
    if (!playlist) return false;
    setInfo({ name: playlist.name, isPrivate: Boolean(playlist.isPrivate), isOwner: true, owner: null });
    setVideos(playlist.videos || []);
    return true;
  };

  const loadPlaylist = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/playlists/${id}`);
      if (res.data?.success) {
        const p = res.data.data;
        setInfo({ name: p.name, isPrivate: Boolean(p.isPrivate), isOwner: Boolean(p.isOwner), owner: p.owner });
        setVideos(p.videos || []);
        setNotFound(false);
        return;
      }
    } catch (err) {
      try {
        if (isAuthenticated && (await loadFromOwnPlaylists())) {
          setNotFound(false);
          return;
        }
      } catch {
        // fall through to "not available"
      }
      console.error('Failed to load playlist', err);
    } finally {
      setLoading(false);
    }
    setNotFound(true);
  };

  const handleEdit = async (newName: string, isPrivate: boolean) => {
    try {
      await api.put(`/playlists/${id}`, { name: newName, isPrivate });
      setInfo((prev) => ({ ...prev, name: newName, isPrivate }));
      setEditVisible(false);
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to update playlist');
      throw err;
    }
  };

  const confirmDelete = () => {
    showAlert('Delete playlist?', `"${info.name}" will be deleted. The videos themselves are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/playlists/${id}`);
            router.back();
          } catch (err: any) {
            showAlert('Error', err?.response?.data?.message || 'Failed to delete playlist');
          }
        },
      },
    ]);
  };

  const openPlaylistMenu = () => {
    hapticLight();
    showAlert(info.name, undefined, [
      { text: 'Edit name & visibility', onPress: () => afterAlertCloses(() => setEditVisible(true)) },
      { text: 'Delete playlist', style: 'destructive', onPress: () => afterAlertCloses(confirmDelete) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmRemoveVideo = (video: any) => {
    showAlert('Remove from playlist?', video.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/playlists/${id}/videos/${video._id}`);
            setVideos((prev) => prev.filter((v) => v._id !== video._id));
          } catch (err: any) {
            showAlert('Error', err?.response?.data?.message || 'Failed to remove video');
          }
        },
      },
    ]);
  };

  const ownerName = info.owner?.channelName || info.owner?.name;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {info.name}
        </Text>
        {info.isOwner && !notFound ? (
          <TouchableOpacity
            onPress={openPlaylistMenu}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Playlist options"
          >
            <Ionicons name="ellipsis-vertical" size={22} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {!notFound && (
        <View style={styles.infoRow}>
          {ownerName ? (
            <TouchableOpacity onPress={() => info.owner?._id && router.push(`/channel/${info.owner._id}`)}>
              <Text style={styles.ownerName} numberOfLines={1}>
                {ownerName}
              </Text>
            </TouchableOpacity>
          ) : null}
          {ownerName ? <Text style={styles.infoDot}>•</Text> : null}
          <Text style={styles.infoText}>
            {videos.length} video{videos.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.infoDot}>•</Text>
          <Ionicons name={info.isPrivate ? 'lock-closed-outline' : 'globe-outline'} size={13} color={Colors.textGray} />
          <Text style={[styles.infoText, { marginLeft: 3 }]}>{info.isPrivate ? 'Private' : 'Public'}</Text>
        </View>
      )}

      {loading && videos.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notFound ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={44} color={Colors.textGray} />
          <Text style={styles.emptyText}>This playlist is private or no longer available</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <VideoCard video={item} onMenuPress={info.isOwner ? () => confirmRemoveVideo(item) : undefined} />
          )}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadPlaylist}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No videos in this playlist</Text>
            </View>
          }
        />
      )}

      <PlaylistFormModal
        visible={editVisible}
        mode="edit"
        initialName={info.name}
        initialPrivate={info.isPrivate}
        onClose={() => setEditVisible(false)}
        onSubmit={handleEdit}
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
    gap: 12,
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ownerName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: 180,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textGray,
  },
  infoDot: {
    fontSize: 13,
    color: Colors.textGray,
    marginHorizontal: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  list: {
    paddingBottom: 20,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
    textAlign: 'center',
  },
});
