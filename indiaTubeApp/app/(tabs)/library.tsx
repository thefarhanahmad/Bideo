import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';

const HISTORY = [
  { id: 'h1', title: 'React Native Tutorial', thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=300&q=80', owner: 'CodeMaster' },
  { id: 'h2', title: 'Nature Chill Mix', thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=300&q=80', owner: 'LoFi Girl' },
  { id: 'h3', title: 'Top 5 AI Tools', thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=300&q=80', owner: 'AI Today' },
];

const MENU_ITEMS = [
  { id: '2', icon: 'play-outline', label: 'Your videos' },
];

export default function LibraryScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="time-outline" size={24} color={Colors.text} />
            <Text style={styles.sectionTitle}>History</Text>
          </View>
          <TouchableOpacity><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyList}>
          {HISTORY.map(item => (
            <TouchableOpacity key={item.id} style={styles.historyItem}>
              <Image source={{ uri: item.thumbnail }} style={styles.historyThumbnail} />
              <Text style={styles.historyText} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.historyOwner}>{item.owner}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.divider} />

      <View style={styles.menuList}>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity key={item.id} style={styles.menuItem}>
            <Ionicons name={item.icon as any} size={24} color={Colors.text} />
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Playlists</Text>
          <TouchableOpacity><Text style={styles.viewAll}>New Playlist</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.playlistItem}>
          <View style={styles.likedBadge}>
            <Ionicons name="thumbs-up" size={24} color={Colors.white} />
          </View>
          <View style={styles.playlistDetails}>
            <Text style={styles.playlistName}>Liked videos</Text>
            <Text style={styles.playlistInfo}>Private • 156 videos</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  section: {
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: Colors.text,
  },
  viewAll: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  historyList: {
    paddingLeft: 15,
  },
  historyItem: {
    width: 140,
    marginRight: 15,
  },
  historyThumbnail: {
    width: 140,
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
  },
  historyText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  historyOwner: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  menuList: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  menuLabel: {
    fontSize: 16,
    marginLeft: 20,
    color: Colors.text,
  },
  playlistItem: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  likedBadge: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistDetails: {
    marginLeft: 15,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  playlistInfo: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
});
