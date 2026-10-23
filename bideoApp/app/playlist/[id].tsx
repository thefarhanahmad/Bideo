import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import { VideoMenuItem } from '../../components/VideoActionsMenu';
import PlaylistFormModal from '../../components/PlaylistFormModal';
import { showAlert } from '../../components/AppAlert';
import { RootState } from '../../redux/store';
import { hapticLight, hapticSelection } from '../../utils/haptics';
import api from '../../services/api';

interface PlaylistInfo {
  name: string;
  isPrivate: boolean;
  isOwner: boolean;
  owner?: { _id: string; name?: string; channelName?: string } | null;
}

export default function PlaylistDetailsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [info, setInfo] = useState<PlaylistInfo>({ name: name || 'Playlist', isPrivate: false, isOwner: false });
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Modals state
  const [editVisible, setEditVisible] = useState(false);
  const [playlistMenuVisible, setPlaylistMenuVisible] = useState(false);

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
    hapticSelection();
    setPlaylistMenuVisible(true);
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

  // Shared video menu (Add to playlist, Share, Report) plus "Remove" for the playlist owner
  const ownerMenuItems = useCallback(
    (video: any): VideoMenuItem[] =>
      info.isOwner
        ? [{ key: 'remove', label: 'Remove from playlist', icon: 'trash-outline', destructive: true, onPress: () => confirmRemoveVideo(video) }]
        : [],
    [info.isOwner, id]
  );

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
            <VideoCard
              video={item}
              extraMenuItems={ownerMenuItems(item)}
              playlistMenuLabel={info.isOwner ? 'Add to another playlist' : 'Add to Playlist'}
            />
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

      {/* Top Header Playlist Level Options Bottom Overlay Modal */}
      <Modal
        visible={playlistMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPlaylistMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPlaylistMenuVisible(false)}>
          <Pressable
            style={[styles.menuContent, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {info.name}
            </Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setPlaylistMenuVisible(false);
                setEditVisible(true);
              }}
            >
              <Ionicons name="pencil-outline" size={22} color={Colors.text} />
              <Text style={styles.menuText}>Edit name & visibility</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setPlaylistMenuVisible(false);
                confirmDelete();
              }}
            >
              <Ionicons name="trash-outline" size={22} color={Colors.primary} />
              <Text style={[styles.menuText, { color: Colors.primary }]}>Delete playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelItem} onPress={() => setPlaylistMenuVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Playlist Modal */}
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.white,
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
    paddingTop: 6,
    paddingBottom: 20,
    paddingHorizontal: 8,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  menuText: {
    fontSize: 15.5,
    marginLeft: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  cancelItem: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 15.5,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
});
