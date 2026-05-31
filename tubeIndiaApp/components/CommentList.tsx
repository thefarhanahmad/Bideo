import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
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

  const fetchComments = async () => {
    try {
      setLoading(true);
      const params = videoId ? { videoId } : { postId };
      const response = await api.get('/comments', { params });
      setComments(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoading(false);
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
      fetchComments();
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
      likes: c.likes?.includes(user?._id)
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
      fetchComments();
    } catch (err) {
      console.error('Failed to reply', err);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>{comments.length} Comments</Text>
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Add a comment..." value={newComment} onChangeText={setNewComment} />
        <TouchableOpacity style={styles.sendButton} onPress={handleAddComment} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="send" size={20} color={Colors.primary} />}
        </TouchableOpacity>
      </View>

      {comments.map((item) => (
        <CommentItem
          key={item._id}
          item={item}
          userId={user?._id}
          onOpenChannel={(channelId: string) => router.push(`/channel/${channelId}`)}
          onLike={() => handleLikeComment(item._id)}
          onReply={(text: string) => handleReply(item._id, text)}
        />
      ))}
    </View>
  );
};

const CommentItem = ({ item, userId, onOpenChannel, onLike, onReply }: any) => {
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
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
        {replying && (
          <View style={styles.replyInputRow}>
            <TextInput style={styles.replyInput} placeholder="Write a reply..." value={replyText} onChangeText={setReplyText} />
            <TouchableOpacity onPress={() => { onReply(replyText); setReplyText(''); setReplying(false); }}>
              <Ionicons name="send" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}
        {(item.replies || []).map((reply: any) => (
          <View key={reply._id || reply.createdAt} style={styles.replyItem}>
            <Text style={styles.username}>{reply.user?.channelName || reply.user?.name || 'User'}</Text>
            <Text style={styles.commentText}>{reply.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12 },
  headerText: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8 },
  input: { flex: 1, fontSize: 14, color: Colors.text },
  sendButton: { padding: 8 },
  commentItem: { flexDirection: 'row', marginBottom: 20 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: '#E5E7EB' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  username: { fontSize: 12, fontWeight: 'bold', color: Colors.textGray },
  time: { fontSize: 11, color: Colors.textGray },
  commentText: { fontSize: 14, color: Colors.text, lineHeight: 18 },
  commentActions: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  actionText: { fontSize: 12, color: Colors.textGray, marginLeft: 4 },
  replyText: { fontSize: 12, fontWeight: 'bold', color: Colors.textGray },
  replyInputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border, marginTop: 8, paddingBottom: 4 },
  replyInput: { flex: 1, fontSize: 13, color: Colors.text },
  replyItem: { marginTop: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: Colors.border },
});

export default CommentList;
