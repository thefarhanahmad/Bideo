import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { useRouter } from 'expo-router';

const FALLBACK_IMAGE = 'https://via.placeholder.com/640x360?text=No+Image';

interface VideoCardProps {
  video: {
    _id: string;
    title: string;
    thumbnail: string;
    views: number;
    createdAt: string;
    owner: {
      name: string;
      avatar: string;
    };
    duration: number;
  };
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const router = useRouter();

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push(`/video/${video._id}`)}
    >
      <View style={styles.thumbnailContainer}>
        <Image source={{ uri: video?.thumbnail || FALLBACK_IMAGE }} style={styles.thumbnail} />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video?.duration || 0)}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <Image source={{ uri: video?.owner?.avatar || FALLBACK_IMAGE }} style={styles.avatar} />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {video?.title || 'Untitled'}
          </Text>
          <Text style={styles.metadata}>
            {(video?.owner?.name || 'Unknown')} - {formatViews(video?.views || 0)} - 1 day ago
          </Text>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsContainer: {
    flexDirection: 'row',
    padding: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  metadata: {
    fontSize: 12,
    color: Colors.textGray,
  },
  menuButton: {
    paddingLeft: 8,
  },
});

export default VideoCard;
