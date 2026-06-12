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
      await api.post('/playlists', { name: newPlaylistName, videoId });
      showAlert('Success', 'Playlist created and video added');
      setNewPlaylistName('');
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Save video to...</Text>
            <TouchableOpacity onPress={onClose}>
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
                  <View style={styles.createBox}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter playlist name"
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.createBtn} onPress={createAndAdd}>
                      <Text style={styles.createBtnText}>Create</Text>
                    </TouchableOpacity>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
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
    paddingVertical: 15,
  },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    fontSize: 16,
    paddingVertical: 8,
    marginBottom: 10,
  },
  createBtn: {
    alignSelf: 'flex-end',
  },
  createBtnText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PlaylistModal;
