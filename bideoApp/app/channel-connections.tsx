import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import api from '../services/api';
import { RootState } from '../redux/store';
import VerifiedBadge from '../components/VerifiedBadge';
import AuthModal from '../components/AuthModal';
import { hapticLight } from '../utils/haptics';

const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

interface ConnectionUser {
  _id: string;
  name: string;
  channelName?: string;
  avatar?: string;
  isVerified?: boolean;
  followersCount?: number;
  about?: string;
  isFollowing?: boolean;
  isMe?: boolean;
}

export default function ChannelConnectionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    channelId?: string;
    channelName?: string;
    initialTab?: 'followers' | 'followings';
  }>();

  const channelId = params.channelId || '';
  const channelName = params.channelName || 'Channel';
  const initialTab = params.initialTab === 'followings' ? 'followings' : 'followers';

  const { isAuthenticated, user: currentUser } = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState<'followers' | 'followings'>(initialTab);
  const [followers, setFollowers] = useState<ConnectionUser[]>([]);
  const [followings, setFollowings] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [followingInProgress, setFollowingInProgress] = useState<{ [key: string]: boolean }>({});

  const loadData = useCallback(async () => {
    if (!channelId) return;
    try {
      const [followersRes, followingsRes] = await Promise.all([
        api.get(`/followers/${channelId}/followers`),
        api.get(`/followers/${channelId}/followings`),
      ]);

      if (followersRes.data?.success) {
        setFollowers(followersRes.data.data || []);
      }
      if (followingsRes.data?.success) {
        setFollowings(followingsRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleFollow = async (targetUser: ConnectionUser) => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    if (targetUser.isMe || targetUser._id === currentUser?._id) return;

    hapticLight();
    const targetId = targetUser._id;
    const prevStatus = !!targetUser.isFollowing;

    // Optimistic UI update across both lists
    setFollowers((prev) =>
      prev.map((item) => (item._id === targetId ? { ...item, isFollowing: !prevStatus } : item))
    );
    setFollowings((prev) =>
      prev.map((item) => (item._id === targetId ? { ...item, isFollowing: !prevStatus } : item))
    );
    setFollowingInProgress((prev) => ({ ...prev, [targetId]: true }));

    try {
      await api.post(`/followers/${targetId}`);
    } catch (err) {
      // Revert upon error
      setFollowers((prev) =>
        prev.map((item) => (item._id === targetId ? { ...item, isFollowing: prevStatus } : item))
      );
      setFollowings((prev) =>
        prev.map((item) => (item._id === targetId ? { ...item, isFollowing: prevStatus } : item))
      );
    } finally {
      setFollowingInProgress((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const currentList = activeTab === 'followers' ? followers : followings;

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const query = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.channelName && item.channelName.toLowerCase().includes(query))
    );
  }, [currentList, searchQuery]);

  const renderItem = ({ item }: { item: ConnectionUser }) => {
    const isMe = item.isMe || item._id === currentUser?._id;
    const isBusy = !!followingInProgress[item._id];

    return (
      <View style={styles.userRow}>
        <TouchableOpacity
          style={styles.userInfoTouchable}
          activeOpacity={0.7}
          onPress={() => router.push(`/channel/${item._id}`)}
        >
          <Image
            source={{ uri: item.avatar || FALLBACK_AVATAR }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
          />
          <View style={styles.textContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {item.channelName || item.name}
              </Text>
              {Boolean(item.isVerified) && <VerifiedBadge size={13} style={{ marginLeft: 3 }} />}
            </View>
            <Text style={styles.handleText} numberOfLines={1}>
              @{item.name || 'user'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action Button */}
        {!isMe ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              item.isFollowing ? styles.followingBtn : styles.followBtn,
            ]}
            onPress={() => handleToggleFollow(item)}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            {isBusy ? (
              <ActivityIndicator
                size="small"
                color={item.isFollowing ? Colors.textGray : Colors.white}
              />
            ) : (
              <Text
                style={[
                  styles.actionBtnText,
                  item.isFollowing ? styles.followingBtnText : styles.followBtnText,
                ]}
              >
                {item.isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.youPill}>
            <Text style={styles.youPillText}>You</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {channelName}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Instagram-style Dual Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
          onPress={() => setActiveTab('followers')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
            {followers.length} Followers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'followings' && styles.activeTab]}
          onPress={() => setActiveTab('followings')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'followings' && styles.activeTabText]}>
            {followings.length} Following
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.textGray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab === 'followers' ? 'followers' : 'following'}...`}
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
        {Boolean(searchQuery) && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        )}
      </View>

      {/* List Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name={activeTab === 'followers' ? 'people-outline' : 'person-add-outline'}
            size={48}
            color={Colors.border}
          />
          <Text style={styles.emptyTitle}>
            {searchQuery.trim()
              ? 'No matching users found'
              : activeTab === 'followers'
              ? 'No followers yet'
              : 'Not following anyone yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'followers'
              ? 'When users follow this channel, they will appear here.'
              : 'Channels followed by this creator will be listed here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: '75%',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textGray,
  },
  activeTabText: {
    color: Colors.text,
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userInfoTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: '85%',
  },
  handleText: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtn: {
    backgroundColor: Colors.primary,
  },
  followingBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  followBtnText: {
    color: Colors.white,
  },
  followingBtnText: {
    color: Colors.text,
  },
  youPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  youPillText: {
    fontSize: 11,
    color: Colors.textGray,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textGray,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    maxWidth: '80%',
  },
});
