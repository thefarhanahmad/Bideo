import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import api from '../services/api';
import VerifiedBadge from './VerifiedBadge';
import { formatViews } from '../utils/formatDate';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

interface MentionSuggestionsProps {
  visible: boolean;
  query: string;
  onSelectUser: (user: { _id: string; name: string; channelName?: string; avatar?: string }) => void;
  onClose?: () => void;
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
  visible,
  query,
  onSelectUser,
  onClose,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) {
      setUsers([]);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.get('/users/search', {
          params: { q: query },
        });
        if (res.data.success) {
          setUsers(res.data.data || []);
        }
      } catch (err) {
        console.log('Failed to search users for mention:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [visible, query]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="at" size={14} color={Colors.primary} />
          <Text style={styles.headerTitle}>Mention a creator</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        )}
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Searching creators...</Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {query ? `No creators found for "${query}"` : 'Type a name to search'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="always"
          style={styles.list}
          renderItem={({ item }) => {
            const displayName = item.channelName || item.name || 'User';
            const handle = item.name || item.channelName || 'user';
            return (
              <TouchableOpacity
                style={styles.userRow}
                activeOpacity={0.7}
                onPress={() => onSelectUser(item)}
              >
                <Image
                  source={{ uri: item.avatar || FALLBACK_AVATAR }}
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.displayName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {Boolean(item.isVerified) && (
                      <VerifiedBadge size={12} style={styles.badge} />
                    )}
                  </View>
                  <Text style={styles.handle} numberOfLines={1}>
                    @{handle}
                    {item.followersCount !== undefined ? ` • ${formatViews(item.followersCount)} followers` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 220,
    marginTop: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    maxHeight: 180,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    maxWidth: '85%',
  },
  badge: {
    marginLeft: 4,
  },
  handle: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textGray,
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textGray,
  },
});

export default MentionSuggestions;
