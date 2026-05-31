import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, FlatList, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, VideoFullscreenUpdate } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import api, { videoService } from '../../services/api';
import VideoCard from '../../components/VideoCard';
import CommentList from '../../components/CommentList';
import AuthModal from '../../components/AuthModal';
import PlaylistModal from '../../components/PlaylistModal';
import { formatTimeAgo } from '../../utils/formatDate';

const FALLBACK_IMAGE = 'https://via.placeholder.com/80x80.png?text=User';

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const videoRef = useRef<Video | null>(null);
  
  const [video, setVideo] = useState<any>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

  useEffect(() => {
    if (id) {
      loadVideoData();
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (videoRef.current) {
          videoRef.current.stopAsync?.().catch(() => {});
          videoRef.current.unloadAsync?.().catch(() => {});
        }
      };
    }, [])
  );

  const loadVideoData = async () => {
    try {
      setLoading(true);
      const [videoRes, allVideosRes] = await Promise.all([
        videoService.getVideo(id as string),
        videoService.getVideos(),
      ]);
      const videoData = videoRes?.data || videoRes;
      const allVideos = Array.isArray(allVideosRes) ? allVideosRes : (allVideosRes?.data || []);

      setVideo(videoData || null);
      setRecommendedVideos((allVideos || []).filter((v: any) => v?._id !== id));
      
      if (isAuthenticated) {
        setIsLiked(videoData.isLiked || false);
        setIsDisliked(videoData.isDisliked || false);
        setIsFollowed(videoData.isFollowing || false);
      }

      // Add to History
      if (isAuthenticated && videoData?._id) {
        api.post('/users/history', { videoId: videoData._id }).catch(() => {});
      }
      if (videoData?._id) {
        videoService.recordView(videoData._id)
          .then((res) => setVideo((prev: any) => prev ? { ...prev, views: res.views } : prev))
          .catch(() => {});
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
    
    const prevIsLiked = isLiked;
    const prevIsDisliked = isDisliked;
    const prevLikes = [...(video.likes || [])];
    const prevDislikes = [...(video.dislikes || [])];
    
    // Optimistic update
    setIsLiked(!isLiked);
    if (!isLiked) setIsDisliked(false);
    
    setVideo((prev: any) => {
      let newLikes = [...prevLikes];
      let newDislikes = [...prevDislikes];
      
      if (!prevIsLiked) {
        newLikes.push(user?._id);
        newDislikes = newDislikes.filter(id => id !== user?._id);
      } else {
        newLikes = newLikes.filter(id => id !== user?._id);
      }
      
      return { ...prev, likes: newLikes, dislikes: newDislikes };
    });
    
    try {
      const res = await api.post(`/videos/${video._id}/like`);
      if (res.data.success) {
        setVideo((prev: any) => ({
          ...prev,
          likes: res.data.likes,
          dislikes: res.data.dislikes
        }));
      }
    } catch (err) {
      setIsLiked(prevIsLiked);
      setIsDisliked(prevIsDisliked);
      setVideo((prev: any) => ({ ...prev, likes: prevLikes, dislikes: prevDislikes }));
      console.error('Like failed', err);
    }
  };

  const handleDislike = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    
    const prevIsLiked = isLiked;
    const prevIsDisliked = isDisliked;
    const prevLikes = [...(video.likes || [])];
    const prevDislikes = [...(video.dislikes || [])];
    
    // Optimistic update
    setIsDisliked(!isDisliked);
    if (!isDisliked) setIsLiked(false);

    setVideo((prev: any) => {
      let newLikes = [...prevLikes];
      let newDislikes = [...prevDislikes];
      
      if (!prevIsDisliked) {
        newDislikes.push(user?._id);
        newLikes = newLikes.filter(id => id !== user?._id);
      } else {
        newDislikes = newDislikes.filter(id => id !== user?._id);
      }
      
      return { ...prev, likes: newLikes, dislikes: newDislikes };
    });
    
    try {
      const res = await api.post(`/videos/${video._id}/dislike`);
      if (res.data.success) {
        setVideo((prev: any) => ({
          ...prev,
          likes: res.data.likes,
          dislikes: res.data.dislikes
        }));
      }
    } catch (err) {
      setIsLiked(prevIsLiked);
      setIsDisliked(prevIsDisliked);
      setVideo((prev: any) => ({ ...prev, likes: prevLikes, dislikes: prevDislikes }));
      console.error('Dislike failed', err);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this video on TubeIndia: ${video.title}\n${video.videoUrl}`,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }

    const ownerId = video?.owner?._id;
    if (!ownerId) {
      return;
    }
    
    const prevIsFollowed = isFollowed;
    const prevFollowersCount = video?.owner?.followersCount || 0;
    
    // Optimistic update
    setIsFollowed(!isFollowed);
    setVideo((prev: any) => ({
      ...prev,
      owner: {
        ...(prev?.owner || {}),
        followersCount: !isFollowed ? prevFollowersCount + 1 : prevFollowersCount - 1
      }
    }));
    
    try {
      await api.post(`/followers/${ownerId}`);
    } catch (err) {
      setIsFollowed(prevIsFollowed);
      setVideo((prev: any) => ({
        ...prev,
        owner: {
          ...(prev?.owner || {}),
          followersCount: prevFollowersCount
        }
      }));
      console.error('Follow failed', err);
    }
  };

  const handleFullscreenUpdate = async (event: { fullscreenUpdate: VideoFullscreenUpdate }) => {
    if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_PRESENT) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_DISMISS) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  };

  const handleAdd = () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    setPlaylistModalVisible(true);
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
        ref={videoRef}
        source={{ uri: video?.videoUrl || '' }}
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        style={styles.videoPlayer}
        onFullscreenUpdate={handleFullscreenUpdate}
      />

      <FlatList
        ListHeaderComponent={
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.metadata}>
              {video.views} views • {formatTimeAgo(video.createdAt)}
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
              <TouchableOpacity style={styles.actionButton} onPress={handleDislike}>
                <Ionicons 
                  name={isDisliked ? "thumbs-down" : "thumbs-down-outline"} 
                  size={24} 
                  color={isDisliked ? Colors.primary : Colors.text} 
                />
                <Text style={[styles.actionText, isDisliked && { color: Colors.primary }]}>Dislike</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={24} color={Colors.text} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleAdd}>
                <Ionicons name="add-circle-outline" size={24} color={Colors.text} />
                <Text style={styles.actionText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.channelContainer}>
              <TouchableOpacity
                style={styles.channelInfo}
                onPress={() => video?.owner?._id && router.push(`/channel/${video.owner._id}`)}
              >
                <Image source={{ uri: video?.owner?.avatar || FALLBACK_IMAGE }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.channelName} numberOfLines={1}>{video?.owner?.channelName || video?.owner?.name || 'Unknown channel'}</Text>
                  <Text style={styles.followerCount}>{video?.owner?.followersCount || 0} followers</Text>
                </View>
              </TouchableOpacity>
              {video?.owner?._id !== user?._id && (
                <TouchableOpacity 
                  style={[styles.followButton, isFollowed && styles.followedButton]} 
                  onPress={handleFollow}
                >
                  <Text style={[styles.followText, isFollowed && styles.followedText]}>
                    {isFollowed ? 'UNFOLLOW' : 'FOLLOW'}
                  </Text>
                </TouchableOpacity>
              )}
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
      <PlaylistModal 
        visible={playlistModalVisible} 
        onClose={() => setPlaylistModalVisible(false)}
        videoId={video._id}
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
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
  },
  channelName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  followerCount: {
    fontSize: 11,
    color: Colors.textGray,
  },
  followButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followedButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#FF8C00', // Orange border
  },
  followText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  followedText: {
    color: '#FF8C00', // Orange text
    fontSize: 11,
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
