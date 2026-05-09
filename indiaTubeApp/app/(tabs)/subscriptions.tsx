import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, ScrollView, TouchableOpacity } from 'react-native';
import Colors from '../../constants/Colors';
import VideoCard from '../../components/VideoCard';

const CHANNELS = [
  { id: '1', name: 'T-Series', avatar: 'https://i.pravatar.cc/150?u=tseries' },
  { id: '2', name: 'Sony Music', avatar: 'https://i.pravatar.cc/150?u=sony' },
  { id: '3', name: 'Zee TV', avatar: 'https://i.pravatar.cc/150?u=zeetv' },
  { id: '4', name: 'Star Sports', avatar: 'https://i.pravatar.cc/150?u=star' },
  { id: '5', name: 'Netflix India', avatar: 'https://i.pravatar.cc/150?u=netflix' },
];

const RECENT_VIDEOS = [
  {
    _id: 's1',
    title: 'Top Hits 2026 - Non Stop Music',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    views: 1500000,
    duration: 3600,
    createdAt: new Date().toISOString(),
    owner: { name: 'T-Series', avatar: 'https://i.pravatar.cc/150?u=tseries' }
  },
  {
    _id: 's2',
    title: 'Cricket World Cup 2026 Highlights',
    thumbnail: 'https://images.unsplash.com/photo-1531415074968-036ba1b565da?auto=format&fit=crop&w=800&q=80',
    views: 5000000,
    duration: 600,
    createdAt: new Date().toISOString(),
    owner: { name: 'Star Sports', avatar: 'https://i.pravatar.cc/150?u=star' }
  }
];

export default function SubscriptionsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.channelBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CHANNELS.map(channel => (
            <TouchableOpacity key={channel.id} style={styles.channelItem}>
              <Image source={{ uri: channel.avatar }} style={styles.channelAvatar} />
              <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.allBtn}>
            <Text style={styles.allBtnText}>All</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={RECENT_VIDEOS}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <VideoCard video={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Recent Uploads</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  channelBar: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  channelItem: {
    alignItems: 'center',
    width: 70,
    marginLeft: 12,
  },
  channelAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 4,
  },
  channelName: {
    fontSize: 11,
    color: Colors.textGray,
  },
  allBtn: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  allBtnText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    margin: 15,
    color: Colors.text,
  },
});
