import { showAlert } from './AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import api from '../services/api';

interface PlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  videoId: string;
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({ visible, onClose, videoId }) => {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  // New playlists are private unless the user picks Public
  const [newPlaylistPrivate, setNewPlaylistPrivate] = useState(true);

  useEffect(() => {
    if (visible) {
      loadPlaylists();
    }
  }, [visible]);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const res = await api.get('/playlists');
      if (res.data.success) {
        setPlaylists(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load playlists', err);
    } finally {
      setLoading(false);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    try {
      await api.put(`/playlists/${playlistId}/add`, { videoId });
      showAlert('Success', 'Video added to playlist');
      onClose();
    } catch (err: any) {
      showAlert('Error', err.response?.data?.message || 'Failed to add video');
    }
  };

  const createAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await api.post('/playlists', { name: newPlaylistName.trim(), videoId, isPrivate: newPlaylistPrivate });
      showAlert('Success', 'Playlist created and video added');
      setNewPlaylistName('');
      setNewPlaylistPrivate(true);
      setIsCreating(false);
      onClose();
    } catch (err: any) {
      showAlert('Error', err.response?.data?.message || 'Failed to create playlist');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Save video to…</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ margin: 20 }} />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.playlistItem} onPress={() => addToPlaylist(item._id)}>
                  <Ionicons name="list" size={20} color={Colors.textGray} />
                  <Text style={styles.playlistName}>{item.name}</Text>
                  {item.videos.some((v: any) => (v._id || v) === videoId) && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListFooterComponent={
                isCreating ? (
                  <View>
                  <View style={styles.createBox}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter playlist name"
                      placeholderTextColor={Colors.textGray}
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      autoFocus
                      onSubmitEditing={createAndAdd}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={[styles.createBtn, !newPlaylistName.trim() && styles.createBtnDisabled]}
                      onPress={createAndAdd}
                      disabled={!newPlaylistName.trim()}
                    >
                      <Text style={styles.createBtnText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.visibilityRow}>
                    {[
                      { value: true, label: 'Private', icon: 'lock-closed-outline' },
                      { value: false, label: 'Public', icon: 'globe-outline' },
                    ].map((opt) => {
                      const selected = newPlaylistPrivate === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.visibilityChip, selected && styles.visibilityChipSelected]}
                          onPress={() => setNewPlaylistPrivate(opt.value)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={opt.icon as any} size={14} color={selected ? Colors.white : Colors.textGray} />
                          <Text style={[styles.visibilityChipText, selected && styles.visibilityChipTextSelected]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.newItem} onPress={() => setIsCreating(true)}>
                    <Ionicons name="add" size={24} color={Colors.primary} />
                    <Text style={styles.newItemText}>New Playlist</Text>
                  </TouchableOpacity>
                )
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playlistName: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
  },
  newItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  newItemText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  createBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  createBtnDisabled: {
    opacity: 0.45,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  visibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F9FAFB',
  },
  visibilityChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  visibilityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textGray,
  },
  visibilityChipTextSelected: {
    color: Colors.white,
  },
  createBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default PlaylistModal;
