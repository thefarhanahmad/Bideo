import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import VideoCard from '../../components/VideoCard';
import PostCard from '../../components/PostCard';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

export default function ChannelScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'popular' | 'shorts'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChannel();
  }, [id, filter]);

  const loadChannel = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/channels/${id}`, { params: { filter } });
      if (res.data.success) {
        setChannel(res.data.data.channel);
        setVideos(res.data.data.videos || []);
        if (filter === 'all') {
          const postsRes = await api.get('/posts', { params: { owner: id } });
          setPosts(postsRes.data.success ? postsRes.data.data || [] : []);
        } else {
          setPosts([]);
        }
        return;
      }
      throw new Error('Channel not found');
    } catch (err) {
      const apiError: any = err;
      const status = apiError?.response?.status;
      const message =
        status === 404
          ? 'Channel profile not found'
          : apiError?.response?.data?.message || 'Failed to load channel';
      setError(message);
      setChannel(null);
      setVideos([]);
      setPosts([]);
      console.error('Failed to load channel', apiError);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !channel) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  if (error && !channel) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadChannel}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[
          ...(filter === 'all' ? posts.map((item) => ({ ...item, itemType: 'post' })) : []),
          ...videos.map((item) => ({ ...item, itemType: 'video' })),
        ]}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => item.itemType === 'post' ? <PostCard post={item} /> : <VideoCard video={item} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Image source={{ uri: channel?.avatar || FALLBACK_AVATAR }} style={styles.avatar} />
              <Text style={styles.name}>{channel?.channelName || channel?.name || 'Channel'}</Text>
              <Text style={styles.meta}>{channel?.followersCount || 0} followers</Text>
              {!!channel?.about && <Text style={styles.about}>{channel.about}</Text>}
            </View>
            <View style={styles.filters}>
              {(['all', 'popular', 'shorts'] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
                  onPress={() => setFilter(item)}
                >
                  <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                    {item === 'all' ? 'All' : item === 'popular' ? 'Popular' : 'Shorts'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No videos found</Text> : null}
        refreshing={loading}
        onRefresh={loadChannel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 20, paddingTop: 52, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { position: 'absolute', left: 16, top: 52, padding: 4 },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: Colors.border },
  name: { marginTop: 12, fontSize: 22, fontWeight: 'bold', color: Colors.text },
  meta: { marginTop: 4, color: Colors.textGray },
  about: { marginTop: 10, color: Colors.textGray, textAlign: 'center', lineHeight: 19 },
  filters: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: Colors.white },
  filterBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.text, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  empty: { textAlign: 'center', color: Colors.textGray, marginTop: 40 },
  errorTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
