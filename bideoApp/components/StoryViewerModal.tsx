import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/Colors';
import VerifiedBadge from './VerifiedBadge';
import { formatTimeAgo } from '../utils/formatDate';
import { hapticLight, hapticMedium } from '../utils/haptics';
import api, { resolveMediaUrl, chatService, storyService } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per photo story
const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

interface StoryVideoItemProps {
  uri: string;
  isPaused: boolean;
  onVideoEnd: () => void;
  onDurationDiscovered?: (durMs: number) => void;
  onError?: () => void;
}

function StoryVideoItem({
  uri,
  isPaused,
  onVideoEnd,
  onDurationDiscovered,
  onError,
}: StoryVideoItemProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  const hasNotifiedDuration = useRef(false);
  const endedCalledRef = useRef(false);

  useEffect(() => {
    if (!player) return;
    try {
      if (isPaused) {
        player.pause();
      } else {
        player.play();
      }
    } catch {}
  }, [player, isPaused]);

  useEffect(() => {
    if (!player) return;

    let subscription: any = null;
    try {
      if (player && typeof (player as any).addListener === 'function') {
        subscription = (player as any).addListener('playToEnd', () => {
          if (!endedCalledRef.current) {
            endedCalledRef.current = true;
            onVideoEnd();
          }
        });
      }
    } catch {}

    const interval = setInterval(() => {
      try {
        if (!hasNotifiedDuration.current && player.duration && player.duration > 0) {
          hasNotifiedDuration.current = true;
          const durMs = Math.min(Math.round(player.duration * 1000), 15000);
          if (onDurationDiscovered && durMs >= 500) {
            onDurationDiscovered(durMs);
          }
        }

        if ((player as any)?.status === 'error') {
          clearInterval(interval);
          onError?.();
          return;
        }

        if (
          !endedCalledRef.current &&
          player.duration &&
          player.duration > 0 &&
          (player.currentTime >= Math.min(player.duration - 0.2, 15) || (!player.playing && player.currentTime > 0.5))
        ) {
          endedCalledRef.current = true;
          clearInterval(interval);
          onVideoEnd();
        }
      } catch {}
    }, 150);

    return () => {
      clearInterval(interval);
      try {
        subscription?.remove?.();
      } catch {}
    };
  }, [player, onVideoEnd, onDurationDiscovered, onError]);

  return (
    <VideoView
      player={player}
      style={styles.storyImage}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

interface StoryViewerModalProps {
  visible: boolean;
  onClose: () => void;
  storyGroups: any[];
  initialUserIndex: number;
  currentUserId?: string;
  onStoryDeleted?: (storyId: string) => void;
  onStoryViewed?: (storyId: string, userIndex: number) => void;
  onAddStory?: () => void;
}

export default function StoryViewerModal({
  visible,
  onClose,
  storyGroups = [],
  initialUserIndex = 0,
  currentUserId,
  onStoryDeleted,
  onStoryViewed,
  onAddStory,
}: StoryViewerModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Filter groups that have at least 1 active story
  const validGroups = React.useMemo(() => {
    return storyGroups.filter((g) => Array.isArray(g?.stories) && g.stories.length > 0);
  }, [storyGroups]);

  const [userIndex, setUserIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isPressHolding, setIsPressHolding] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [liveViewsMap, setLiveViewsMap] = useState<Record<string, number>>({});

  // Direct Message reply state
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySentToast, setReplySentToast] = useState(false);

  // Viewers sheet modal state
  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Track keyboard height to smoothly lift reply bar on iOS & Android
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentProgressVal = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const wasVisibleRef = useRef(false);
  const currentStoryDurationRef = useRef(STORY_DURATION);
  const lastAdvanceTimeRef = useRef(0);
  const userIndexRef = useRef(userIndex);
  userIndexRef.current = userIndex;
  const storyIndexRef = useRef(storyIndex);
  storyIndexRef.current = storyIndex;
  const validGroupsRef = useRef(validGroups);
  validGroupsRef.current = validGroups;

  // Auto-close cleanly if no active story groups remain (e.g. after deletion or expiration)
  useEffect(() => {
    if (visible && validGroups.length === 0) {
      onClose();
    }
  }, [visible, validGroups.length, onClose]);

  // Sync initial user index ONLY when modal first becomes visible
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      if (validGroups.length > 0) {
        const targetUser = storyGroups[initialUserIndex]?.user?._id;
        const mappedIdx = validGroups.findIndex((g) => g.user?._id === targetUser);
        const safeIdx = mappedIdx !== -1 ? mappedIdx : 0;
        setUserIndex(safeIdx);

        // Start from first unviewed story for followed users, or 0 for own
        const group = validGroups[safeIdx];
        const isGroupOwn = Boolean(
          group?.isSelf ||
          group?.isOwn ||
          (currentUserId && group?.user?._id?.toString() === currentUserId)
        );
        if (group && !isGroupOwn) {
          const firstUnviewed = group.stories.findIndex((s: any) => !s.isViewed);
          setStoryIndex(firstUnviewed !== -1 ? firstUnviewed : 0);
        } else {
          setStoryIndex(0);
        }
      }
    } else if (!visible) {
      wasVisibleRef.current = false;
    }
  }, [visible, initialUserIndex, validGroups, storyGroups, currentUserId]);

  // Safe clamped indexing to prevent any out-of-bounds or undefined crashes
  const safeUserIndex = Math.min(Math.max(0, userIndex), Math.max(0, validGroups.length - 1));
  const currentGroup = validGroups[safeUserIndex] || null;
  const currentStories = currentGroup?.stories || [];
  const safeStoryIndex = Math.min(Math.max(0, storyIndex), Math.max(0, currentStories.length - 1));
  const currentStory = currentStories[safeStoryIndex] || null;
  const otherUser = currentGroup?.user || {};
  const isOwnStory = Boolean(
    currentGroup?.isSelf ||
    currentGroup?.isOwn ||
    (currentUserId && currentGroup?.user?._id?.toString() === currentUserId)
  );

  const currentStoryViews =
    currentStory?._id && liveViewsMap[currentStory._id] !== undefined
      ? liveViewsMap[currentStory._id]
      : (currentStory?.viewsCount ?? (Array.isArray(currentStory?.views) ? currentStory.views.length : 0));

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || !otherUser?._id) return;

    try {
      setSendingReply(true);
      Keyboard.dismiss();
      await chatService.sendMessage({
        recipientId: otherUser._id,
        text: `Replying to story: ${text}`,
      });
      setReplyText('');
      hapticLight();
      setReplySentToast(true);
      setTimeout(() => setReplySentToast(false), 2500);
    } catch (err: any) {
      console.warn('Failed to send reply:', err?.message || err);
      Alert.alert('Could not send reply', err?.response?.data?.message || 'Please check your connection and try again.');
    } finally {
      setSendingReply(false);
      setIsPaused(false);
      const remainingTime = Math.max(500, (1 - currentProgressVal.current) * currentStoryDurationRef.current);
      startProgressAnimation(remainingTime);
    }
  };

  const handleOpenViewers = async () => {
    if (!currentStory?._id) return;
    hapticLight();
    setIsPaused(true);
    animRef.current?.stop();
    setViewersModalVisible(true);
    setLoadingViewers(true);

    try {
      const data = await storyService.getStoryViewers(currentStory._id);
      setViewersList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load viewers:', err);
      setViewersList([]);
    } finally {
      setLoadingViewers(false);
    }
  };

  const handleCloseViewers = () => {
    setViewersModalVisible(false);
    setIsPaused(false);
    const remainingTime = Math.max(500, (1 - currentProgressVal.current) * currentStoryDurationRef.current);
    startProgressAnimation(remainingTime);
  };

  // Mark story as viewed on backend
  const markViewed = useCallback(
    (storyId: string) => {
      if (!storyId || !currentGroup) return;
      api.post(`/stories/${storyId}/view`)
        .then((res) => {
          if (res.data?.viewsCount !== undefined) {
            setLiveViewsMap((prev) => ({
              ...prev,
              [storyId]: res.data.viewsCount,
            }));
          }
        })
        .catch(() => {});

      if (onStoryViewed) {
        onStoryViewed(storyId, userIndex);
      }
    },
    [currentGroup, onStoryViewed, userIndex]
  );

  const handlePressViewer = useCallback(
    (viewer: any) => {
      if (!viewer?._id) return;
      hapticLight();
      setViewersModalVisible(false);
      onClose();
      router.push(`/channel/${viewer._id}`);
    },
    [onClose, router]
  );

  const handlePressCreatorHeader = useCallback(() => {
    if (!isOwnStory && otherUser?._id) {
      hapticLight();
      onClose();
      router.push(`/channel/${otherUser._id}`);
    }
  }, [isOwnStory, otherUser?._id, onClose, router]);

  const handleNextStory = useCallback(() => {
    const now = Date.now();
    if (now - lastAdvanceTimeRef.current < 400) {
      return;
    }
    lastAdvanceTimeRef.current = now;

    const curUIdx = userIndexRef.current;
    const curSIdx = storyIndexRef.current;
    const groups = validGroupsRef.current;
    const curStories = groups[curUIdx]?.stories || [];

    if (curSIdx < curStories.length - 1) {
      const nextIdx = curSIdx + 1;
      storyIndexRef.current = nextIdx;
      setStoryIndex(nextIdx);
    } else if (curUIdx < groups.length - 1) {
      const nextUserIdx = curUIdx + 1;
      userIndexRef.current = nextUserIdx;
      storyIndexRef.current = 0;
      setUserIndex(nextUserIdx);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [onClose]);

  const handlePrevStory = useCallback(() => {
    const now = Date.now();
    if (now - lastAdvanceTimeRef.current < 400) {
      return;
    }
    lastAdvanceTimeRef.current = now;

    const curUIdx = userIndexRef.current;
    const curSIdx = storyIndexRef.current;
    const groups = validGroupsRef.current;

    if (curSIdx > 0) {
      const prevIdx = curSIdx - 1;
      storyIndexRef.current = prevIdx;
      setStoryIndex(prevIdx);
    } else if (curUIdx > 0) {
      const prevUserIdx = curUIdx - 1;
      const prevUserStories = groups[prevUserIdx]?.stories || [];
      const prevStoryIdx = Math.max(0, prevUserStories.length - 1);
      userIndexRef.current = prevUserIdx;
      storyIndexRef.current = prevStoryIdx;
      setUserIndex(prevUserIdx);
      setStoryIndex(prevStoryIdx);
    }
  }, []);

  // Start story progress animation
  const startProgressAnimation = useCallback(
    (remainingDuration?: number) => {
      const dur = remainingDuration !== undefined ? remainingDuration : currentStoryDurationRef.current;
      animRef.current?.stop();
      animRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: dur,
        useNativeDriver: false,
      });

      animRef.current.start(({ finished }) => {
        if (finished) {
          handleNextStory();
        }
      });
    },
    [progressAnim, handleNextStory]
  );

  const handleVideoDurationDiscovered = useCallback(
    (durMs: number) => {
      if (!durMs || durMs < 500) return;
      currentStoryDurationRef.current = durMs;
      const currentVal = currentProgressVal.current;
      const remainingTime = Math.max(300, (1 - currentVal) * durMs);
      startProgressAnimation(remainingTime);
    },
    [startProgressAnimation]
  );

  // Restart progress when story changes
  useEffect(() => {
    if (!visible || !currentStory) return;

    setImageLoading(true);
    setImageError(false);
    progressAnim.setValue(0);
    currentProgressVal.current = 0;
    setIsPaused(false);

    markViewed(currentStory._id);
    const initialDur = currentStory.mediaType === 'video' ? 15000 : STORY_DURATION;
    currentStoryDurationRef.current = initialDur;
    startProgressAnimation(initialDur);

    return () => {
      animRef.current?.stop();
    };
  }, [visible, safeUserIndex, safeStoryIndex, currentStory?._id]);

  // Pause / Resume gesture handlers
  const handlePressIn = () => {
    if (isInputFocused) return;
    setIsPressHolding(true);
    setIsPaused(true);
    animRef.current?.stop();
    progressAnim.stopAnimation((val) => {
      currentProgressVal.current = val;
    });
  };

  const handlePressOut = () => {
    if (isInputFocused) return;
    setIsPressHolding(false);
    setIsPaused(false);
    const remainingTime = Math.max(500, (1 - currentProgressVal.current) * currentStoryDurationRef.current);
    startProgressAnimation(remainingTime);
  };

  const handleTapScreen = (evt: any) => {
    // If keyboard is open, tapping anywhere outside dismisses keyboard
    if (isInputFocused) {
      Keyboard.dismiss();
      setIsInputFocused(false);
      return;
    }
    const touchX = evt.nativeEvent.locationX;
    hapticLight();
    if (touchX < SCREEN_WIDTH * 0.3) {
      handlePrevStory();
    } else {
      handleNextStory();
    }
  };

  // Delete own story
  const handleDeleteCurrentStory = () => {
    if (!currentStory?._id) return;

    handlePressIn(); // Pause while alert is shown

    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story? It will be permanently removed from your feed and storage.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => handlePressOut(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            const targetStoryId = currentStory._id;
            const remainingCount = currentStories.length - 1;
            const hasOtherGroups = validGroups.length > 1;

            try {
              await storyService.deleteStory(targetStoryId);
              if (onStoryDeleted) {
                onStoryDeleted(targetStoryId);
              }

              if (remainingCount <= 0) {
                if (hasOtherGroups) {
                  setStoryIndex(0);
                } else {
                  onClose();
                }
              } else {
                if (safeStoryIndex >= remainingCount) {
                  setStoryIndex(Math.max(0, remainingCount - 1));
                } else {
                  progressAnim.setValue(0);
                  currentProgressVal.current = 0;
                  startProgressAnimation(currentStoryDurationRef.current);
                }
              }
            } catch (err: any) {
              console.warn('[handleDeleteCurrentStory] Error deleting:', err?.message || err);
              if (
                err?.response?.status === 404 ||
                err?.response?.data?.message?.includes('already deleted') ||
                err?.response?.data?.message?.includes('not found')
              ) {
                if (onStoryDeleted) {
                  onStoryDeleted(targetStoryId);
                }
                if (remainingCount <= 0 && !hasOtherGroups) {
                  onClose();
                }
              } else {
                handlePressOut();
              }
            }
          },
        },
      ]
    );
  };

  if (!visible || !currentGroup || !currentStory) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
      <View style={styles.container}>
        {/* Fullscreen Media Image or Video */}
        <TouchableWithoutFeedback
          onPress={handleTapScreen}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.imageContainer}>
            {currentStory.mediaType === 'video' ? (
              <StoryVideoItem
                key={currentStory._id || currentStory.mediaUrl}
                uri={resolveMediaUrl(currentStory.mediaUrl) || currentStory.mediaUrl}
                isPaused={isPaused || isPressHolding || viewersModalVisible}
                onVideoEnd={handleNextStory}
                onDurationDiscovered={handleVideoDurationDiscovered}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                  setTimeout(() => {
                    handleNextStory();
                  }, 1200);
                }}
              />
            ) : (
              <Image
                source={{ uri: resolveMediaUrl(currentStory.mediaUrl) || currentStory.mediaUrl }}
                style={styles.storyImage}
                contentFit="contain"
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                  // Gracefully advance after 1.2s so user never gets stuck
                  setTimeout(() => {
                    handleNextStory();
                  }, 1200);
                }}
                transition={100}
              />
            )}

            {imageLoading && !imageError && currentStory.mediaType !== 'video' && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}

            {imageError && (
              <View style={styles.imageErrorContainer}>
                <Ionicons name="image-outline" size={44} color="rgba(255,255,255,0.4)" />
                <Text style={styles.imageErrorText}>Story unavailable or expired</Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Top Overlay: Segmented Progress Bars & Header (Hidden when pressing & holding) */}
        {!isPressHolding && (
          <View style={[styles.topOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
            {/* Top gradient scrim for high contrast on white/bright images */}
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.35)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Segmented Progress Bars */}
            <View style={styles.progressRow}>
              {currentStories.map((s: any, idx: number) => {
                let barWidth: any = '0%';
                if (idx < storyIndex) {
                  barWidth = '100%';
                } else if (idx === storyIndex) {
                  barWidth = progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  });
                }
                return (
                  <View key={s._id || idx} style={styles.progressBarTrack}>
                    <Animated.View style={[styles.progressBarFill, { width: barWidth }]} />
                  </View>
                );
              })}
            </View>

            {/* Header: User Info & Actions */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.userInfoLeft}
                activeOpacity={0.75}
                onPress={handlePressCreatorHeader}
                disabled={isOwnStory}
              >
                <Image
                  source={{ uri: resolveMediaUrl(otherUser.avatar) || FALLBACK_AVATAR }}
                  style={styles.headerAvatar}
                  contentFit="cover"
                />
                <View style={styles.nameTimeContainer}>
                  <View style={styles.nameRow}>
                    <Text style={styles.headerName} numberOfLines={1}>
                      {isOwnStory ? 'Your Story' : otherUser.channelName || otherUser.name || 'User'}
                    </Text>
                    {Boolean(otherUser.isVerified) && (
                      <VerifiedBadge size={13} style={{ marginLeft: 4 }} />
                    )}
                  </View>
                  <Text style={styles.headerTime}>
                    {formatTimeAgo(currentStory.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Actions Right */}
              <View style={styles.headerActionsRight}>
                {isOwnStory && onAddStory && currentStories.length < 5 && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onAddStory(), 300);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="add-circle-outline" size={26} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {isOwnStory && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={handleDeleteCurrentStory}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Overlay: Caption, Views (own story), or Reply Bar (other user story) */}
        {!isPressHolding && (
          <View
            style={[
              styles.bottomOverlay,
              {
                paddingBottom:
                  keyboardHeight > 0
                    ? keyboardHeight + (Platform.OS === 'ios' ? 8 : 12)
                    : Math.max(insets.bottom, 16),
              },
            ]}
          >
            {/* Rich bottom gradient scrim to guarantee 100% contrast on pure white & bright images */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.55)', 'rgba(0, 0, 0, 0.92)']}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {Boolean(currentStory.caption) && (
              <View style={styles.bottomCaptionContainer}>
                <Text style={styles.captionText}>{currentStory.caption}</Text>
              </View>
            )}

            {/* If Own Story: Tap to open Viewers */}
            {isOwnStory ? (
              <TouchableOpacity
                style={styles.bottomViewsBadge}
                activeOpacity={0.8}
                onPress={handleOpenViewers}
              >
                <Ionicons name="eye" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.bottomViewsText}>
                  {currentStoryViews} {currentStoryViews === 1 ? 'view' : 'views'}
                </Text>
                <Ionicons
                  name="chevron-up"
                  size={14}
                  color="rgba(255, 255, 255, 0.85)"
                  style={{ marginLeft: 5 }}
                />
              </TouchableOpacity>
            ) : (
              /* If Followed User's Story: Instagram-style Direct Message Reply Bar */
              <View style={styles.replyBarWrapper}>
                <View
                  style={[
                    styles.replyBarRow,
                    isInputFocused && styles.replyBarRowFocused,
                  ]}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={17}
                    color="#FF7A00"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.replyInput}
                    placeholder={`Send message to ${otherUser.channelName || otherUser.name || 'creator'}...`}
                    placeholderTextColor="rgba(255, 255, 255, 0.75)"
                    value={replyText}
                    onChangeText={setReplyText}
                    onFocus={() => {
                      setIsInputFocused(true);
                      setIsPaused(true);
                      animRef.current?.stop();
                      progressAnim.stopAnimation((val) => {
                        currentProgressVal.current = val;
                      });
                    }}
                    onBlur={() => {
                      setIsInputFocused(false);
                      if (!sendingReply) {
                        setIsPaused(false);
                        const remainingTime = Math.max(
                          500,
                          (1 - currentProgressVal.current) * currentStoryDurationRef.current
                        );
                        startProgressAnimation(remainingTime);
                      }
                    }}
                    returnKeyType="send"
                    onSubmitEditing={handleSendReply}
                  />
                  {replyText.trim().length > 0 ? (
                    <TouchableOpacity
                      style={styles.replySendBtn}
                      activeOpacity={0.8}
                      onPress={handleSendReply}
                      disabled={sendingReply}
                    >
                      {sendingReply ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="arrow-up" size={17} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name="paper-plane-outline"
                      size={18}
                      color="#FF7A00"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Reply Sent Toast notification */}
        {replySentToast && (
          <View style={[styles.toastContainer, { bottom: Math.max(insets.bottom, 16) + 64 }]}>
            <Ionicons name="checkmark-circle" size={17} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={styles.toastText}>Reply sent to direct messages</Text>
          </View>
        )}
      </View>

      {/* Viewers Bottom Sheet Modal (Only for own story) */}
      <Modal
        visible={viewersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseViewers}
      >
        <TouchableWithoutFeedback onPress={handleCloseViewers}>
          <View style={styles.viewersBackdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.viewersSheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Header */}
          <View style={styles.viewersHeader}>
            <View style={styles.viewersDragBar} />
            <View style={styles.viewersTitleRow}>
              <View style={styles.viewersCountRow}>
                <Ionicons name="eye" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.viewersTitle}>
                  Viewers ({viewersList.length})
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseViewers}
                style={styles.viewersCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* List or Loading */}
          {loadingViewers ? (
            <View style={styles.viewersLoadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : viewersList.length === 0 ? (
            <View style={styles.viewersEmptyContainer}>
              <Ionicons name="eye-off-outline" size={38} color="rgba(255,255,255,0.4)" />
              <Text style={styles.viewersEmptyTitle}>No views yet</Text>
              <Text style={styles.viewersEmptySubtitle}>
                When other people view this photo, you’ll see their profile here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={viewersList}
              keyExtractor={(item) => item._id || Math.random().toString()}
              contentContainerStyle={styles.viewersListContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.viewerItem}
                  activeOpacity={0.7}
                  onPress={() => handlePressViewer(item)}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(item.avatar) || FALLBACK_AVATAR }}
                    style={styles.viewerAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.viewerInfo}>
                    <View style={styles.viewerNameRow}>
                      <Text style={styles.viewerName} numberOfLines={1}>
                        {item.channelName || item.name || 'User'}
                      </Text>
                      {Boolean(item.isVerified) && (
                        <VerifiedBadge size={12} style={{ marginLeft: 4 }} />
                      )}
                    </View>
                    {Boolean(item.name && item.channelName && item.name !== item.channelName) && (
                      <Text style={styles.viewerHandle} numberOfLines={1}>
                        @{item.name}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  imageErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  imageErrorText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 10,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  progressBarTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  nameTimeContainer: {
    marginLeft: 10,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    maxWidth: SCREEN_WIDTH * 0.45,
  },
  headerTime: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 2,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 36,
    alignItems: 'flex-start',
    overflow: 'hidden',
    zIndex: 10,
  },
  bottomCaptionContainer: {
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    maxWidth: SCREEN_WIDTH - 32,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  bottomViewsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 24, 0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.38)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 6,
  },
  bottomViewsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  replyBarWrapper: {
    width: '100%',
  },
  replyBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 24, 0.9)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FF7A00',
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  replyBarRowFocused: {
    backgroundColor: 'rgba(12, 12, 16, 0.98)',
    borderColor: '#FF8A00',
    borderWidth: 1.8,
  },
  replyInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  replySendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 99,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  viewersBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  viewersSheet: {
    backgroundColor: '#18181B',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: SCREEN_HEIGHT * 0.72,
    minHeight: SCREEN_HEIGHT * 0.35,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  viewersHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  viewersDragBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 10,
  },
  viewersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  viewersCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewersTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  viewersCloseBtn: {
    padding: 4,
  },
  viewersLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewersEmptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewersEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  viewersEmptySubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  viewersListContent: {
    paddingVertical: 6,
    paddingBottom: 28,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
  },
  viewerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerHandle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    marginTop: 1,
  },
});
