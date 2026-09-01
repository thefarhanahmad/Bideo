import { showAlert } from './AppAlert';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions, Share, Pressable, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { formatTimeAgo } from '../utils/formatDate';
import { hapticLight, hapticSelection } from '../utils/haptics';
import CommentList from './CommentList';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import api, { resolveMediaUrl } from '../services/api';
import AuthModal from './AuthModal';
import VerifiedBadge from './VerifiedBadge';
import HashtagText from './HashtagText';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

interface PostCardProps {
  post: any;
  onDelete?: (postId: string) => void;
}

const PostCard = ({ post, onDelete }: PostCardProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [likes, setLikes] = useState(post.likes || []);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const owner = post.owner || {};
  const isLiked = likes.includes(user?._id);
  const isOwner = user?._id === owner?._id;

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      const shareMessage = post.text 
        ? `${post.text}\n\nCheck out this post on Bideo!`
        : 'Check out this post on Bideo!';
        
      await Share.share({
        message: shareMessage,
        url: post.imageUrl || undefined,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    hapticLight();

    const previousLikes = [...likes];
    if (isLiked) {
      setLikes(likes.filter((id: string) => id !== user?._id));
    } else {
      setLikes([...likes, user?._id]);
    }

    try {
      const res = await api.post(`/posts/${post._id}/like`);
      if (res.data.success) {
        setLikes(res.data.likes);
      }
    } catch (err) {
      setLikes(previousLikes);
    }
  };

  const handleEdit = () => {
    setMenuVisible(false);
    router.push({ pathname: '/upload-post', params: { editPostId: post._id } });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    showAlert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/posts/${post._id}`);
              if (res.data.success) {
                showAlert('Success', 'Post deleted');
                if (onDelete) onDelete(post._id);
              }
            } catch (err) {
              showAlert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerInfo} onPress={() => owner._id && router.push(`/channel/${owner._id}`)}>
          <Image
            source={{ uri: resolveMediaUrl(owner.avatar) || FALLBACK_AVATAR }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={styles.ownerName}>{owner.channelName || owner.name || 'User'}</Text>
              {Boolean(owner.isVerified) && <VerifiedBadge size={13} style={{ marginLeft: 3 }} />}
            </View>
            <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => { hapticSelection(); setMenuVisible(true); }}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.textGray} />
        </TouchableOpacity>
      </View>

      {!!post.text && <HashtagText text={post.text} style={styles.text} />}
      {!!post.imageUrl && (
        <Image
          source={{ uri: resolveMediaUrl(post.imageUrl) }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons name={isLiked ? "thumbs-up" : "thumbs-up-outline"} size={20} color={isLiked ? Colors.primary : Colors.text} />
          <Text style={[styles.actionText, isLiked && { color: Colors.primary }]}>{likes.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-outline" size={19} color={Colors.text} />
          <Text style={styles.actionText}>{commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={[styles.menuContent, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            {isOwner && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Ionicons name="pencil-outline" size={24} color={Colors.text} />
                  <Text style={styles.menuText}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={24} color={Colors.primary} />
                  <Text style={[styles.menuText, { color: Colors.primary }]}>Delete Post</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelItem} onPress={() => setMenuVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showComments}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowComments(false)}
      >
        <View style={styles.commentModalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowComments(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
          </View>
          
          <ScrollView>
            <CommentList 
              postId={post._id} 
              onCommentAdded={() => setCommentsCount((prev: number) => prev + 1)}
              isAuthenticated={isAuthenticated}
              onAuthRequired={() => setAuthModalVisible(true)}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    padding: 14,
    marginHorizontal: 0,
    marginBottom: 5,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.border,
    borderWidth: 1.5,
    borderColor: Colors.primary + '33',
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  ownerName: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  time: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 2,
  },
  menuButton: {
    padding: 5,
  },
  text: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: Colors.background,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 25,
    paddingVertical: 5,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: Colors.text,
  },
  commentModalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 15,
    color: Colors.text,
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

export default PostCard;
