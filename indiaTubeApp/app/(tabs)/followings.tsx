import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import api from '../../services/api';
import AuthModal from '../../components/AuthModal';

export default function FollowingsScreen() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [followings, setFollowings] = useState<any[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadFollowings();
    } else {
      setAuthModalVisible(true);
    }
  }, [isAuthenticated]);

  const loadFollowings = async () => {
    setLoading(true);
    try {
      const [fRes, vRes] = await Promise.all([
        api.get('/followers/me'),
        api.get('/videos/followed')
      ]);

      if (fRes.data.success) {
        setFollowings(fRes.data.data);
      }
      if (vRes.data.success) {
        setRecentVideos(vRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load followings', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated && !authModalVisible) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 20 }}>Please login to see followings</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => setAuthModalVisible(true)}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      <View style={styles.channelBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {followings.map(item => (
            <TouchableOpacity key={item._id} style={styles.channelItem}>
              <Image source={{ uri: item.channel.avatar }} style={styles.channelAvatar} />
              <Text style={styles.channelName} numberOfLines={1}>{item.channel.channelName || item.channel.name}</Text>
            </TouchableOpacity>
          ))}
          {followings.length === 0 && !loading && (
            <Text style={{ marginLeft: 15, color: Colors.textGray, alignSelf: 'center' }}>No followed channels</Text>
          )}
          {loading && <ActivityIndicator style={{ marginLeft: 15 }} color={Colors.primary} />}
        </ScrollView>
      </View>

      <FlatList
        data={recentVideos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <VideoCard video={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.sectionTitle}>{recentVideos.length > 0 ? 'Recent Uploads' : ''}</Text>}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No recent videos from followed channels</Text>
            </View>
          ) : null
        }
        refreshing={loading}
        onRefresh={loadFollowings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  channelBar: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  channelItem: {
    alignItems: 'center',
    width: 80,
    marginLeft: 12,
  },
  channelAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 4,
  },
  channelName: {
    fontSize: 11,
    color: Colors.textGray,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    margin: 15,
    color: Colors.text,
  },
  emptyText: {
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 50,
  },
});
