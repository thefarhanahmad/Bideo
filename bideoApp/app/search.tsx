import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../constants/Colors';
import VideoCard from '../components/VideoCard';
import { EmptyState } from '../components/ListStates';
import api from '../services/api';
import { RootState } from '../redux/store';
import AuthModal from '../components/AuthModal';
import { showAlert } from '../components/AppAlert';
import { hapticLight } from '../utils/haptics';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

function ChannelSearchResultCard({ channel }: { channel: any }) {
  const router = useRouter();
  const [following, setFollowing] = useState(channel.isFollowing);
  const [followersCount, setFollowersCount] = useState(channel.followersCount || 0);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const handleFollow = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    hapticLight();
    const prevFollowing = following;
    setFollowing(!prevFollowing);
    setFollowersCount(prevFollowing ? followersCount - 1 : followersCount + 1);

    try {
      await api.post(`/followers/${channel._id}`);
    } catch (err) {
      setFollowing(prevFollowing);
      setFollowersCount(channel.followersCount || 0);
      showAlert('Error', 'Failed to update follow status');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.channelCard} 
      onPress={() => router.push(`/channel/${channel._id}`)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: channel.avatar || FALLBACK_AVATAR }} 
        style={styles.channelCardAvatar} 
        contentFit="cover" 
        transition={200}
      />
      <View style={styles.channelCardInfo}>
        <Text style={styles.channelCardName} numberOfLines={1}>
          {channel.name}
        </Text>
        {channel.channelName && (
          <Text style={styles.channelCardHandle} numberOfLines={1}>
            @{channel.channelName}
          </Text>
        )}
        <Text style={styles.channelCardSubscribers}>
          {followersCount} follower{followersCount !== 1 ? 's' : ''}
        </Text>
        {channel.about ? (
          <Text style={styles.channelCardAbout} numberOfLines={1}>
            {channel.about}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity 
        style={[styles.followBtn, following && styles.followingBtn]} 
        onPress={handleFollow}
        activeOpacity={0.8}
      >
        <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
    </TouchableOpacity>
  );
}

const SEARCH_HISTORY_KEY = '@bideo_search_history';

const getTerm = (item: any): string => {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  return (item.term || '').toString().trim();
};

type SearchType = 'all' | 'videos' | 'shorts' | 'channels';

const SEARCH_FILTERS: Array<{ id: SearchType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'videos', label: 'Videos' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'channels', label: 'Channels' },
];

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; query?: string; tag?: string }>();
  const initialQuery = (params.q || params.query || params.tag || '').trim();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(Boolean(initialQuery));
  const [searchType, setSearchType] = useState<SearchType>('all');
  // Ignore responses from older searches when the user switches filters quickly
  const latestSearchId = useRef(0);

  useEffect(() => {
    loadHistory();
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const loadHistory = async () => {
    try {
      // 1. Immediately load local cached history
      const cached = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const valid = parsed
              .map((it: any) => ({
                _id: it._id || Math.random().toString(36).substring(7),
                term: getTerm(it),
              }))
              .filter((it: any) => it.term.length > 0);
            setHistory(valid);
          }
        } catch {}
      }

      // 2. Fetch server history if authenticated
      if (isAuthenticated) {
        const res = await api.get('/users/search-history');
        if (res.data?.success && Array.isArray(res.data.data)) {
          const serverItems: any[] = res.data.data;
          const validItems = serverItems
            .map((it: any) => ({
              _id: it._id || Math.random().toString(36).substring(7),
              term: getTerm(it),
            }))
            .filter((it: any) => it.term.length > 0);

          setHistory(validItems);
          AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(validItems)).catch(() => {});
        }
      }
    } catch {
      // Retain existing local history on failure
    }
  };

  const saveToHistory = (termToSave: string) => {
    const cleanTerm = termToSave.trim();
    if (!cleanTerm) return;

    setHistory((prev) => {
      const filtered = prev.filter((item) => getTerm(item).toLowerCase() !== cleanTerm.toLowerCase());
      const updated = [{ _id: Date.now().toString(), term: cleanTerm }, ...filtered].slice(0, 25);
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    if (isAuthenticated) {
      api.post('/users/search-history', { term: cleanTerm }).catch(() => {});
    }
  };

  const handleSearch = async (term = query, type: SearchType = searchType) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    const searchId = ++latestSearchId.current;
    setQuery(cleanTerm);
    saveToHistory(cleanTerm);
    setLoading(true);
    setShowResults(true);
    try {
      const params: Record<string, string> = { q: cleanTerm };
      if (type !== 'all') params.type = type;
      const res = await api.get('/videos/search', { params });
      if (searchId !== latestSearchId.current) return;
      if (res.data.success) {
        const { channels = [], videos = [] } = res.data.data || {};
        const formattedChannels = channels.map((c: any) => ({ ...c, isChannel: true }));
        // Also filter here so the chips work even with a server that ignores `type`
        const isShortVideo = (v: any) => v?.isShort === true || v?.isShort === 'true';
        if (type === 'channels') setResults(formattedChannels);
        else if (type === 'shorts') setResults(videos.filter(isShortVideo));
        else if (type === 'videos') setResults(videos.filter((v: any) => !isShortVideo(v)));
        else setResults([...formattedChannels, ...videos]);
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      if (searchId === latestSearchId.current) setLoading(false);
    }
  };

  const handleSelectFilter = (type: SearchType) => {
    if (type === searchType) return;
    hapticLight();
    setSearchType(type);
    if (query.trim()) handleSearch(query, type);
  };

  const handleRemoveHistoryItem = (termToRemove: string) => {
    hapticLight();
    const cleanTerm = termToRemove.trim();
    if (!cleanTerm) return;

    setHistory((prev) => {
      const updated = prev.filter((item) => getTerm(item).toLowerCase() !== cleanTerm.toLowerCase());
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    if (isAuthenticated) {
      api.delete('/users/search-history', { params: { term: cleanTerm } }).catch(() => {});
    }
  };

  const handleClearAllHistory = () => {
    Alert.alert(
      'Clear search history?',
      'This will remove all your recent searches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            hapticLight();
            setHistory([]);
            await AsyncStorage.removeItem(SEARCH_HISTORY_KEY).catch(() => {});
            if (isAuthenticated) {
              api.delete('/users/search-history').catch(() => {});
            }
          },
        },
      ]
    );
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (showResults) setShowResults(false);
  };

  const filteredHistory = history.filter((h) => {
    const t = getTerm(h);
    return t.length > 0 && (!query.trim() || t.toLowerCase().includes(query.toLowerCase().trim()));
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textGray} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            placeholder="Search Bideo"
            placeholderTextColor={Colors.textGray}
            value={query}
            onChangeText={onQueryChange}
            autoFocus={!initialQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close" size={20} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => handleSearch()}>
          <Ionicons name="search" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {showResults && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {SEARCH_FILTERS.map((f) => {
              const selected = searchType === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => handleSelectFilter(f.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={showResults ? results : filteredHistory}
          keyExtractor={(item, index) => item._id || `${getTerm(item)}-${index}`}
          ListHeaderComponent={
            !showResults && filteredHistory.length > 0 ? (
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyHeaderTitle}>Recent searches</Text>
                <TouchableOpacity
                  onPress={handleClearAllHistory}
                  style={styles.clearAllBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                >
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (!showResults) {
              const termStr = getTerm(item);
              if (!termStr) return null;
              return (
                <View style={styles.historyRow}>
                  <TouchableOpacity
                    style={styles.historyMainContent}
                    onPress={() => handleSearch(termStr)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={19} color={Colors.textGray} />
                    <Text style={styles.historyText} numberOfLines={1}>
                      {termStr}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.historyDeleteBtn}
                    onPress={() => handleRemoveHistoryItem(termStr)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                    accessibilityLabel={`Remove ${termStr}`}
                  >
                    <Ionicons name="close" size={18} color={Colors.textGray} />
                  </TouchableOpacity>
                </View>
              );
            }

            if (item.isChannel) {
              return <ChannelSearchResultCard channel={item} />;
            }
            return <VideoCard video={item} />;
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            showResults && !loading ? (
              <EmptyState
                icon="search-outline"
                title="No results found"
                subtitle={
                  searchType === 'all'
                    ? `We couldn't find anything for "${query}". Try a different search.`
                    : `No ${searchType} found for "${query}". Try "All" or a different search.`
                }
              />
            ) : !showResults ? (
              <EmptyState
                icon="search-outline"
                title="Search Bideo"
                subtitle="Find videos, shorts and creators. Your recent searches will appear here."
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterRow: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipSelected: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  filterChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipTextSelected: {
    color: Colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  list: {
    paddingBottom: 20,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  historyHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  clearAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  historyMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  historyText: {
    marginLeft: 14,
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  historyDeleteBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  channelCardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
  },
  channelCardInfo: {
    flex: 1,
    marginLeft: 15,
    marginRight: 10,
    justifyContent: 'center',
  },
  channelCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  channelCardHandle: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  channelCardSubscribers: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  channelCardAbout: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  followingBtnText: {
    color: Colors.text,
  },
});
