import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { videoService } from '../../services/api';
import VideoCard from '../../components/VideoCard';
import CommentList from '../../components/CommentList';
import AuthModal from '../../components/AuthModal';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import api from '../../services/api';

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  
  const [video, setVideo] = useState<any>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (id) {
      loadVideoData();
    }
  }, [id]);

  const loadVideoData = async () => {
    try {
      setLoading(true);
      const [videoRes, allVideosRes] = await Promise.all([
        videoService.getVideo(id),
        videoService.getVideos(),
      ]);
      setVideo(videoRes.data);
      setRecommendedVideos(allVideosRes.data.filter((v: any) => v._id !== id));
      
      if (isAuthenticated && videoRes.data.likes.includes(user?._id)) {
        setIsLiked(true);
      }
    } catch (err) {
      console.error('Failed to load video data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    // Implement like API call here
    setIsLiked(!isLiked);
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    try {
      await api.post(`/subscriptions/${video.owner._id}`);
      setIsSubscribed(!isSubscribed);
    } catch (err) {
      console.error('Subscription failed', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!video) {
    return (
      <View style={styles.centerContainer}>
        <Text>Video not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        source={{ uri: video.videoUrl }}
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        style={styles.videoPlayer}
      />

      <FlatList
        ListHeaderComponent={
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.metadata}>
              {video.views} views • {new Date(video.createdAt).toLocaleDateString()}
            </Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                <Ionicons 
                  name={isLiked ? "thumbs-up" : "thumbs-up-outline"} 
                  size={24} 
                  color={isLiked ? Colors.primary : Colors.text} 
                />
                <Text style={[styles.actionText, isLiked && { color: Colors.primary }]}>
                  {video.likes?.length || 0}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="thumbs-down-outline" size={24} color={Colors.text} />
                <Text style={styles.actionText}>Dislike</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="share-social-outline" size={24} color={Colors.text} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="download-outline" size={24} color={Colors.text} />
                <Text style={styles.actionText}>Download</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.channelContainer}>
              <View style={styles.channelInfo}>
                <Image source={{ uri: video.owner.avatar }} style={styles.avatar} />
                <View>
                  <Text style={styles.channelName}>{video.owner.name}</Text>
                  <Text style={styles.subscriberCount}>{video.owner.subscribersCount} subscribers</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.subscribeButton, isSubscribed && styles.subscribedButton]} 
                onPress={handleSubscribe}
              >
                <Text style={[styles.subscribeText, isSubscribed && styles.subscribedText]}>
                  {isSubscribed ? 'SUBSCRIBED' : 'SUBSCRIBE'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.descriptionContainer}>
              <Text style={styles.description} numberOfLines={2}>
                {video.description}
              </Text>
            </View>

            <View style={styles.divider} />
            
            <CommentList 
              videoId={video._id} 
              onCommentAdded={loadVideoData}
              isAuthenticated={isAuthenticated}
              onAuthRequired={() => setAuthModalVisible(true)}
            />

            <View style={styles.divider} />
            <Text style={styles.recommendedTitle}>Recommended</Text>
          </View>
        }
        data={recommendedVideos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <VideoCard video={item} />}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <AuthModal 
        visible={authModalVisible} 
        onClose={() => setAuthModalVisible(false)}
        onLoginSuccess={() => {
          setAuthModalVisible(false);
          loadVideoData();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  videoPlayer: {
    width: '100%',
    height: 220,
    backgroundColor: 'black',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  metadata: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 4,
  },
  channelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  channelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subscriberCount: {
    fontSize: 12,
    color: Colors.textGray,
  },
  subscribeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  subscribedButton: {
    backgroundColor: '#F2F2F2',
  },
  subscribeText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  subscribedText: {
    color: Colors.textGray,
  },
  descriptionContainer: {
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  recommendedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContainer: {
    paddingBottom: 20,
  },
});
