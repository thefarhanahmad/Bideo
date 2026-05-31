import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { formatTimeAgo } from '../utils/formatDate';
import CommentList from './CommentList';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import api from '../services/api';
import AuthModal from './AuthModal';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

const PostCard = ({ post }: { post: any }) => {
  const router = useRouter();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [likes, setLikes] = useState(post.likes || []);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const owner = post.owner || {};
  const isLiked = likes.includes(user?._id);

  const handleLike = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }

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

  return (
    <View style={styles.container}>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      
      <TouchableOpacity style={styles.header} onPress={() => owner._id && router.push(`/channel/${owner._id}`)}>
        <Image source={{ uri: owner.avatar || FALLBACK_AVATAR }} style={styles.avatar} />
        <View style={styles.headerText}>
          <Text style={styles.ownerName}>{owner.channelName || owner.name || 'User'}</Text>
          <Text style={styles.time}>{formatTimeAgo(post.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {!!post.text && <Text style={styles.text}>{post.text}</Text>}
      {!!post.imageUrl && (
        <Image 
          source={{ uri: post.imageUrl }} 
          style={styles.image} 
          resizeMode="cover"
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

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showComments}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowComments(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowComments(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
          </View>
          
          <ScrollView>
            <CommentList 
              postId={post._id} 
              onCommentAdded={() => setCommentsCount(prev => prev + 1)}
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
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.border,
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
  text: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 12,
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
  modalContainer: {
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
});

export default PostCard;
