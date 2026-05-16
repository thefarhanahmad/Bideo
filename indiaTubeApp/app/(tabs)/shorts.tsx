import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { videoService } from '../../services/api';
import { Video, ResizeMode } from 'expo-av';

const { height, width } = Dimensions.get('window');

export default function ShortsScreen() {
  const [shorts, setShorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShorts();
  }, []);

  const loadShorts = async () => {
    setLoading(true);
    try {
      const data = await videoService.getVideos(); // returns array
      const onlyShorts = (data || []).filter((v: any) => !!v.isShort).map((v: any) => ({
        id: v._id,
        videoUrl: v.videoUrl,
        thumbnail: v.thumbnail,
        owner: { name: v.owner?.name || 'Unknown', avatar: v.owner?.avatar || '' },
        title: v.title,
        likes: (v.likes && v.likes.length) || 0,
        comments: v.commentsCount || 0,
      }));
      setShorts(onlyShorts);
    } catch (e) {
      console.log('Failed to load shorts', e);
      setShorts([]);
    }
    setLoading(false);
  };

  if (loading) return (
    <View style={[styles.container, styles.centerContainer]}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  if (!loading && shorts.length === 0) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={{ color: Colors.white }}>No shorts available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={shorts}
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
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
