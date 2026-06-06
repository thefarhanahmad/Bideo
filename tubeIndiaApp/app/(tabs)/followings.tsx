import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [filter, setFilter] = useState<'all' | 'short' | 'video'>('all');
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
      const videoParams = filter === 'all' ? {} : { type: filter === 'short' ? 'short' : 'video' };
      const [fRes, vRes, pRes] = await Promise.all([
        api.get('/followers/me'),
        api.get('/videos/followed', { params: videoParams }),
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
        <View style={styles.loginCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={50} color={Colors.primary} />
          </View>
          <Text style={styles.loginTitle}>Followings</Text>
          <Text style={styles.loginSubtitle}>Login to see recent activity from your favorite creators and community posts.</Text>
          
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
            <Text style={styles.secondaryBtnText}>Discover Content</Text>
          </TouchableOpacity>
        </View>
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
        {(['all', 'video', 'short'] as const).map((item) => (
          <TouchableOpacity key={item} style={[styles.filterBtn, filter === item && styles.filterBtnActive]} onPress={() => setFilter(item)}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item === 'all' ? 'All' : item === 'short' ? 'Shorts' : 'Videos'}
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
