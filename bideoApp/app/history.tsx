import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '../constants/Colors';
import VideoCard from '../components/VideoCard';
import { EmptyState, VideoListSkeleton } from '../components/ListStates';
import api from '../services/api';

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/history');
      if (res.data.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch History</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && history.length === 0 ? (
        <VideoListSkeleton />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <VideoCard video={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No watch history yet"
              subtitle="Videos you watch will show up here so you can easily find them again."
            />
          }
          refreshing={loading}
          onRefresh={loadHistory}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  list: {
    paddingTop: 6,
    paddingBottom: 20,
    paddingHorizontal: 8,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 16,
  },
});
