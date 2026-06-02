import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { formatTimeAgo } from '../utils/formatDate';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

interface CommentListProps {
  videoId?: string;
  postId?: string;
  onCommentAdded: () => void;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
}

const CommentList: React.FC<CommentListProps> = ({ videoId, postId, onCommentAdded, isAuthenticated, onAuthRequired }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [videoId, postId]);

  const fetchComments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = videoId ? { videoId } : { postId };
      const response = await api.get('/comments', { params });
      setComments(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!isAuthenticated) return onAuthRequired();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/comments', { 
        video: videoId, 
        post: postId,
        text: newComment 
      });
      setNewComment('');
      fetchComments(true);
      onCommentAdded();
    } catch (err) {
      console.error('Failed to add comment', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!isAuthenticated) return onAuthRequired();
    const previous = comments;
    setComments(prev => prev.map(c => c._id === commentId ? {
      ...c,
      likes: (c.likes || []).includes(user?._id)
        ? c.likes.filter((id: string) => id !== user?._id)
        : [...(c.likes || []), user?._id],
    } : c));
    try {
      const res = await api.post(`/comments/${commentId}/like`);
      setComments(prev => prev.map(c => c._id === commentId ? { ...c, likes: res.data.likes } : c));
    } catch {
      setComments(previous);
    }
  };

  const handleReply = async (commentId: string, text: string) => {
    if (!isAuthenticated) return onAuthRequired();
    if (!text.trim()) return;
    try {
      await api.post(`/comments/${commentId}/replies`, { text });
      fetchComments(true);
    } catch (err) {
      console.error('Failed to reply', err);
    }
  };

  const handleLikeReply = async (commentId: string, replyId: string) => {
    if (!isAuthenticated) return onAuthRequired();
    // Assuming backend supports liking replies. If not, we might need a separate endpoint.
    // For now, let's assume the same /like endpoint works or we'll need to add it.
    try {
      const res = await api.post(`/comments/${commentId}/replies/${replyId}/like`);
      fetchComments(true);
    } catch (err) {
      console.error('Failed to like reply', err);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>{comments.length} Comments</Text>
      
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Add a comment..." 
            value={newComment} 
            onChangeText={setNewComment} 
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleAddComment} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="send" size={20} color={Colors.primary} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.commentsList}>
        {comments.map((item) => (
          <CommentItem
            key={item._id}
            item={item}
            userId={user?._id}
            onOpenChannel={(channelId: string) => router.push(`/channel/${channelId}`)}
            onLike={() => handleLikeComment(item._id)}
            onReply={(text: string) => handleReply(item._id, text)}
            onLikeReply={(replyId: string) => handleLikeReply(item._id, replyId)}
          />
        ))}
      </View>
    </View>
  );
};

const CommentItem = ({ item, userId, onOpenChannel, onLike, onReply, onLikeReply }: any) => {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const liked = item.likes?.some((id: string) => id === userId);

  return (
    <View style={styles.commentItem}>
      <TouchableOpacity onPress={() => item.user?._id && onOpenChannel(item.user._id)}>
        <Image source={{ uri: item.user?.avatar || FALLBACK_AVATAR }} style={styles.avatar} />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.username} onPress={() => item.user?._id && onOpenChannel(item.user._id)}>
            {item.user?.channelName || item.user?.name || 'User'}
          </Text>
          <Text style={styles.time}> - {formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.actionItem} onPress={onLike}>
            <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={liked ? Colors.primary : Colors.textGray} />
            <Text style={styles.actionText}>{item.likes?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => setReplying(!replying)}>
            <Text style={styles.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>

        {replying && (
          <View style={styles.replyInputRow}>
            <TextInput 
              style={styles.replyInput} 
              placeholder="Write a reply..." 
              value={replyText} 
              onChangeText={setReplyText} 
              autoFocus
            />
            <TouchableOpacity onPress={() => { onReply(replyText); setReplyText(''); setReplying(false); }}>
              <Ionicons name="send" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {(item.replies || []).map((reply: any) => {
          const replyLiked = reply.likes?.some((id: string) => id === userId);
          return (
            <View key={reply._id || reply.createdAt} style={styles.replyItem}>
              <View style={styles.replyHeader}>
                <Text style={styles.username}>{reply.user?.channelName || reply.user?.name || 'User'}</Text>
                <Text style={styles.time}> - {formatTimeAgo(reply.createdAt)}</Text>
              </View>
              <Text style={styles.commentText}>{reply.text}</Text>
              <View style={styles.commentActions}>
                <TouchableOpacity style={styles.actionItem} onPress={() => onLikeReply(reply._id)}>
                  <Ionicons name={replyLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={12} color={replyLiked ? Colors.primary : Colors.textGray} />
                  <Text style={styles.actionText}>{reply.likes?.length || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => setReplying(true)}>
                  <Text style={styles.replyBtnText}>Reply</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 100 },
  headerText: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  inputSection: { marginBottom: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, fontSize: 14, color: Colors.text, maxHeight: 100 },
  sendButton: { padding: 5, marginLeft: 10 },
  commentsList: { marginTop: 10 },
  commentItem: { flexDirection: 'row', marginBottom: 24 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, backgroundColor: '#E5E7EB' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  username: { fontSize: 13, fontWeight: 'bold', color: Colors.textGray },
  time: { fontSize: 11, color: Colors.textGray },
  commentText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  commentActions: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { fontSize: 12, color: Colors.textGray, marginLeft: 4 },
  replyBtnText: { fontSize: 12, fontWeight: 'bold', color: Colors.textGray },
  replyInputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: 10, paddingBottom: 5 },
  replyInput: { flex: 1, fontSize: 13, color: Colors.text, paddingVertical: 5 },
  replyItem: { marginTop: 15, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: Colors.border },
  replyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
});

export default CommentList;
