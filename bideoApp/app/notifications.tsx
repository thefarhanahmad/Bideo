import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import api from '../services/api';
import { EmptyState } from '../components/ListStates';
import { formatTimeAgo } from '../utils/formatDate';
import { RootState } from '../redux/store';
import AuthModal from '../components/AuthModal';

export default function NotificationsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setItems(res.data.data || []);
        DeviceEventEmitter.emit('notificationsViewed');
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      // Reset notification badge on header and update checkpoint on backend
      api.put('/notifications/viewed').catch(() => {});
      DeviceEventEmitter.emit('notificationsViewed');
    }
  }, [isAuthenticated, loadNotifications]);

  const openItem = async (item: any) => {
    if (!item.read) api.put(`/notifications/${item._id}/read`).catch(() => {});
    if (item.video?._id) router.push(`/video/${item.video._id}`);
    else if (item.post?._id) router.push(`/post/${item.post._id}`);
    else if (item.video) router.push(`/video/${item.video}`);
    else if (item.post) router.push(`/post/${item.post}`);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.authContainer}>
          <View style={styles.authIconCircle}>
            <Ionicons name="notifications-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.authTitle}>Sign in to view notifications</Text>
          <Text style={styles.authSubtitle}>
            Activity, comments, likes, and updates from your favorite creators will appear here once you sign in.
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.signInButtonText}>Sign In / Sign Up</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={() => api.put('/notifications/read-all').then(loadNotifications).catch(() => {})}>
          <Text style={styles.readAll}>Read all</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.item, !item.read && styles.unread]} onPress={() => openItem(item)} activeOpacity={0.7}>
              <Image source={{ uri: item.actor?.avatar || 'https://via.placeholder.com/48x48.png?text=U' }} style={styles.avatar} contentFit="cover" transition={200} />
              <View style={styles.itemText}>
                <Text style={styles.message} numberOfLines={2}>{item.message || 'New activity on your content'}</Text>
                <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              subtitle="Likes, comments, follows and other activity will show up here."
            />
          }
          refreshing={loading}
          onRefresh={loadNotifications}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  readAll: { color: Colors.primary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  unread: { backgroundColor: '#FFF7ED' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.border },
  itemText: { flex: 1, marginLeft: 12 },
  message: { color: Colors.text, fontSize: 14, lineHeight: 19 },
  time: { color: Colors.textGray, fontSize: 12, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: 10 },
  empty: { textAlign: 'center', color: Colors.textGray, marginTop: 40 },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  authIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF4EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  signInButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
