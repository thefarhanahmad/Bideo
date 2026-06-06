import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';
import api, { setAuthToken } from '../../services/api';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getAvatarUri = (avatar?: string) => {
  if (!avatar) return null;
  const value = avatar.trim();
  if (!value || value === 'default-avatar.png') return null;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('content://') ||
    value.startsWith('data:image/')
  ) {
    return value;
  }
  return null;
};

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { isAuthenticated, user, loading: authLoading } = useSelector((state: RootState) => state.auth);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [myVideos, setMyVideos] = useState<any[]>([]);
  const [likedVideos, setLikedVideos] = useState<any[]>([]);
  const [loadingMyVideos, setLoadingMyVideos] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        if (isAuthenticated) {
          loadAllData();
          setAuthModalVisible(false);
        } else {
          setAuthModalVisible(true);
        }
      }
    }, [isAuthenticated, authLoading])
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={{ marginRight: 15 }} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isAuthenticated]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/users/history');
      if (res.data.success) {
        setHistory(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadMyVideos = async () => {
    setLoadingMyVideos(true);
    try {
      const res = await api.get('/videos/me');
      if (res.data.success) {
        setMyVideos(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load your videos', err);
    } finally {
      setLoadingMyVideos(false);
    }
  };

  const loadPlaylists = async () => {
    try {
      const res = await api.get('/playlists');
      if (res.data.success) {
        setPlaylists(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load playlists', err);
    }
  };

  const loadLikedVideos = async () => {
    try {
      const res = await api.get('/users/liked-videos');
      if (res.data.success) setLikedVideos(res.data.data || []);
    } catch (err) {
      console.error('Failed to load liked videos', err);
    }
  };

  const loadAllData = async () => {
    loadHistory();
    loadMyVideos();
    loadPlaylists();
    loadLikedVideos();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadHistory(),
      loadMyVideos(),
      loadPlaylists(),
      loadLikedVideos()
    ]);
    setRefreshing(false);
  };

  if (!isAuthenticated && !authModalVisible) {
    return (
      <View style={styles.center}>
        <View style={styles.loginCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="library" size={50} color={Colors.primary} />
          </View>
          <Text style={styles.loginTitle}>Your Library</Text>
          <Text style={styles.loginSubtitle}>Login to see your watch history, liked videos, and personal playlists.</Text>
          
          <TouchableOpacity 
            style={styles.mainLoginBtn} 
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.mainLoginBtnText}>Sign In / Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => router.replace('/')}
          >
            <Text style={styles.secondaryBtnText}>Explore Home</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileRow}>
          {getAvatarUri(user?.avatar) ? (
            <Image source={{ uri: getAvatarUri(user?.avatar)! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={30} color={Colors.textGray} />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email || user?.phone}</Text>
            <Text style={styles.channelName}>{user?.channelName || 'No channel name'}</Text>
          </View>
        </View>
        
        {user?.about && (
          <Text style={styles.aboutText} numberOfLines={2}>{user.about}</Text>
        )}

        <View style={styles.headerButtons}>
          {user?._id && (
            <TouchableOpacity style={styles.viewChannelBtn} onPress={() => router.push(`/channel/${user._id}`)}>
              <Ionicons name="person-circle-outline" size={17} color={Colors.white} />
              <Text style={styles.viewChannelBtnText}>View Channel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-channel')}>
            <Text style={styles.editBtnText}>{user?.channelName ? 'Edit Channel' : 'Create Channel'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="time-outline" size={24} color={Colors.text} />
            <Text style={styles.sectionTitle}>History</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {loadingHistory ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
            {history.map(item => (
              <TouchableOpacity key={item._id} style={styles.horizontalItem} onPress={() => router.push(`/video/${item._id}`)}>
                <View style={styles.thumbnailContainer}>
                  <Image source={{ uri: item.thumbnail }} style={styles.horizontalThumbnail} />
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(item.duration || 0)}</Text>
                  </View>
                </View>
                <Text style={styles.horizontalText} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.horizontalOwner}>{item.owner?.channelName || item.owner?.name}</Text>
              </TouchableOpacity>
            ))}
            {history.length === 0 && <Text style={{ color: Colors.textGray }}>No history yet</Text>}
          </ScrollView>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="thumbs-up-outline" size={24} color={Colors.text} />
            <Text style={styles.sectionTitle}>Liked Videos</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/liked-videos')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
          {likedVideos.map(item => (
            <TouchableOpacity key={item._id} style={styles.horizontalItem} onPress={() => router.push(`/video/${item._id}`)}>
              <View style={styles.thumbnailContainer}>
                <Image source={{ uri: item.thumbnail }} style={styles.horizontalThumbnail} />
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(item.duration || 0)}</Text>
                </View>
              </View>
              <Text style={styles.horizontalText} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.horizontalOwner}>{item.owner?.channelName || item.owner?.name}</Text>
            </TouchableOpacity>
          ))}
          {likedVideos.length === 0 && <Text style={{ color: Colors.textGray }}>No liked videos yet</Text>}
        </ScrollView>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="play-outline" size={24} color={Colors.text} />
            <Text style={styles.sectionTitle}>Your Videos</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/your-videos')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {loadingMyVideos ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
            {myVideos.map(item => (
              <TouchableOpacity key={item._id} style={styles.horizontalItem} onPress={() => router.push(`/video/${item._id}`)}>
                <View style={styles.thumbnailContainer}>
                  <Image source={{ uri: item.thumbnail }} style={styles.horizontalThumbnail} />
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(item.duration || 0)}</Text>
                  </View>
                </View>
                <View style={styles.horizontalInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.horizontalText} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.horizontalOwner}>{item.views} views</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.moreBtn} 
                    onPress={() => router.push({ pathname: '/your-videos', params: { autoOpenId: item._id } })}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            {myVideos.length === 0 && <Text style={{ color: Colors.textGray }}>No videos uploaded yet</Text>}
          </ScrollView>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="list-outline" size={24} color={Colors.text} />
            <Text style={styles.sectionTitle}>Playlists</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalListContent}>
          {playlists.map(item => {
            const latestVideo = item.videos && item.videos.length > 0 ? item.videos[item.videos.length - 1] : null;
            return (
              <TouchableOpacity 
                key={item._id} 
                style={styles.horizontalItem}
                onPress={() => router.push({ pathname: `/playlist/${item._id}`, params: { name: item.name } })}
              >
                <View style={styles.horizontalThumbnail}>
                  {latestVideo ? (
                    <Image source={{ uri: latestVideo.thumbnail }} style={styles.horizontalThumbnail} />
                  ) : (
                    <View style={[styles.horizontalThumbnail, styles.playlistPlaceholder]}>
                      <Ionicons name="play" size={30} color={Colors.white} />
                    </View>
                  )}
                  <View style={styles.playlistCount}>
                    <Text style={styles.playlistCountText}>{item.videos.length}</Text>
                    <Ionicons name="list" size={14} color={Colors.white} />
                  </View>
                </View>
                <Text style={styles.horizontalText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.horizontalOwner}>{item.isPrivate ? 'Private' : 'Public'}</Text>
              </TouchableOpacity>
            );
          })}
          {playlists.length === 0 && <Text style={{ color: Colors.textGray }}>No playlists yet</Text>}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  loginCard: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 15,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  mainLoginBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainLoginBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: Colors.textGray,
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    backgroundColor: '#F9FAFB',
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  profileHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textGray,
  },
  channelName: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  aboutText: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 10,
    lineHeight: 18,
  },
  headerButtons: {
    marginTop: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  viewChannelBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 15,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewChannelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 15,
    alignSelf: 'flex-start',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  section: {
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: Colors.text,
  },
  viewAll: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  horizontalListContent: {
    paddingHorizontal: 15,
  },
  horizontalItem: {
    width: 140,
    marginRight: 15,
  },
  thumbnailContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  horizontalThumbnail: {
    width: 140,
    height: 80,
    borderRadius: 8,
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
  horizontalInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  moreBtn: {
    padding: 4,
    marginTop: -2,
  },
  horizontalText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  horizontalOwner: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  playlistPlaceholder: {
    backgroundColor: Colors.textGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistCount: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistCountText: {
    color: Colors.white,
    fontSize: 10,
    marginRight: 4,
    fontWeight: 'bold',
  },
});
