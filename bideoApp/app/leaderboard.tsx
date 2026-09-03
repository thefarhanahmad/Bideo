import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import api from '../services/api';
import { RootState } from '../redux/store';
import VerifiedBadge from '../components/VerifiedBadge';
import { formatViews } from '../utils/formatDate';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

interface LeaderboardUser {
  _id: string;
  name: string;
  channelName?: string;
  avatar?: string;
  isVerified?: boolean;
  followersCount?: number;
  about?: string;
  totalViews: number;
  weeklyViews?: number;
  videoCount: number;
  rank: number;
  isFollowing?: boolean;
  isCurrentUser?: boolean;
}

interface FollowerLeaderboardUser {
  _id: string;
  name: string;
  channelName?: string;
  avatar?: string;
  isVerified?: boolean;
  followersCount?: number;
  about?: string;
  weeklyGain?: number;
  rank: number;
  isFollowing?: boolean;
  isCurrentUser?: boolean;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const [viewLeaderboard, setViewLeaderboard] = useState<LeaderboardUser[]>([]);
  const [followerLeaderboard, setFollowerLeaderboard] = useState<FollowerLeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/users/leaderboard');
      if (res.data && res.data.success) {
        const payload = res.data.data;
        if (payload && Array.isArray(payload.topViews)) {
          setViewLeaderboard(payload.topViews);
          setFollowerLeaderboard(payload.topFollowers || []);
        } else if (Array.isArray(payload)) {
          setViewLeaderboard(payload);
          setFollowerLeaderboard(res.data.topFollowers || []);
        }
      } else {
        setViewLeaderboard([]);
        setFollowerLeaderboard([]);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setViewLeaderboard([]);
      setFollowerLeaderboard([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, []);

  const renderFollowerCard = (item: FollowerLeaderboardUser, rank: number) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;

    const medalColor = isFirst ? '#F59E0B' : isSecond ? '#9CA3AF' : isThird ? '#D97706' : '#6B7280';
    const medalBg = isFirst ? '#FEF3C7' : isSecond ? '#F3F4F6' : isThird ? '#FFEDD5' : '#F3F4F6';

    return (
      <TouchableOpacity
        key={`f-${item._id}`}
        activeOpacity={0.8}
        style={styles.followerCard}
        onPress={() => router.push(`/channel/${item._id}`)}
      >
        {/* Crown on 1st place */}
        {isFirst && (
          <View style={styles.followerCrown}>
            <Text style={{ fontSize: 13 }}>👑</Text>
          </View>
        )}

        {/* Avatar with rank ring */}
        <View style={[styles.followerAvatarWrap, { borderColor: medalColor }]}>
          <Image
            source={{ uri: item.avatar || FALLBACK_AVATAR }}
            style={styles.followerAvatar}
            contentFit="cover"
            transition={150}
          />
          <View style={[styles.followerRankBadge, { backgroundColor: medalColor }]}>
            <Text style={styles.followerRankText}>#{rank}</Text>
          </View>
        </View>

        {/* Channel Name */}
        <View style={styles.followerNameRow}>
          <Text style={styles.followerName} numberOfLines={1}>
            {item.channelName || item.name}
          </Text>
          {Boolean(item.isVerified) && (
            <VerifiedBadge size={11} style={{ marginLeft: 2 }} />
          )}
        </View>

        {/* Followers count pill */}
        <View style={[styles.followerPill, { backgroundColor: medalBg }]}>
          <Ionicons name="people" size={10} color={medalColor} />
          <Text style={[styles.followerPillText, { color: medalColor }]} numberOfLines={1}>
            {formatViews(item.followersCount || 0)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: LeaderboardUser }) => {
    const isMe = item._id === currentUser?._id;
    const rank = item.rank;
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;

    const medalColor = isFirst ? '#F59E0B' : isSecond ? '#9CA3AF' : isThird ? '#D97706' : '#6B7280';
    const medalBg = isFirst ? '#FEF3C7' : isSecond ? '#F3F4F6' : isThird ? '#FFEDD5' : '#F9FAFB';

    return (
      <TouchableOpacity
        style={[
          styles.userCard,
          isFirst && styles.userCardFirst,
          isMe && styles.userCardMe,
        ]}
        activeOpacity={0.7}
        onPress={() => router.push(`/channel/${item._id}`)}
      >
        {/* Rank Number Badge */}
        <View
          style={[
            styles.rankBadge,
            (isFirst || isSecond || isThird) && { backgroundColor: medalBg, borderWidth: 1, borderColor: medalColor },
          ]}
        >
          {isFirst ? (
            <Text style={{ fontSize: 13 }}>👑</Text>
          ) : (
            <Text
              style={[
                styles.rankBadgeText,
                (isFirst || isSecond || isThird) && { color: medalColor, fontWeight: '900' },
              ]}
            >
              #{rank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        <View style={[styles.cardAvatarWrap, (isFirst || isSecond || isThird) && { borderColor: medalColor, borderWidth: 1.5 }]}>
          <Image
            source={{ uri: item.avatar || FALLBACK_AVATAR }}
            style={styles.cardAvatar}
            contentFit="cover"
            transition={150}
          />
        </View>

        {/* User Channel Name */}
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, isFirst && { fontWeight: '800' }]} numberOfLines={1}>
              {item.channelName || item.name}
            </Text>
            {Boolean(item.isVerified) && <VerifiedBadge size={13} style={{ marginLeft: 3 }} />}
            {isMe && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
          {(isFirst || isSecond || isThird) && (
            <Text style={[styles.topRankSub, { color: medalColor }]}>
              {isFirst ? '🏆 1st Place' : isSecond ? '🥈 2nd Place' : '🥉 3rd Place'}
            </Text>
          )}
        </View>

        {/* Views Count Pill with flame icon */}
        <View style={styles.viewsPill}>
          <Ionicons name="flame" size={13} color={Colors.primary} />
          <Text style={styles.viewsPillText}>{formatViews(item.totalViews || item.weeklyViews || 0)} views</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Navigation Top Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Leaderboard</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading weekly rankings...</Text>
        </View>
      ) : viewLeaderboard.length === 0 && followerLeaderboard.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="podium-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySubtitle}>Weekly public creator rankings will appear here.</Text>
        </View>
      ) : (
        <View style={styles.mainContent}>
          {/* Pinned Top Section (Banner + Followers Slider + Views Section Header) */}
          <View style={styles.fixedTopSection}>
            {/* Sleek Banner */}
            <View style={styles.banner}>
              <View style={styles.bannerIconCircle}>
                <Ionicons name="podium" size={20} color={Colors.white} />
              </View>
              <View style={styles.bannerTextWrap}>
                <Text style={styles.bannerTitle}>Weekly Creator Rankings</Text>
                <Text style={styles.bannerSubtitle}>Top creators with the highest followers & views this week</Text>
              </View>
            </View>

            {/* Top 10 Creators by Followers (Horizontal Slider - always pinned & visible) */}
            {followerLeaderboard.length > 0 && (
              <View style={styles.followersSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="people" size={15} color={Colors.primary} />
                    <Text style={styles.sectionHeaderTitle}>Top 10 Creators By Followers</Text>
                  </View>
                  <View style={styles.sliderHint}>
                    <Text style={styles.sliderHintText}>Slide</Text>
                    <Ionicons name="chevron-forward" size={12} color={Colors.textGray} />
                  </View>
                </View>

                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={followerLeaderboard}
                  keyExtractor={(item) => `follower-${item._id}`}
                  renderItem={({ item, index }) => renderFollowerCard(item, index + 1)}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Top 20 by Views Section Header (Fixed right above the scrollable views area) */}
            {viewLeaderboard.length > 0 && (
              <View style={styles.viewsHeaderRow}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="flame" size={15} color={Colors.primary} />
                  <Text style={styles.sectionHeaderTitle}>Top 20 Creators By Views</Text>
                </View>
                <Text style={styles.viewsHeaderSubtitle}>This week</Text>
              </View>
            )}
          </View>

          {/* Scrollable Views Column Area (ONLY this area scrolls!) */}
          <View style={styles.viewsListContainer}>
            <FlatList
              data={viewLeaderboard}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary]}
                  tintColor={Colors.primary}
                />
              }
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainContent: {
    flex: 1,
  },
  fixedTopSection: {
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  viewsListContainer: {
    flex: 1,
  },
  navHeader: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  listContent: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textGray,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  bannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 1,
  },

  // Followers Slider Section
  followersSection: {
    marginTop: 10,
    backgroundColor: Colors.white,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  sliderHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sliderHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textGray,
  },
  horizontalListContent: {
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
  followerCard: {
    width: 100,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginRight: 8,
    position: 'relative',
  },
  followerCrown: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    zIndex: 5,
  },
  followerAvatarWrap: {
    borderWidth: 2,
    borderRadius: 999,
    padding: 1.5,
    position: 'relative',
    backgroundColor: Colors.white,
  },
  followerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  followerRankBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  followerRankText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '800',
  },
  followerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    maxWidth: 90,
  },
  followerName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  followerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    gap: 3,
  },
  followerPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Views Section Header
  viewsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  viewsHeaderSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textGray,
  },

  // Views List Item
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  userCardFirst: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  userCardMe: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF9F5',
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
  },
  cardAvatarWrap: {
    marginRight: 10,
    borderRadius: 18,
  },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: '85%',
  },
  topRankSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  youBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  youBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '800',
  },
  viewsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4EB',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  viewsPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
});
