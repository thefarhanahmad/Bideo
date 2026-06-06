import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Dimensions, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, Pressable, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';
import CommentList from '../../components/CommentList';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

export default function ShortsScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const { initialShortId } = useLocalSearchParams<{ initialShortId?: string }>();
  const isFocused = useIsFocused();
  const [shorts, setShorts] = useState<any[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(WINDOW_HEIGHT);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedShort, setSelectedShort] = useState<any>(null);

  useEffect(() => {
    if (initialShortId && shorts.length > 0) {
      const index = shorts.findIndex(s => s._id === initialShortId);
      if (index !== -1 && index !== activeVideoIndex) {
        setActiveVideoIndex(index);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
    }
  }, [initialShortId, shorts.length]);

  useEffect(() => {
    loadShorts();
  }, [isAuthenticated]);

  const loadShorts = async () => {
    setLoading(true);
    try {
      const data = await api.get('/videos', { params: { type: 'short' } });
      const onlyShorts = (data.data.data || [])
        .filter((v: any) => v.isShort === true) // Extra check
        .map((v: any) => ({
          _id: v._id,
          videoUrl: v.videoUrl,
          thumbnail: v.thumbnail,
          owner: { 
            _id: v.owner?._id,
            name: v.owner?.name || 'Unknown', 
            channelName: v.owner?.channelName,
            avatar: v.owner?.avatar || '' 
          },
          title: v.title,
          likes: v.likes || [],
          commentsCount: v.commentsCount || 0,
          isLiked: v.isLiked ?? (isAuthenticated && v.likes?.includes(user?._id)),
          isFollowing: v.isFollowing || false,
          createdAt: v.createdAt,
        }));
      
      const orderedShorts = [...onlyShorts].sort((a: any, b: any) => {
        const aFollowing = a?.isFollowing ? 1 : 0;
        const bFollowing = b?.isFollowing ? 1 : 0;
        if (aFollowing !== bFollowing) return bFollowing - aFollowing;
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setShorts(orderedShorts);

      // Scroll to initial short if it exists
      if (initialShortId && orderedShorts.length > 0) {
        const index = orderedShorts.findIndex(s => s._id === initialShortId);
        if (index !== -1) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index, animated: false });
            setActiveVideoIndex(index);
          }, 100);
        }
      }
    } catch (e) {
      console.log('Failed to load shorts', e);
    }
    setLoading(false);
  };

  const handleLike = async (shortId: string) => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }

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

    const prevShorts = [...shorts];
    setShorts(prev => prev.map(s => {
      if (s.owner._id === channelId) {
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
        message: `Check out this short on TubeIndia: ${short.title}\n${short.videoUrl}`,
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
    
    Alert.alert(
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
              Alert.alert('Success', 'Short deleted');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete short');
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    if (!selectedShort) return;
    setMenuVisible(false);
    router.push({ pathname: '/upload', params: { editId: selectedShort._id } });
  };

  const handleReport = async () => {
    if (!selectedShort) return;
    setMenuVisible(false);
    if (!isAuthenticated) return setAuthModalVisible(true);
    
    Alert.prompt(
      'Report Short',
      'Reason for reporting:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async (reason?: string) => {
            try {
              await api.post(`/videos/${selectedShort._id}/report`, { reason });
              Alert.alert('Report sent', 'Thanks for your feedback');
            } catch (err) {
              Alert.alert('Error', 'Failed to send report');
            }
          }
        }
      ]
    );
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
        removeClippedSubviews={true}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: containerHeight,
          offset: containerHeight * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={[styles.shortItem, { height: containerHeight }]}>
            <Video
              source={{ uri: item.videoUrl }}
              style={styles.fullVideo}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isFocused && activeVideoIndex === index}
              isLooping
              isMuted={false}
              posterSource={{ uri: item.thumbnail }}
              usePoster
            />
            <View style={styles.overlay}>
              <View style={[styles.topHeader, { top: insets.top + 10 }]}>
                <Text style={styles.shortsHeaderTitle}>Shorts</Text>
              </View>

              <View style={styles.rightActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item._id)}>
                  <Ionicons name={item.isLiked ? "thumbs-up" : "thumbs-up-outline"} size={32} color={item.isLiked ? Colors.primary : Colors.white} />
                  <Text style={styles.actionText}>{item.likes.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleCommentClick(item._id)}>
                  <Ionicons name="chatbubble-ellipses" size={32} color={Colors.white} />
                  <Text style={styles.actionText}>{item.commentsCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
                  <Ionicons name="share-social" size={32} color={Colors.white} />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleMenuClick(item)}>
                  <Ionicons name="ellipsis-vertical" size={30} color={Colors.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.bottomDetails}>
                <TouchableOpacity style={styles.ownerRow} onPress={() => item.owner?._id && router.push(`/channel/${item.owner._id}`)}>
                  <Image source={{ uri: item.owner?.avatar || FALLBACK_AVATAR }} style={styles.ownerAvatar} />
                  <Text style={styles.ownerName} numberOfLines={1}>@{item.owner.channelName || item.owner.name}</Text>
                  {item.owner._id !== user?._id && (
                    <TouchableOpacity 
                      style={[styles.followBtn, item.isFollowing && styles.followedBtn]} 
                      onPress={() => handleFollow(item.owner._id)}
                    >
                      <Text style={[styles.followBtnText, item.isFollowing && styles.followedBtnText]}>
                        {item.isFollowing ? 'Unfollow' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
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
    width: WINDOW_WIDTH,
    position: 'relative',
    backgroundColor: 'black',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
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
    fontSize: 14,
    flex: 1,
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
  topHeader: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
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
});
