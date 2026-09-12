import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, Share, useWindowDimensions, StatusBar, BackHandler, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import api, { videoService } from '../../services/api';
import VideoCard from '../../components/VideoCard';
import CommentList from '../../components/CommentList';
import AuthModal from '../../components/AuthModal';
import PlaylistModal from '../../components/PlaylistModal';
import VerifiedBadge from '../../components/VerifiedBadge';
import { formatTimeAgo, formatViews } from '../../utils/formatDate';
import { hapticLight } from '../../utils/haptics';
import { AppInterstitialAd, AppNativeAd } from '../../components/AppAds';
import HashtagText from '../../components/HashtagText';

const FALLBACK_IMAGE = 'https://via.placeholder.com/80x80.png?text=User';
const REQUIRED_WATCH_TIME = 3; // 3 seconds minimum watch time to count a view

export default function VideoScreen() {
  const { id, fromChannelId } = useLocalSearchParams<{ id: string; fromChannelId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const playerHeight = Math.round((windowWidth * 9) / 16);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const handleBack = useCallback(() => {
    if (fromChannelId) {
      router.replace(`/channel/${fromChannelId}`);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)');
    }
  }, [fromChannelId]);

  useEffect(() => {
    const onBackPress = () => {
      if (fromChannelId) {
        router.replace(`/channel/${fromChannelId}`);
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [fromChannelId]);
  // expo-video player (replaces the deprecated expo-av <Video>). Source is loaded
  // via player.replace() once the video data arrives.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  const [video, setVideo] = useState<any>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

  // Ad states
  const [showingAd, setShowingAd] = useState(false);
  const [adCompleted, setAdCompleted] = useState(false);

  // Description and comments bottom sheet states
  const [descriptionModalVisible, setDescriptionModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [previewComment, setPreviewComment] = useState<any>(null);
  const [commentsCount, setCommentsCount] = useState<number>(0);

  // View tracking states
  const viewRecordedRef = useRef(false);
  const watchTimeRef = useRef(0);

  const fetchPreviewComments = useCallback(async (targetVideoId?: string) => {
    const videoId = targetVideoId || (id as string);
    if (!videoId) return;
    try {
      const res = await api.get('/comments', { params: { videoId } });
      const list = res.data?.data || [];
      setCommentsCount(list.length);
      if (list.length > 0) {
        const pinned = list.find((c: any) => c.isPinned);
        setPreviewComment(pinned || list[0]);
      } else {
        setPreviewComment(null);
      }
    } catch {
      // Ignore
    }
  }, [id]);

  const playMainVideo = useCallback(async () => {
    if (!video?.videoUrl) return;
    setShowingAd(false);
    setAdCompleted(true);
    try {
      if (typeof player.replaceAsync === 'function') {
        await player.replaceAsync(video.videoUrl);
      } else {
        player.replace(video.videoUrl);
      }
      player.play();
    } catch (err) {
      console.log('Main video load error:', err);
    }
  }, [video?.videoUrl, player]);

  useEffect(() => {
    if (id) {
      viewRecordedRef.current = false;
      watchTimeRef.current = 0;
      loadVideoData();
    }
  }, [id]);

  // Load the source into the player once the video URL is available.
  useEffect(() => {
    if (!video?.videoUrl) return;
    
    // Pause player (in case it was playing a previous video)
    try {
      player.pause();
    } catch {}

    // Reset ad state and show AdMob interstitial ad first
    setAdCompleted(false);
    setShowingAd(true);
  }, [video?.videoUrl, player]);

  // Track active watch time (3 seconds required before recording a view)
  useEffect(() => {
    if (!video?._id) return;

    const interval = setInterval(() => {
      try {
        if (player && player.playing && !showingAd) {
          // If user restarted/replayed video from start after previous view was recorded, allow a new view
          if (viewRecordedRef.current && player.currentTime < 1 && watchTimeRef.current >= REQUIRED_WATCH_TIME) {
            viewRecordedRef.current = false;
            watchTimeRef.current = 0;
          }

          if (!viewRecordedRef.current) {
            watchTimeRef.current += 1;

            const duration = player.duration || video.duration || 0;
            const targetTime = (duration > 0 && duration < REQUIRED_WATCH_TIME)
              ? Math.max(duration - 1, 1)
              : REQUIRED_WATCH_TIME;

            if (watchTimeRef.current >= targetTime) {
              viewRecordedRef.current = true;
              videoService.recordView(video._id)
                .then((res) => {
                  if (res?.views) {
                    setVideo((prev: any) => prev ? { ...prev, views: res.views } : prev);
                  }
                })
                .catch(() => {});
            }
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [video?._id, player, showingAd]);

  useFocusEffect(
    useCallback(() => {
      // Whenever the screen gains focus (e.g., reopened from home), reset tracking state
      viewRecordedRef.current = false;
      watchTimeRef.current = 0;
      if (id) {
        loadVideoData();
      }
      return () => {
        try {
          player.pause();
        } catch {}
      };
    }, [id, player])
  );

  const loadVideoData = async () => {
    try {
      setLoading(true);
      const [videoRes, allVideosRes] = await Promise.all([
        videoService.getVideo(id as string),
        videoService.getVideos({ limit: 15 }),
      ]);
      const videoData = videoRes?.data || videoRes;
      const allVideos: any[] = Array.isArray(allVideosRes) ? allVideosRes : ((allVideosRes as any)?.data || []);

      setVideo(videoData || null);
      setRecommendedVideos((allVideos || []).filter((v: any) => v?._id !== id));
      if (videoData?._id) {
        fetchPreviewComments(videoData._id);
      }
      
      if (isAuthenticated) {
        setIsLiked(videoData.isLiked || false);
        setIsDisliked(videoData.isDisliked || false);
        setIsFollowed(videoData.isFollowing || false);
      }

      // Add to History
      if (isAuthenticated && videoData?._id) {
        api.post('/users/history', { videoId: videoData._id }).catch(() => {});
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
    
    hapticLight();
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
      const shareUrl = `https://bideo.in/v/${video._id || id}`;
      await Share.share({
        title: video.title,
        message: `Watch "${video.title}" on Bideo:\n${shareUrl}`,
        url: shareUrl,
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
    
    hapticLight();
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

  const handleFullscreenEnter = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
  };

  const handleFullscreenExit = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  };

  const handleAdd = () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    setPlaylistModalVisible(true);
  };

  const handleNext = () => {
    if (recommendedVideos.length > 0) {
      router.push(`/video/${recommendedVideos[0]._id}`);
    }
  };

  const handlePrevious = () => {
    if (recommendedVideos.length > 0) {
      router.push(`/video/${recommendedVideos[recommendedVideos.length - 1]._id}`);
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={[styles.videoPlayerContainer, { height: playerHeight }]}>
        {showingAd ? (
          <View style={styles.adPlayerPlaceholder}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ color: Colors.white, marginTop: 10, fontSize: 13, fontWeight: '600' }}>Loading Sponsor Ad...</Text>
          </View>
        ) : (
          <>
            <VideoView
              player={player}
              style={[styles.videoPlayer, { height: playerHeight }]}
              contentFit="contain"
              nativeControls
              fullscreenOptions={{ enable: true }}
              allowsPictureInPicture
              onFullscreenEnter={handleFullscreenEnter}
              onFullscreenExit={handleFullscreenExit}
            />
            <TouchableOpacity
              style={styles.floatingBackButton}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <HashtagText text={video.title} style={styles.title} numberOfLines={2} />
              </View>
              {Boolean(video.description) && (
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => setDescriptionModalVisible(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.moreButtonText}>...more</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.metadata}>
              {formatViews(video.views || 0)} views • {formatTimeAgo(video.createdAt)}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionButtons}
            >
              <TouchableOpacity style={[styles.chip, isLiked && styles.chipActive]} onPress={handleLike} activeOpacity={0.8}>
                <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={20} color={isLiked ? Colors.primary : Colors.text} />
                <Text style={[styles.chipText, isLiked && styles.chipTextActive]}>{formatViews(video.likes?.length || 0)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, isDisliked && styles.chipActive]} onPress={handleDislike} activeOpacity={0.8}>
                <Ionicons name={isDisliked ? 'thumbs-down' : 'thumbs-down-outline'} size={20} color={isDisliked ? Colors.primary : Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-social-outline" size={20} color={Colors.text} />
                <Text style={styles.chipText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={handleAdd} activeOpacity={0.8}>
                <Ionicons name="bookmark-outline" size={20} color={Colors.text} />
                <Text style={styles.chipText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.channelContainer}>
              <TouchableOpacity
                style={styles.channelInfo}
                onPress={() => video?.owner?._id && router.push(`/channel/${video.owner._id}`)}
              >
                <Image source={{ uri: video?.owner?.avatar || FALLBACK_IMAGE }} style={styles.avatar} contentFit="cover" transition={200} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.channelName} numberOfLines={1}>{video?.owner?.channelName || video?.owner?.name || 'Unknown channel'}</Text>
                    {Boolean(video?.owner?.isVerified) && <VerifiedBadge size={14} style={{ marginLeft: 3 }} />}
                  </View>
                  <Text style={styles.followerCount}>{formatViews(video?.owner?.followersCount || 0)} followers</Text>
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

            {/* Comment Section Preview Box (Replaces inline description) */}
            <TouchableOpacity
              style={styles.commentPreviewBox}
              onPress={() => setCommentsModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.commentPreviewHeader}>
                <Text style={styles.commentPreviewHeading}>Comments</Text>
                <Text style={styles.commentPreviewCount}>
                  {commentsCount || video.commentsCount || 0}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textGray} style={{ marginLeft: 'auto' }} />
              </View>
              {previewComment ? (
                <View style={styles.commentPreviewBody}>
                  <Image
                    source={{ uri: previewComment.user?.avatar || FALLBACK_IMAGE }}
                    style={styles.commentPreviewAvatar}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentPreviewUser} numberOfLines={1}>
                      {previewComment.user?.channelName || previewComment.user?.name}
                      {previewComment.isPinned && <Text style={styles.pinnedBadge}> • Pinned</Text>}
                    </Text>
                    <Text style={styles.commentPreviewText} numberOfLines={2}>
                      {previewComment.text}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.commentPreviewBody}>
                  <Image
                    source={{ uri: user?.avatar || FALLBACK_IMAGE }}
                    style={styles.commentPreviewAvatar}
                    contentFit="cover"
                  />
                  <Text style={styles.commentAddPlaceholder}>Add a comment...</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Native Ad below Comment preview */}
            <AppNativeAd />

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
      <AppInterstitialAd 
        visible={showingAd} 
        onClose={playMainVideo} 
      />

      {/* Description Bottom Sheet Modal */}
      <Modal
        visible={descriptionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDescriptionModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDescriptionModalVisible(false)}>
          <Pressable style={styles.descSheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderTitle}>Description</Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setDescriptionModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetVideoTitle}>{video.title}</Text>
              <View style={styles.descStatsRow}>
                <View style={styles.descStatItem}>
                  <Text style={styles.descStatNumber}>{formatViews(video.likes?.length || 0)}</Text>
                  <Text style={styles.descStatLabel}>Likes</Text>
                </View>
                <View style={styles.descStatDivider} />
                <View style={styles.descStatItem}>
                  <Text style={styles.descStatNumber}>{formatViews(video.views || 0)}</Text>
                  <Text style={styles.descStatLabel}>Views</Text>
                </View>
                <View style={styles.descStatDivider} />
                <View style={styles.descStatItem}>
                  <Text style={styles.descStatNumber}>{formatTimeAgo(video.createdAt)}</Text>
                  <Text style={styles.descStatLabel}>Uploaded</Text>
                </View>
              </View>
              <View style={styles.descDivider} />
              <HashtagText
                text={video.description || 'No description available for this video.'}
                style={styles.sheetDescText}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Comments Full Bottom Sheet Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCommentsModalVisible(false)}>
          <Pressable style={styles.commentsSheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderTitle}>
                Comments ({commentsCount || video.commentsCount || 0})
              </Text>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setCommentsModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <CommentList
                videoId={video._id}
                contentOwnerId={video?.owner?._id || video?.owner}
                onCommentAdded={() => {
                  setCommentsCount((prev) => prev + 1);
                  setVideo((prev: any) => prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : prev);
                  fetchPreviewComments(video._id);
                }}
                isAuthenticated={isAuthenticated}
                onAuthRequired={() => {
                  setCommentsModalVisible(false);
                  setAuthModalVisible(true);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  videoPlayerContainer: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  adPlayerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    backgroundColor: '#000000',
  },
  adOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 10,
    zIndex: 10,
  },
  adBadgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 10,
    marginLeft: 10,
  },
  adBadgeLabel: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  adActionPanel: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginRight: 10,
  },
  skipAdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  skipAdText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  skipCountdown: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  skipCountdownText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    padding: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
    lineHeight: 22,
  },
  moreButton: {
    paddingTop: 2,
    paddingLeft: 4,
  },
  moreButtonText: {
    color: Colors.textGray,
    fontSize: 13,
    fontWeight: '700',
  },
  metadata: {
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F3F5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: Colors.primary + '1A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.primary,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
    borderWidth: 1.5,
    borderColor: Colors.primary + '33',
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
  commentPreviewBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  commentPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentPreviewHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  commentPreviewCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textGray,
    marginLeft: 6,
  },
  commentPreviewBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentPreviewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  commentPreviewUser: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  pinnedBadge: {
    color: Colors.primary,
    fontWeight: '700',
  },
  commentPreviewText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  commentAddPlaceholder: {
    fontSize: 12,
    color: Colors.textGray,
    alignSelf: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  descSheetContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: 250,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  commentsSheetContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    paddingTop: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 4,
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetScroll: {
    marginTop: 12,
  },
  sheetVideoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  descStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  descStatItem: {
    alignItems: 'center',
  },
  descStatNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  descStatLabel: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  descStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0',
  },
  descDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  sheetDescText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    paddingBottom: 20,
  },
});
