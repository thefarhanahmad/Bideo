import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';
import PostCard from '../../components/PostCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import api from '../../services/api';
import AuthModal from '../../components/AuthModal';
const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

export default function FollowingsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [followings, setFollowings] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'short' | 'long'>('all');
  const [loading, setLoading] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadFollowings();
      } else {
        setAuthModalVisible(true);
      }
    }, [isAuthenticated, filter])
  );

  const loadFollowings = async () => {
    setLoading(true);
    try {
      const [fRes, vRes, pRes] = await Promise.all([
        api.get('/followers/me'),
        api.get('/videos/followed', { params: filter === 'all' ? {} : { type: filter === 'short' ? 'short' : 'long' } }),
        api.get('/posts/followed')
      ]);

      if (fRes.data.success) {
        setFollowings(fRes.data.data);
      }
      
      let combined = [];
      if (vRes.data.success) {
        combined.push(...vRes.data.data.map((v: any) => ({ ...v, itemType: 'video' })));
      }
      if (pRes.data.success && filter === 'all') {
        combined.push(...pRes.data.data.map((p: any) => ({ ...p, itemType: 'post' })));
      }
      
      combined.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setFeedItems(combined);
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
            <TouchableOpacity
              key={item._id}
              style={styles.channelItem}
              onPress={() => item.channel?._id && router.push(`/channel/${item.channel._id}`)}
            >
              <Image source={{ uri: item.channel?.avatar || FALLBACK_AVATAR }} style={styles.channelAvatar} />
              <Text style={styles.channelName} numberOfLines={1}>{item.channel.channelName || item.channel.name}</Text>
            </TouchableOpacity>
          ))}
          {followings.length === 0 && !loading && (
            <Text style={{ marginLeft: 15, color: Colors.textGray, alignSelf: 'center' }}>No followed channels</Text>
          )}
          {loading && <ActivityIndicator style={{ marginLeft: 15 }} color={Colors.primary} />}
        </ScrollView>
      </View>
      <View style={styles.filters}>
        {(['all', 'short', 'long'] as const).map((item) => (
          <TouchableOpacity key={item} style={[styles.filterBtn, filter === item && styles.filterBtnActive]} onPress={() => setFilter(item)}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === 'all' ? 'All' : item === 'short' ? 'Shorts' : 'Long'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={feedItems}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => item.itemType === 'post' ? <PostCard post={item} /> : <VideoCard video={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.sectionTitle}>{feedItems.length > 0 ? 'Recent Activity' : ''}</Text>}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No recent activity from followed channels</Text>
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
  filters: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.text,
    fontWeight: '600',
  },
  filterTextActive: {
    color: Colors.white,
  },
});
