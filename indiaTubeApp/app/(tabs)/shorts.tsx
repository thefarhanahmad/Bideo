import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';

const { height, width } = Dimensions.get('window');

const SAMPLE_SHORTS = [
  {
    id: 's1',
    videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    owner: { name: 'VibeCheck', avatar: 'https://i.pravatar.cc/150?u=vibe' },
    title: 'Morning vibes in the mountains 🏔️ #nature #peace',
    likes: '1.2M',
    comments: '12K',
  },
  {
    id: 's2',
    videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1514525253344-f814d0c9e58f?auto=format&fit=crop&w=800&q=80',
    owner: { name: 'DanceIndia', avatar: 'https://i.pravatar.cc/150?u=dance' },
    title: 'New dance moves! 🕺🔥 #dance #trending',
    likes: '850K',
    comments: '5.4K',
  }
];

export default function ShortsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={SAMPLE_SHORTS}
        keyExtractor={(item) => item.id}
        pagingEnabled
        vertical
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.shortItem}>
            <Image source={{ uri: item.thumbnail }} style={styles.fullThumbnail} />
            <View style={styles.overlay}>
              <View style={styles.rightActions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="thumbs-up" size={32} color={Colors.white} />
                  <Text style={styles.actionText}>{item.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="chatbubble-ellipses" size={32} color={Colors.white} />
                  <Text style={styles.actionText}>{item.comments}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="share-social" size={32} color={Colors.white} />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomDetails}>
                <View style={styles.ownerRow}>
                  <Image source={{ uri: item.owner.avatar }} style={styles.ownerAvatar} />
                  <Text style={styles.ownerName}>@{item.owner.name}</Text>
                  <TouchableOpacity style={styles.subscribeBtn}>
                    <Text style={styles.subscribeBtnText}>Subscribe</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.shortTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  shortItem: {
    width: width,
    height: height - 120, // Adjust for bottom tabs
    position: 'relative',
  },
  fullThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
    padding: 20,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionText: {
    color: Colors.white,
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
  bottomDetails: {
    marginBottom: 20,
    paddingRight: 60,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  ownerName: {
    color: Colors.white,
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  subscribeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 15,
  },
  subscribeBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  shortTitle: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
});
