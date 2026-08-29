import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Image } from 'expo-image';
import Colors from '../constants/Colors';
import api from '../services/api';
import { RootState } from '../redux/store';
import { formatViews } from '../utils/formatDate';

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);

  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalContent: 0,
    longCount: 0,
    longViews: 0,
    longLikes: 0,
    longComments: 0,
    shortCount: 0,
    shortViews: 0,
    shortLikes: 0,
    shortComments: 0,
    postCount: 0,
    postLikes: 0,
    postComments: 0,
  });

  const fetchAnalytics = async () => {
    try {
      // 1. Fetch user videos
      const vidsRes = await api.get('/videos/me');
      const vids = vidsRes.data?.data || [];
      setVideos(vids);

      // 2. Fetch user community posts
      const ownerId = user?._id || user?.id;
      let posts = [];
      if (ownerId) {
        try {
          const postsRes = await api.get(`/posts?owner=${ownerId}`);
          posts = postsRes.data?.data || [];
        } catch (postErr) {
          console.log('Failed to fetch posts for analytics', postErr);
        }
      }

      // Calculate categorized metrics
      const longVids = vids.filter((v: any) => !v.isShort);
      const shortVids = vids.filter((v: any) => v.isShort);

      const longViews = longVids.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const longLikes = longVids.reduce((sum: number, v: any) => sum + (v.likes?.length || 0), 0);
      const longComments = longVids.reduce((sum: number, v: any) => sum + (v.commentsCount || 0), 0);

      const shortViews = shortVids.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const shortLikes = shortVids.reduce((sum: number, v: any) => sum + (v.likes?.length || 0), 0);
      const shortComments = shortVids.reduce((sum: number, v: any) => sum + (v.commentsCount || 0), 0);

      const postLikes = posts.reduce((sum: number, p: any) => sum + (p.likes?.length || 0), 0);
      const postComments = posts.reduce((sum: number, p: any) => sum + (p.commentsCount || 0), 0);

      const totalViews = longViews + shortViews;
      const totalLikes = longLikes + shortLikes + postLikes;
      const totalComments = longComments + shortComments + postComments;
      const totalContent = vids.length + posts.length;

      setStats({
        totalViews,
        totalLikes,
        totalComments,
        totalContent,
        longCount: longVids.length,
        longViews,
        longLikes,
        longComments,
        shortCount: shortVids.length,
        shortViews,
        shortLikes,
        shortComments,
        postCount: posts.length,
        postLikes,
        postComments,
      });
    } catch (err) {
      console.log('Failed to fetch channel analytics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const topVideos = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Channel Analytics</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
          {/* Main KPI Summary Card */}
          <LinearGradient
            colors={[Colors.primary, '#6A1B9A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroChannelName}>@{user?.channelName || user?.name || 'Your Channel'}</Text>
                <Text style={styles.heroViews}>{formatViews(stats.totalViews)}</Text>
                <Text style={styles.heroLabel}>Total Channel Views</Text>
              </View>
              <View style={styles.statsBadge}>
                <Ionicons name="stats-chart" size={14} color="#FFF" />
                <Text style={styles.statsBadgeText}>Live</Text>
              </View>
            </View>

            <View style={styles.kpiRow}>
              <View style={styles.kpiCol}>
                <Text style={styles.kpiVal}>{stats.totalContent}</Text>
                <Text style={styles.kpiLabel}>Total Uploads</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiCol}>
                <Text style={styles.kpiVal}>{stats.totalLikes}</Text>
                <Text style={styles.kpiLabel}>Total Likes</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiCol}>
                <Text style={styles.kpiVal}>{stats.totalComments}</Text>
                <Text style={styles.kpiLabel}>Comments</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Performance by Content Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Performance</Text>

            {/* Long Videos */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="videocam" size={22} color="#1E88E5" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>Long Form Videos</Text>
                  <Text style={styles.cardSub}>{stats.longCount} Videos Published</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{formatViews(stats.longViews)} views</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.gridItem}>
                  <Ionicons name="eye-outline" size={16} color="#666" />
                  <Text style={styles.gridVal}>{formatViews(stats.longViews)}</Text>
                  <Text style={styles.gridLabel}>Views</Text>
                </View>
                <View style={styles.gridItem}>
                  <Ionicons name="heart-outline" size={16} color="#E91E63" />
                  <Text style={styles.gridVal}>{stats.longLikes}</Text>
                  <Text style={styles.gridLabel}>Likes</Text>
                </View>
                <View style={styles.gridItem}>
                  <Ionicons name="chatbubble-outline" size={16} color="#4CAF50" />
                  <Text style={styles.gridVal}>{stats.longComments}</Text>
                  <Text style={styles.gridLabel}>Comments</Text>
                </View>
              </View>
            </View>

            {/* Shorts / Reels */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#FBE9E7' }]}>
                  <Ionicons name="play-circle" size={22} color="#D84315" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>Shorts & Reels</Text>
                  <Text style={styles.cardSub}>{stats.shortCount} Shorts Published</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.countBadgeText, { color: '#E65100' }]}>{formatViews(stats.shortViews)} views</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.gridItem}>
                  <Ionicons name="eye-outline" size={16} color="#666" />
                  <Text style={styles.gridVal}>{formatViews(stats.shortViews)}</Text>
                  <Text style={styles.gridLabel}>Views</Text>
                </View>
                <View style={styles.gridItem}>
                  <Ionicons name="heart-outline" size={16} color="#E91E63" />
                  <Text style={styles.gridVal}>{stats.shortLikes}</Text>
                  <Text style={styles.gridLabel}>Likes</Text>
                </View>
                <View style={styles.gridItem}>
                  <Ionicons name="chatbubble-outline" size={16} color="#4CAF50" />
                  <Text style={styles.gridVal}>{stats.shortComments}</Text>
                  <Text style={styles.gridLabel}>Comments</Text>
                </View>
              </View>
            </View>

            {/* Community Posts */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#EDE7F6' }]}>
                  <Ionicons name="chatbubbles" size={22} color="#5E35B1" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>Community Posts</Text>
                  <Text style={styles.cardSub}>{stats.postCount} Posts Published</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: '#EDE7F6' }]}>
                  <Text style={[styles.countBadgeText, { color: '#5E35B1' }]}>{stats.postLikes + stats.postComments} Engagements</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.gridItem}>
                  <Ionicons name="heart-outline" size={16} color="#E91E63" />
                  <Text style={styles.gridVal}>{stats.postLikes}</Text>
                  <Text style={styles.gridLabel}>Likes</Text>
                </View>
                <View style={styles.gridItem}>
                  <Ionicons name="chatbubble-outline" size={16} color="#4CAF50" />
                  <Text style={styles.gridVal}>{stats.postComments}</Text>
                  <Text style={styles.gridLabel}>Comments</Text>
                </View>
                <View style={styles.gridItem}>
                  <Ionicons name="document-text-outline" size={16} color="#1E88E5" />
                  <Text style={styles.gridVal}>{stats.postCount}</Text>
                  <Text style={styles.gridLabel}>Posts</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Top Performing Videos */}
          {topVideos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Performing Videos</Text>
              <View style={styles.topVidsCard}>
                {topVideos.map((item: any, idx: number) => (
                  <TouchableOpacity
                    key={item._id}
                    style={[styles.topVidRow, idx === topVideos.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => router.push(item.isShort ? '/(tabs)/shorts' : `/video/${item._id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rankNum}>#{idx + 1}</Text>
                    {item.thumbnail && (
                      <Image source={{ uri: item.thumbnail }} style={styles.vidThumb} contentFit="cover" />
                    )}
                    <View style={styles.vidInfo}>
                      <Text style={styles.vidTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.vidMeta}>
                        {formatViews(item.views || 0)} views  •  {item.likes?.length || 0} likes  •  {item.isShort ? 'Short' : 'Video'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#AAA" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  scrollContent: {
    padding: 14,
  },
  heroCard: {
    borderRadius: 18,
    padding: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroChannelName: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroViews: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 4,
  },
  heroLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  statsBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  kpiLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSub: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  gridItem: {
    alignItems: 'center',
    gap: 2,
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  gridLabel: {
    fontSize: 10,
    color: Colors.textGray,
    fontWeight: '500',
  },
  topVidsCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    overflow: 'hidden',
  },
  topVidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rankNum: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    width: 24,
  },
  vidThumb: {
    width: 56,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#EEE',
  },
  vidInfo: {
    flex: 1,
    marginLeft: 10,
  },
  vidTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  vidMeta: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
});
