import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import VideoCard from '../components/VideoCard';
import api from '../services/api';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/videos/search?q=${query}`);
      if (res.data.success) {
        setResults(res.data.data);
      }
    } catch (err) {
      console.error('Search failed', err);
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
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder="Search IndiaTube"
            value={query}
            onChangeText={setQuery}
            autoFocus
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close" size={20} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={handleSearch}>
          <Ionicons name="search" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <VideoCard video={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.length > 0 && !loading ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No results found for "{query}"</Text>
              </View>
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
    marginHorizontal: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
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
});
