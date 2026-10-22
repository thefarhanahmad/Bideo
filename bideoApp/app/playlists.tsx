import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { EmptyState } from '../components/ListStates';
import PlaylistFormModal from '../components/PlaylistFormModal';
import { showAlert } from '../components/AppAlert';
import { hapticLight } from '../utils/haptics';

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const PADDING = 15;
const CARD_WIDTH = (width - PADDING * 2 - GRID_GAP) / 2;

export default function PlaylistsScreen() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPlaylists();
    }, [])
  );

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const res = await api.get('/playlists');
      if (res.data?.success) {
        setPlaylists(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load playlists', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (name: string, isPrivate: boolean) => {
    try {
      const res = await api.post('/playlists', { name, isPrivate });
      if (res.data?.success) {
        setCreateModalVisible(false);
        loadPlaylists();
      }
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.message || 'Failed to create playlist');
      throw err;
    }
  };

  const renderGridCard = ({ item }: { item: any }) => {
    const videoList = item.videos || [];
    const count = videoList.length;
    const coverVideo = count > 0 ? videoList[count - 1] : null;
    const coverThumbnail = coverVideo?.thumbnail || item.thumbnail;

    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => router.push({ pathname: `/playlist/${item._id}`, params: { name: item.name } })}
        activeOpacity={0.8}
      >
        <View style={styles.thumbnailContainer}>
          {coverThumbnail ? (
            <Image source={{ uri: coverThumbnail }} style={styles.thumbnail} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.thumbnail, styles.placeholder]}>
              <Ionicons name="list" size={32} color={Colors.textGray} />
            </View>
          )}
          <View style={styles.countBadge}>
            <Ionicons name="list" size={11} color={Colors.white} />
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.playlistName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {count} video{count === 1 ? '' : 's'}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Ionicons
              name={item.isPrivate ? 'lock-closed-outline' : 'globe-outline'}
              size={11}
              color={Colors.textGray}
            />
            <Text style={styles.metaText}>{item.isPrivate ? 'Private' : 'Public'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Playlists</Text>
        <TouchableOpacity
          style={styles.newHeaderBtn}
          onPress={() => {
            hapticLight();
            setCreateModalVisible(true);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Create playlist"
        >
          <Ionicons name="add" size={20} color={Colors.primary} />
          <Text style={styles.newHeaderBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading && playlists.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item._id}
          renderItem={renderGridCard}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={loadPlaylists}
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title="No playlists yet"
              subtitle="Organize your favorite videos by creating your first playlist."
            />
          }
        />
      )}

      <PlaylistFormModal
        visible={createModalVisible}
        mode="create"
        initialPrivate
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreatePlaylist}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
  },
  newHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  newHeaderBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: PADDING,
    paddingTop: 16,
    paddingBottom: 30,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F5',
  },
  countBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  countBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  cardInfo: {
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  playlistName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textGray,
  },
  metaDot: {
    fontSize: 12,
    color: Colors.textGray,
  },
});
