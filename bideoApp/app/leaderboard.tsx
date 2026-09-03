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
  videoCount: number;
  rank: number;
  isFollowing?: boolean;
  isCurrentUser?: boolean;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/users/leaderboard');
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setLeaderboard(res.data.data);
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, []);

  const topThree = leaderboard.slice(0, 3);
  const rankFirst = topThree.find((u) => u.rank === 1);
  const rankSecond = topThree.find((u) => u.rank === 2);
  const rankThird = topThree.find((u) => u.rank === 3);
  const remainingUsers = leaderboard.slice(3);

  const renderPodiumCard = (item?: LeaderboardUser, rank?: number) => {
    if (!item) {
      return (
        <View style={[styles.podiumCol, rank === 1 ? styles.podiumColFirst : null]}>
          <View
            style={[
              styles.emptyPodiumAvatar,
              rank === 1 ? styles.avatarGold : rank === 2 ? styles.avatarSilver : styles.avatarBronze,
            ]}
          >
            <Ionicons name="person-outline" size={22} color={Colors.textGray} />
          </View>
          <Text style={styles.emptyPodiumText}>--</Text>
        </View>
      );
    }

    const isFirst = rank === 1;
    const isSecond = rank === 2;

    const medalBorderColor = isFirst ? '#F59E0B' : isSecond ? '#9CA3AF' : '#D97706';
    const medalBgColor = isFirst ? '#FEF3C7' : isSecond ? '#F3F4F6' : '#FFEDD5';
    const medalTextColor = isFirst ? '#92400E' : isSecond ? '#374151' : '#78350F';
    const medalIcon = isFirst ? 'trophy' : 'medal';

    return (
      <TouchableOpacity
        key={item._id}
        activeOpacity={0.85}
        style={[styles.podiumCol, isFirst ? styles.podiumColFirst : null]}
        onPress={() => router.push(`/channel/${item._id}`)}
      >
        {/* Crown on 1st place */}
        {isFirst && (
          <View style={styles.crownContainer}>
            <Text style={styles.crownIcon}>👑</Text>
          </View>
        )}

        {/* Avatar with rank ring */}
        <View style={[styles.podiumAvatarWrap, { borderColor: medalBorderColor }]}>
          <Image
            source={{ uri: item.avatar || FALLBACK_AVATAR }}
            style={isFirst ? styles.podiumAvatarFirst : styles.podiumAvatar}
            contentFit="cover"
            transition={150}
          />
          <View style={[styles.podiumRankBadge, { backgroundColor: medalBorderColor }]}>
            <Text style={styles.podiumRankText}>#{rank}</Text>
          </View>
        </View>

        {/* Creator Channel Name only */}
        <View style={styles.podiumInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.podiumName, isFirst && styles.podiumNameFirst]} numberOfLines={1}>
              {item.channelName || item.name}
            </Text>
            {Boolean(item.isVerified) && <VerifiedBadge size={12} style={{ marginLeft: 2 }} />}
          </View>

          {/* Top Rank Badge */}
          <View style={[styles.podiumPill, { backgroundColor: medalBgColor, borderColor: medalBorderColor }]}>
            <Ionicons name={medalIcon} size={10} color={medalTextColor} />
            <Text style={[styles.podiumPillText, { color: medalTextColor }]}>
              {isFirst ? 'Gold #1' : isSecond ? 'Silver #2' : 'Bronze #3'}
            </Text>
          </View>

          {/* Views count */}
          <View style={styles.viewsBadge}>
            <Ionicons name="flame" size={12} color={Colors.primary} />
            <Text style={styles.viewsText}>{formatViews(item.totalViews || 0)} views</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Sleek Compact Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIconCircle}>
          <Ionicons name="podium" size={20} color={Colors.white} />
        </View>
        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerTitle}>Weekly Creator Rankings</Text>
          <Text style={styles.bannerSubtitle}>Top creators with the highest views this week</Text>
        </View>
      </View>

      {/* Compact Podium Section */}
      {topThree.length > 0 && (
        <View style={styles.podiumSection}>
          <Text style={styles.sectionHeaderTitle}>🏆 Top 3 This Week</Text>
          <View style={styles.podiumRow}>
            {renderPodiumCard(rankSecond, 2)}
            {renderPodiumCard(rankFirst, 1)}
            {renderPodiumCard(rankThird, 3)}
          </View>
        </View>
      )}

      {remainingUsers.length > 0 && (
        <View style={styles.remainingHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Rank 4 - 20</Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: LeaderboardUser }) => {
    const isMe = item._id === currentUser?._id;

    return (
      <TouchableOpacity
        style={[styles.userCard, isMe && styles.userCardMe]}
        activeOpacity={0.7}
        onPress={() => router.push(`/channel/${item._id}`)}
      >
        {/* Rank Number Badge */}
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>#{item.rank}</Text>
        </View>

        {/* Avatar */}
        <View style={styles.cardAvatarWrap}>
          <Image
            source={{ uri: item.avatar || FALLBACK_AVATAR }}
            style={styles.cardAvatar}
            contentFit="cover"
            transition={150}
          />
        </View>

        {/* User Channel Name Only */}
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.channelName || item.name}
            </Text>
            {Boolean(item.isVerified) && <VerifiedBadge size={13} style={{ marginLeft: 3 }} />}
            {isMe && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
        </View>

        {/* Views Count Pill with flame icon */}
        <View style={styles.viewsPill}>
          <Ionicons name="flame" size={13} color={Colors.primary} />
          <Text style={styles.viewsPillText}>{formatViews(item.totalViews || 0)} views</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Sleek Navigation Top Header */}
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
      ) : leaderboard.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="podium-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySubtitle}>Weekly public views will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={remainingUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    paddingBottom: 20,
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
  podiumSection: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    marginLeft: 4,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  podiumColFirst: {
    transform: [{ translateY: -6 }],
  },
  crownContainer: {
    marginBottom: 1,
  },
  crownIcon: {
    fontSize: 18,
  },
  podiumAvatarWrap: {
    borderWidth: 2.5,
    borderRadius: 999,
    padding: 2,
    position: 'relative',
    backgroundColor: Colors.white,
  },
  podiumAvatarFirst: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  emptyPodiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  avatarGold: { borderColor: '#F59E0B' },
  avatarSilver: { borderColor: '#9CA3AF' },
  avatarBronze: { borderColor: '#D97706' },
  emptyPodiumText: {
    marginTop: 4,
    color: Colors.textGray,
    fontWeight: '600',
    fontSize: 11,
  },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  podiumRankText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  podiumInfo: {
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '92%',
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  podiumNameFirst: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  podiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 3,
    gap: 2,
  },
  podiumPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  viewsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  viewsText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  remainingHeaderRow: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    marginBottom: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
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
