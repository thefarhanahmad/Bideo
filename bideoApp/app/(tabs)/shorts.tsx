import { showAlert } from '../../components/AppAlert';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, Pressable, Share, TextInput, Animated, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useIsFocused } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import api, { videoService } from '../../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';
import CommentList from '../../components/CommentList';
import VerifiedBadge from '../../components/VerifiedBadge';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatViews } from '../../utils/formatDate';
import { hapticLight } from '../../utils/haptics';
import { AppInterstitialAd } from '../../components/AppAds';
import HashtagText from '../../components/HashtagText';

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const formatShortItem = (v: any, currentUserId?: string, isAuth?: boolean) => ({
  _id: v._id,
  videoUrl: v.videoUrl,
  thumbnail: v.thumbnail,
  owner: { 
    _id: v.owner?._id || v.owner,
    name: v.owner?.name || 'Unknown', 
    channelName: v.owner?.channelName,
    avatar: v.owner?.avatar || '',
    isVerified: Boolean(v.owner?.isVerified),
  },
  title: v.title,
  description: v.description,
  likes: v.likes || [],
  commentsCount: v.commentsCount || 0,
  isLiked: v.isLiked ?? (isAuth && v.likes?.includes(currentUserId)),
  isFollowing: v.isFollowing || false,
  createdAt: v.createdAt,
});

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

export default function ShortsScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const { initialShortId, fromChannelId } = useLocalSearchParams<{ initialShortId?: string; fromChannelId?: string }>();
  const isFocused = useIsFocused();
  const [shorts, setShorts] = useState<any[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const isFetchingMore = useRef(false);
  const hasMore = useRef(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(WINDOW_HEIGHT);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedShort, setSelectedShort] = useState<any>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

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
    if (!isFocused) return;
    const onBackPress = () => {
      if (fromChannelId) {
        router.replace(`/channel/${fromChannelId}`);
        return true;
      }
      if (initialShortId && router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, fromChannelId, initialShortId]);

  useEffect(() => {
    loadShorts(initialShortId);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!initialShortId) return;

    const syncTargetShort = async () => {
      // Check if it's already in the loaded list
      const existingIndex = shorts.findIndex((s) => s._id === initialShortId);
      if (existingIndex !== -1) {
        if (existingIndex !== activeVideoIndex) {
          setActiveVideoIndex(existingIndex);
        }
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: existingIndex, animated: false });
        }, 80);
        return;
      }

      // If not present in current shorts, fetch and prepend to top
      try {
        const res = await api.get(`/videos/${initialShortId}`);
        if (res.data?.success && res.data?.data) {
          const formatted = formatShortItem(res.data.data, user?._id, isAuthenticated);
          setShorts((prev) => [formatted, ...prev.filter((s) => s._id !== initialShortId)]);
          setActiveVideoIndex(0);
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: 0, animated: false });
          }, 80);
        }
      } catch (err) {
        console.error('Failed to fetch initial short by id:', err);
      }
    };

    if (isFocused) {
      syncTargetShort();
    }
  }, [initialShortId, isFocused]);

  const loadShorts = async (targetId = initialShortId) => {
    setLoading(true);
    setPage(1);
    hasMore.current = true;
    isFetchingMore.current = false;
    try {
      const data = await api.get('/videos', { params: { type: 'short', page: 1, limit: 50 } });
      const rawList = data.data.data || [];
      if (rawList.length < 50) hasMore.current = false;

      const onlyShorts = rawList
        .filter((v: any) => v.isShort === true)
        .map((v: any) => formatShortItem(v, user?._id, isAuthenticated));
      
      let randomizedShorts: any[] = shuffleArray(onlyShorts);

      if (targetId) {
        const targetIndex = randomizedShorts.findIndex((s: any) => s._id === targetId);
        if (targetIndex !== -1) {
          const [targetShort] = randomizedShorts.splice(targetIndex, 1);
          randomizedShorts.unshift(targetShort);
        } else {
          // Fetch target short directly if not included in random 50
          try {
            const targetRes = await api.get(`/videos/${targetId}`);
            if (targetRes.data?.success && targetRes.data?.data) {
              const targetShort = formatShortItem(targetRes.data.data, user?._id, isAuthenticated);
              randomizedShorts.unshift(targetShort);
            }
          } catch (e) {
            console.error('Error fetching target short:', e);
          }
        }
      }
      
      const withAds: any[] = [];
      let shortCount = 0;
      for (let i = 0; i < randomizedShorts.length; i++) {
        withAds.push(randomizedShorts[i]);
        shortCount++;
        if (shortCount === 5) {
          withAds.push({
            _id: `short_ad_${i}`,
            isAd: true,
          });
          shortCount = 0;
        }
      }
      setShorts(withAds);

      if (targetId && withAds.length > 0) {
        const index = withAds.findIndex((s) => s._id === targetId);
        const finalIdx = index !== -1 ? index : 0;
        setActiveVideoIndex(finalIdx);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: finalIdx, animated: false });
        }, 100);
      }
    } catch (e) {
      console.log('Failed to load shorts', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreShorts = async () => {
    if (isFetchingMore.current || !hasMore.current || loading) return;
    isFetchingMore.current = true;
    try {
      const nextPage = page + 1;
      const data = await api.get('/videos', { params: { type: 'short', page: nextPage, limit: 50 } });
      const rawList = data.data.data || [];
      if (rawList.length > 0) {
        const onlyShorts = rawList
          .filter((v: any) => v.isShort === true)
          .map((v: any) => ({
            _id: v._id,
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            owner: { 
              _id: v.owner?._id,
              name: v.owner?.name || 'Unknown', 
              channelName: v.owner?.channelName,
              avatar: v.owner?.avatar || '',
              isVerified: Boolean(v.owner?.isVerified),
            },
            title: v.title,
            likes: v.likes || [],
            commentsCount: v.commentsCount || 0,
            isLiked: v.isLiked ?? (isAuthenticated && v.likes?.includes(user?._id)),
            isFollowing: v.isFollowing || false,
            createdAt: v.createdAt,
          }));

        setShorts((prev) => {
          const existingIds = new Set(prev.map((s: any) => s._id));
          const trulyNew = onlyShorts.filter((s: any) => !existingIds.has(s._id));
          if (trulyNew.length === 0) {
            hasMore.current = false;
            return prev;
          }
          const withAds: any[] = [];
          for (let i = 0; i < trulyNew.length; i++) {
            withAds.push(trulyNew[i]);
            if ((prev.length + withAds.length) % 5 === 0) {
              withAds.push({
                _id: `short_ad_${trulyNew[i]?._id || i}`,
                isAd: true,
              });
            }
          }
          return [...prev, ...withAds];
        });
        setPage(nextPage);
        if (rawList.length < 50) hasMore.current = false;
      } else {
        hasMore.current = false;
      }
    } catch (e) {
      console.log('Failed to load more shorts', e);
    } finally {
      isFetchingMore.current = false;
    }
  };

  const handleLike = async (shortId: string) => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    hapticLight();

    setShorts(prev => prev.map(s => {
      if (s._id === shortId) {
        const alreadyLiked = s.likes.includes(user?._id);
        const newLikes = alreadyLiked 
          ? s.likes.filter((id: string) => id !== user?._id)
          : [...s.likes, user?._id];
        return { ...s, likes: newLikes, isLiked: !alreadyLiked };
      }
      return s;
    }));

    try {
      await api.post(`/videos/${shortId}/like`);
    } catch (err) {
      loadShorts();
    }
  };

  const handleFollow = async (channelId: string) => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    hapticLight();

    const prevShorts = [...shorts];
    setShorts(prev => prev.map(s => {
      if (s.owner?._id === channelId) {
        return { ...s, isFollowing: !s.isFollowing };
      }
      return s;
    }));

    try {
      await api.post(`/followers/${channelId}`);
    } catch (err) {
      setShorts(prevShorts);
    }
  };

  const handleShare = async (short: any) => {
    try {
      await Share.share({
        message: `Check out this short on Bideo: ${short.title}\n${short.videoUrl}`,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleCommentClick = (shortId: string) => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    const foundShort = shorts.find((s) => s._id === shortId);
    if (foundShort) setSelectedShort(foundShort);
    setSelectedShortId(shortId);
    setCommentModalVisible(true);
  };

  const handleMenuClick = (short: any) => {
    setSelectedShort(short);
    setMenuVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedShort) return;
    setMenuVisible(false);
    
    showAlert(
      'Delete Short',
      'Are you sure you want to delete this short?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/videos/${selectedShort._id}`);
              setShorts(shorts.filter(s => s._id !== selectedShort._id));
              showAlert('Success', 'Short deleted');
            } catch (err) {
              showAlert('Error', 'Failed to delete short');
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    if (!selectedShort) return;
    setMenuVisible(false);
    router.push({ pathname: '/upload-video', params: { editId: selectedShort._id, type: 'short' } });
  };

  const handleReport = () => {
    if (!selectedShort) return;
    setMenuVisible(false);
    if (!isAuthenticated) return setAuthModalVisible(true);
    setReportReason('');
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!selectedShort) return;
    try {
      await api.post(`/videos/${selectedShort._id}/report`, { reason: reportReason });
      setReportModalVisible(false);
      setReportReason('');
      showAlert('Report sent', 'Thanks for your feedback');
    } catch (err) {
      showAlert('Error', 'Failed to send report');
    }
  };

  const handleAdComplete = (index: number) => {
    const nextIndex = index + 1;
    if (nextIndex < shorts.length) {
      setActiveVideoIndex(nextIndex);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      }, 100);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveVideoIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80 // Higher threshold for better snapping
  }).current;

  if (loading) return (
    <View style={[styles.container, styles.centerContainer]}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View 
      style={styles.container} 
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      
      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContent}>
            {selectedShort?.owner?._id === user?._id && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Ionicons name="pencil-outline" size={24} color={Colors.text} />
                  <Text style={styles.menuText}>Edit Short</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.menuText, { color: Colors.primary }]}>Delete Short</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleShare(selectedShort); }}>
              <Ionicons name="share-social-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Share</Text>
            </TouchableOpacity>

            {selectedShort?.owner?._id !== user?._id && (
              <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                <Ionicons name="flag-outline" size={24} color={Colors.text} />
                <Text style={styles.menuText}>Report</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelItem} onPress={() => setMenuVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={commentModalVisible} transparent animationType="slide" onRequestClose={() => setCommentModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCommentModalVisible(false)}>
          <Pressable style={styles.commentModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {selectedShortId && (
                <CommentList 
                  videoId={selectedShortId} 
                  contentOwnerId={selectedShort?.owner?._id || selectedShort?.owner}
                  onCommentAdded={() => {}} 
                  isAuthenticated={isAuthenticated} 
                  onAuthRequired={() => {
                    setCommentModalVisible(false);
                    setAuthModalVisible(true);
                  }} 
                />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Modal (themed, works on Android unlike Alert.prompt) */}
      <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.reportOverlay}>
          <View style={styles.reportBox}>
            <Text style={styles.reportTitle}>Report short</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="Tell us what is wrong"
              placeholderTextColor={Colors.textGray}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <View style={styles.reportActions}>
              <TouchableOpacity onPress={() => { setReportModalVisible(false); setReportReason(''); }}>
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportSubmitBtn} onPress={submitReport}>
                <Text style={styles.reportSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={flatListRef}
        data={shorts}
        keyExtractor={(item) => item._id}
        pagingEnabled
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        onEndReached={loadMoreShorts}
        onEndReachedThreshold={0.5}
        getItemLayout={(data, index) => ({
          length: containerHeight,
          offset: containerHeight * index,
          index,
        })}
        renderItem={({ item, index }) => {
          if (item.isAd) {
            return (
              <ShortAdItem
                containerHeight={containerHeight}
                insets={insets}
                isActive={activeVideoIndex === index}
                onComplete={() => handleAdComplete(index)}
                showBackButton={Boolean(fromChannelId || initialShortId)}
                onBack={handleBack}
              />
            );
          }
          return (
            <ShortItem
              item={item}
              index={index}
              activeVideoIndex={activeVideoIndex}
              containerHeight={containerHeight}
              isFocused={isFocused}
              insets={insets}
              user={user}
              showBackButton={Boolean(fromChannelId || initialShortId)}
              onBack={handleBack}
              onLike={handleLike}
              onCommentClick={handleCommentClick}
              onShare={handleShare}
              onMenuClick={handleMenuClick}
              onFollow={handleFollow}
            />
          );
        }}
      />
    </View>
  );
}

const ShortAdItem = ({ containerHeight, insets, isActive, onComplete, showBackButton, onBack }: any) => {
  return (
    <View style={[styles.shortItem, { height: containerHeight, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' }]}>
      {showBackButton && (
        <View style={[styles.topHeader, { top: insets.top + 10 }]}>
          <TouchableOpacity 
            style={styles.headerBackBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.shortsHeaderTitle}>Shorts</Text>
        </View>
      )}
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ color: Colors.white, marginTop: 15, fontSize: 14, fontWeight: 'bold' }}>
        Loading Sponsor Ad...
      </Text>
      <AppInterstitialAd visible={isActive} onClose={onComplete} />
    </View>
  );
};

const ShortItem = ({ item, index, activeVideoIndex, containerHeight, isFocused, insets, user, showBackButton, onBack, onLike, onCommentClick, onShare, onMenuClick, onFollow }: any) => {
  const router = useRouter();
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
  });
  const [isPaused, setIsPaused] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [iconName, setIconName] = useState<'play' | 'pause'>('play');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const isActive = isFocused && activeVideoIndex === index;

  const SHORT_WATCH_THRESHOLD = 3; // 3 seconds minimum watch time to count a view
  const viewRecordedRef = useRef(false);
  const watchTimeRef = useRef(0);

  // Reset the manual pause state and view tracking whenever this short leaves the viewport.
  useEffect(() => {
    if (!isActive) {
      setIsPaused(false);
      viewRecordedRef.current = false;
      watchTimeRef.current = 0;
    }
  }, [isActive]);

  // Only the active, un-paused short plays; everything else pauses.
  useEffect(() => {
    try {
      if (isActive && !isPaused) {
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [isActive, isPaused, player]);

  // Track active watch time (3 seconds required before recording a view)
  useEffect(() => {
    if (!isActive || !item?._id) return;

    const interval = setInterval(() => {
      try {
        if (player && player.playing && !isPaused) {
          // If the short looped back to start after a view was recorded, allow a new view session
          if (viewRecordedRef.current && player.currentTime < 1 && watchTimeRef.current >= SHORT_WATCH_THRESHOLD) {
            viewRecordedRef.current = false;
            watchTimeRef.current = 0;
          }

          if (!viewRecordedRef.current) {
            watchTimeRef.current += 1;

            const duration = player.duration || item.duration || 0;
            const targetTime = (duration > 0 && duration < SHORT_WATCH_THRESHOLD)
              ? Math.max(duration - 0.5, 1)
              : SHORT_WATCH_THRESHOLD;

            if (watchTimeRef.current >= targetTime) {
              viewRecordedRef.current = true;
              videoService.recordView(item._id).catch(() => {});
            }
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, item?._id, player]);

  const togglePlayPause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    setIconName(newPausedState ? 'pause' : 'play');
    // Actual play/pause is driven by the effect above.

    // Show animation
    setShowIcon(true);
    fadeAnim.setValue(1);
    scaleAnim.setValue(0.7);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start(() => setShowIcon(false));
  };

  return (
    <View style={[styles.shortItem, { height: containerHeight }]}>
      <Pressable style={styles.videoContainer} onPress={togglePlayPause}>
        {/* Thumbnail underlay shows instantly while the video buffers */}
        <Image
          source={{ uri: item.thumbnail }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
        <VideoView
          player={player}
          style={styles.fullVideo}
          contentFit="cover"
          nativeControls={false}
        />

        {showIcon && (
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.iconOverlay}>
              <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
                <View style={styles.iconCircle}>
                  <Ionicons name={iconName} size={40} color={Colors.white} />
                </View>
              </Animated.View>
            </View>
          </View>
        )}
      </Pressable>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topHeader, { top: insets.top + 10 }]}>
          {showBackButton && (
            <TouchableOpacity 
              style={styles.headerBackBtn}
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
          <Text style={styles.shortsHeaderTitle}>Shorts</Text>
        </View>

        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => onLike(item._id)}>
            <Ionicons name={item.isLiked ? "thumbs-up" : "thumbs-up-outline"} size={32} color={item.isLiked ? Colors.primary : Colors.white} />
            <Text style={styles.actionText}>{formatViews(item.likes.length)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onCommentClick(item._id)}>
            <Ionicons name="chatbubble-ellipses" size={32} color={Colors.white} />
            <Text style={styles.actionText}>{formatViews(item.commentsCount)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item)}>
            <Ionicons name="share-social" size={32} color={Colors.white} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onMenuClick(item)}>
            <Ionicons name="ellipsis-vertical" size={30} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomDetails}>
          <View style={styles.ownerRow}>
            <TouchableOpacity 
              style={styles.ownerProfileBtn} 
              onPress={() => item.owner?._id && router.push(`/channel/${item.owner._id}`)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: item.owner?.avatar || FALLBACK_AVATAR }} style={styles.ownerAvatar} />
              <View style={styles.ownerNameContainer}>
                <Text style={styles.ownerName} numberOfLines={1}>@{item.owner.channelName || item.owner.name}</Text>
                {Boolean(item.owner?.isVerified) && <VerifiedBadge size={14} style={styles.verifiedBadge} />}
              </View>
            </TouchableOpacity>
            {item.owner._id !== user?._id && (
              <TouchableOpacity 
                style={[styles.followBtn, item.isFollowing && styles.followedBtn]} 
                onPress={() => onFollow(item.owner._id)}
              >
                <Text style={[styles.followBtnText, item.isFollowing && styles.followedBtnText]}>
                  {item.isFollowing ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <HashtagText
            text={item.title}
            style={styles.shortTitle}
            hashtagStyle={styles.shortHashtag}
            numberOfLines={3}
          />
        </View>
      </View>
    </View>
  );
};

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
    width: WINDOW_WIDTH,
    position: 'relative',
    backgroundColor: 'black',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    flex: 1,
  },
  iconOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 15,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 70,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: Colors.white,
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
  bottomDetails: {
    marginBottom: 0,
    paddingRight: 60,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ownerProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  ownerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    flexShrink: 1,
  },
  ownerName: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 14,
    flexShrink: 1,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  followBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 15,
    minWidth: 70,
    alignItems: 'center',
  },
  followedBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF8C00', // Orange border
  },
  followBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 11,
  },
  followedBtnText: {
    color: '#FF8C00', // Orange text
  },
  shortTitle: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
  shortHashtag: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  topHeader: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackBtn: {
    marginRight: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortsHeaderTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  commentModalContent: {
    backgroundColor: Colors.white,
    height: '60%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: Colors.text,
  },
  cancelItem: {
    marginTop: 10,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  reportBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
    color: Colors.text,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    gap: 18,
  },
  reportCancelText: { color: Colors.textGray, fontWeight: '600' },
  reportSubmitBtn: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  reportSubmitText: { color: Colors.white, fontWeight: 'bold' },
  adCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: WINDOW_WIDTH - 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  adBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 16,
  },
  adBadgeText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 1,
  },
  adTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  adSubtitle: {
    color: Colors.textGray,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  adBannerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  adFooter: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  adChevron: {
    marginTop: 8,
  },
});
