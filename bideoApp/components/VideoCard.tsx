import { showAlert } from './AppAlert';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, Pressable, Share } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { useRouter } from 'expo-router';
import { formatTimeAgo, formatViews } from '../utils/formatDate';
import { hapticSelection } from '../utils/haptics';
import api, { resolveMediaUrl } from '../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

const FALLBACK_IMAGE = 'https://via.placeholder.com/640x360?text=No+Image';
const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

interface VideoCardProps {
  video: {
    _id: string;
    title: string;
    thumbnail: string;
    views: number;
    createdAt: string;
    owner: {
      _id?: string;
      name: string;
      channelName?: string;
      avatar: string;
    };
    duration: number;
    videoUrl?: string;
  };
  onMenuPress?: () => void;
  onPlaylistPress?: (videoId: string) => void;
  onReportPress?: (video: any) => void;
  onEditPress?: (video: any) => void;
  onDeletePress?: (video: any) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onMenuPress, onPlaylistPress, onReportPress, onEditPress, onDeletePress }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => {
    hapticSelection();
    setMenuVisible(true);
  };

  const isOwner = user?._id === video.owner?._id;

  const formatDuration = (seconds: number) => {
    let totalSecs = Math.round(Number(seconds) || 0);
    // If stored as milliseconds (e.g. 7625 for 7.6s), convert to seconds
    if (totalSecs > 1000) {
      totalSecs = Math.round(totalSecs / 1000);
    }
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      await Share.share({
        message: `Check out this video on Bideo: ${video.title}\n${video.videoUrl || ''}`,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleReport = () => {
    setMenuVisible(false);
    if (onReportPress) {
      onReportPress(video);
    }
  };

  const handlePlaylist = () => {
    setMenuVisible(false);
    if (onPlaylistPress) {
      onPlaylistPress(video._id);
    }
  };

  const handleEdit = () => {
    setMenuVisible(false);
    if (onEditPress) {
      onEditPress(video);
    } else {
      router.push({ pathname: '/upload-video', params: { editId: video._id } });
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    if (onDeletePress) {
      onDeletePress(video);
    } else {
      showAlert(
        'Delete Video',
        'Are you sure you want to delete this video?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await api.delete(`/videos/${video._id}`);
                if (res.data.success) {
                  showAlert('Success', 'Video deleted');
                  // Since we don't have a way to refresh the list here without props, 
                  // it's better if the parent handles delete. 
                  // But we'll leave this as a fallback.
                }
              } catch (err) {
                showAlert('Error', 'Failed to delete video');
              }
            }
          }
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.92}
      onPress={() => router.push(`/video/${video._id}`)}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: resolveMediaUrl(video?.thumbnail) || FALLBACK_IMAGE }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={250}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={styles.thumbGradient}
          pointerEvents="none"
        />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(video?.duration || 0)}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <TouchableOpacity onPress={() => video?.owner?._id && router.push(`/channel/${video.owner._id}`)}>
          <Image source={{ uri: resolveMediaUrl(video?.owner?.avatar) || FALLBACK_AVATAR }} style={styles.avatar} contentFit="cover" transition={200} />
        </TouchableOpacity>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {video?.title || 'Untitled'}
          </Text>
          <Text
            style={styles.metadata}
            numberOfLines={1}
            onPress={() => video?.owner?._id && router.push(`/channel/${video.owner._id}`)}
          >
            {(video?.owner?.channelName || video?.owner?.name || 'Unknown')} • {formatViews(video?.views || 0)} views • {formatTimeAgo(video?.createdAt)}
          </Text>
        </View>
        <TouchableOpacity style={styles.menuButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={(e) => {
          e.stopPropagation();
          if (onMenuPress) {
            onMenuPress();
          } else {
            openMenu();
          }
        }}>
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textGray} />
        </TouchableOpacity>
      </View>

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable style={[styles.menuContent, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            {isOwner && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Ionicons name="pencil-outline" size={24} color={Colors.text} />
                  <Text style={styles.menuText}>Edit Video</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.menuText, { color: Colors.primary }]}>Delete Video</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handlePlaylist}>
              <Ionicons name="add-circle-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Add to Playlist</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Share</Text>
            </TouchableOpacity>

            {!isOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                <Ionicons name="flag-outline" size={24} color={Colors.text} />
                <Text style={styles.menuText}>Report</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelItem} onPress={() => setMenuVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginBottom: 5,
    backgroundColor: Colors.white,
    borderRadius: 0,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  thumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 6,
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
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
    borderWidth: 1.5,
    borderColor: Colors.primary + '33',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
    lineHeight: 20,
  },
  metadata: {
    fontSize: 12,
    color: Colors.textGray,
  },
  menuButton: {
    paddingLeft: 8,
    alignSelf: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 10,
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
    marginTop: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
});

export default VideoCard;
