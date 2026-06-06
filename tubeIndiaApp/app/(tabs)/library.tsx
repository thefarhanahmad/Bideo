import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/slices/authSlice';
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
        <TouchableOpacity style={{ marginRight: 15 }} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={Colors.primary} />
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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('token');
              setAuthToken(null);
              dispatch(logout());
              router.replace('/');
            } catch (err) {
              console.error('Logout failed', err);
            }
          }
        }
      ]
    );
  };

  if (!isAuthenticated && !authModalVisible) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 20 }}>Please login to view your library</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => setAuthModalVisible(true)}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
            {history.map(item => (
              <TouchableOpacity key={item._id} style={styles.horizontalItem} onPress={() => router.push(`/video/${item._id}`)}>
                <Image source={{ uri: item.thumbnail }} style={styles.horizontalThumbnail} />
                <Text style={styles.horizontalText} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.horizontalOwner}>{item.owner?.channelName || item.owner?.name}</Text>
              </TouchableOpacity>
            ))}
            {history.length === 0 && <Text style={{ marginLeft: 15, color: Colors.textGray }}>No history yet</Text>}
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
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
          {likedVideos.map(item => (
            <TouchableOpacity key={item._id} style={styles.horizontalItem} onPress={() => router.push(`/video/${item._id}`)}>
              <Image source={{ uri: item.thumbnail }} style={styles.horizontalThumbnail} />
              <Text style={styles.horizontalText} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.horizontalOwner}>{item.owner?.channelName || item.owner?.name}</Text>
            </TouchableOpacity>
          ))}
          {likedVideos.length === 0 && <Text style={{ marginLeft: 15, color: Colors.textGray }}>No liked videos yet</Text>}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
            {myVideos.map(item => (
              <TouchableOpacity key={item._id} style={styles.horizontalItem} onPress={() => router.push(`/video/${item._id}`)}>
                <Image source={{ uri: item.thumbnail }} style={styles.horizontalThumbnail} />
                <Text style={styles.horizontalText} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.horizontalOwner}>{item.views} views</Text>
              </TouchableOpacity>
            ))}
            {myVideos.length === 0 && <Text style={{ marginLeft: 15, color: Colors.textGray }}>No videos uploaded yet</Text>}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
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
          {playlists.length === 0 && <Text style={{ marginLeft: 15, color: Colors.textGray }}>No playlists yet</Text>}
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
    padding: 20,
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
  horizontalList: {
    paddingLeft: 15,
  },
  horizontalItem: {
    width: 140,
    marginRight: 15,
  },
  horizontalThumbnail: {
    width: 140,
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
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

