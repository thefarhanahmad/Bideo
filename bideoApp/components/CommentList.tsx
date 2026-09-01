import { showAlert } from './AppAlert';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Keyboard, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import api from '../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { formatTimeAgo } from '../utils/formatDate';
import VerifiedBadge from './VerifiedBadge';
import HashtagText from './HashtagText';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

interface CommentListProps {
  videoId?: string;
  postId?: string;
  contentOwnerId?: string;
  onCommentAdded: () => void;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
}

const CommentList: React.FC<CommentListProps> = ({ videoId, postId, contentOwnerId, onCommentAdded, isAuthenticated, onAuthRequired }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<any | null>(null);
  const [editingReply, setEditingReply] = useState<{commentId: string, reply: any} | null>(null);
  const [editText, setEditText] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const replyInputRef = useRef<TextInput>(null);

  const isCreator = Boolean(
    user?._id &&
    contentOwnerId &&
    user._id.toString() === contentOwnerId.toString()
  );
  const isAdmin = user?.role === 'admin';
  const canManagePin = isCreator || isAdmin;

  useEffect(() => {
    fetchComments();
  }, [videoId, postId]);

  useEffect(() => {
    if (replyTarget) {
      const timer = setTimeout(() => replyInputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [replyTarget]);

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

  const handleUpdateComment = async () => {
    if ((!editingComment && !editingReply) || !editText.trim() || editSubmitting) return;
    setEditSubmitting(true);
    try {
      if (editingComment) {
        await api.put(`/comments/${editingComment._id}`, { text: editText });
      } else if (editingReply) {
        await api.put(`/comments/${editingReply.commentId}/replies/${editingReply.reply._id}`, { text: editText });
      }
      setEditingComment(null);
      setEditingReply(null);
      setEditText('');
      fetchComments(true);
    } catch (err) {
      console.error('Failed to update', err);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.delete(`/comments/${commentId}`);
      fetchComments(true);
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    try {
      await api.delete(`/comments/${commentId}/replies/${replyId}`);
      fetchComments(true);
    } catch (err) {
      console.error('Failed to delete reply', err);
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

  const closeReply = () => {
    setReplyTarget(null);
    setReplyText('');
    Keyboard.dismiss();
  };

  const handleReply = async (commentId: string, text: string) => {
    if (!isAuthenticated) return onAuthRequired();
    if (!text.trim()) return;
    try {
      await api.post(`/comments/${commentId}/replies`, { text });
      fetchComments(true);
      closeReply();
    } catch (err) {
      console.error('Failed to reply', err);
    } finally {
      setReplySubmitting(false);
    }
  };

  const openReplyComposer = (comment: any) => {
    if (!isAuthenticated) return onAuthRequired();
    setReplyTarget(comment);
    setReplyText('');
  };

  const submitReply = () => {
    if (!replyTarget || !replyText.trim() || replySubmitting) return;
    setReplySubmitting(true);
    handleReply(replyTarget._id, replyText);
  };

  const handleLikeReply = async (commentId: string, replyId: string) => {
    if (!isAuthenticated) return onAuthRequired();
    try {
      const res = await api.post(`/comments/${commentId}/replies/${replyId}/like`);
      fetchComments(true);
    } catch (err) {
      console.error('Failed to like reply', err);
    }
  };

  const handlePinComment = async (commentId: string) => {
    if (!isAuthenticated) return onAuthRequired();
    try {
      await api.put(`/comments/${commentId}/pin`);
      fetchComments(true);
    } catch (err: any) {
      console.error('Failed to pin/unpin comment', err);
      showAlert('Error', err?.response?.data?.message || 'Failed to update pin status');
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
            placeholderTextColor={Colors.textGray}
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
            canManagePin={canManagePin}
            onPin={() => handlePinComment(item._id)}
            onOpenChannel={(channelId: string) => router.push(`/channel/${channelId}`)}
            onLike={() => handleLikeComment(item._id)}
            onReply={() => openReplyComposer(item)}
            onLikeReply={(replyId: string) => handleLikeReply(item._id, replyId)}
            onEdit={() => {
              setEditingComment(item);
              setEditText(item.text);
            }}
            onDelete={() => handleDeleteComment(item._id)}
            onEditReply={(reply: any) => {
              setEditingReply({ commentId: item._id, reply });
              setEditText(reply.text);
            }}
            onDeleteReply={(replyId: string) => handleDeleteReply(item._id, replyId)}
          />
        ))}
      </View>

      {/* Edit Modal */}
      <Modal
        visible={!!editingComment || !!editingReply}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setEditingComment(null);
          setEditingReply(null);
        }}
        statusBarTranslucent
      >
        <Pressable 
          style={styles.replyModal} 
          onPress={() => {
            setEditingComment(null);
            setEditingReply(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={{ width: '100%', justifyContent: 'flex-end', flex: 1 }}
          >
            <Pressable 
              style={[
                styles.replyComposer,
                {
                  paddingBottom: Math.max(insets.bottom, 12) + 10,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.replyComposerHeader}>
                <Text style={styles.replyingToText}>{editingReply ? 'Edit Reply' : 'Edit Comment'}</Text>
                <TouchableOpacity onPress={() => {
                  setEditingComment(null);
                  setEditingReply(null);
                }} style={styles.closeReplyBtn}>
                  <Ionicons name="close" size={22} color={Colors.textGray} />
                </TouchableOpacity>
              </View>
              <View style={styles.replyComposerRow}>
                <TextInput
                  style={styles.replyComposerInput}
                  placeholder="Edit your comment..."
                  placeholderTextColor={Colors.textGray}
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.replySendBtn, !editText.trim() && styles.replySendBtnDisabled]}
                  onPress={handleUpdateComment}
                  disabled={!editText.trim() || editSubmitting}
                >
                  {editSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal
        visible={!!replyTarget}
        transparent
        animationType="slide"
        onRequestClose={closeReply}
        statusBarTranslucent
      >
        <Pressable 
          style={styles.replyModal} 
          onPress={closeReply}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
            style={{ width: '100%', justifyContent: 'flex-end', flex: 1 }}
          >
            <Pressable 
              style={[
                styles.replyComposer,
                {
                  paddingBottom: Math.max(insets.bottom, 12) + 10,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.replyComposerHeader}>
                <Text style={styles.replyingToText} numberOfLines={1}>
                  Replying to {replyTarget?.user?.channelName || replyTarget?.user?.name || 'User'}
                </Text>
                <TouchableOpacity 
                  onPress={closeReply} 
                  style={styles.closeReplyBtn} 
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  <Ionicons name="close" size={22} color={Colors.textGray} />
                </TouchableOpacity>
              </View>
              <View style={styles.replyComposerRow}>
                <TextInput
                  ref={replyInputRef}
                  style={styles.replyComposerInput}
                  placeholder="Write a reply..."
                  placeholderTextColor={Colors.textGray}
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={submitReply}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.replySendBtn, !replyText.trim() && styles.replySendBtnDisabled]}
                  onPress={submitReply}
                  disabled={!replyText.trim() || replySubmitting}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  {replySubmitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="send" size={18} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
};

const CommentItem = ({
  item,
  userId,
  canManagePin,
  onOpenChannel,
  onLike,
  onReply,
  onLikeReply,
  onEdit,
  onDelete,
  onPin,
}: any) => {
  const liked = item.likes?.some((id: string) => id === userId);
  const isOwner = item.user?._id === userId;

  const showOptions = () => {
    const options: any[] = [{ text: 'Cancel', style: 'cancel' }];

    if (canManagePin) {
      options.push({
        text: item.isPinned ? 'Unpin comment' : 'Pin comment',
        onPress: onPin,
      });
    }

    if (isOwner) {
      options.push({ text: 'Edit', onPress: onEdit });
    }

    if (isOwner || canManagePin) {
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          showAlert('Delete', 'Are you sure you want to delete this comment?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ]);
        },
      });
    }

    if (Platform.OS === 'web') {
      if (confirm(item.isPinned ? 'Unpin this comment?' : 'Pin this comment?')) {
        if (canManagePin) onPin();
      }
      return;
    }

    showAlert('Comment Options', 'What would you like to do?', options);
  };

  return (
    <View style={[styles.commentItem, item.isPinned && styles.pinnedCommentItem]}>
      <TouchableOpacity onPress={() => item.user?._id && onOpenChannel(item.user._id)}>
        <Image source={{ uri: item.user?.avatar || FALLBACK_AVATAR }} style={styles.avatar} />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        {Boolean(item.isPinned) && (
          <View style={styles.pinnedBadgeRow}>
            <Ionicons name="pin" size={12} color={Colors.textGray} style={{ marginRight: 4 }} />
            <Text style={styles.pinnedBadgeText} numberOfLines={1}>
              Pinned by {item.pinnedBy?.channelName || item.pinnedBy?.name || 'creator'}
            </Text>
          </View>
        )}
        <View style={styles.commentHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={styles.username} onPress={() => item.user?._id && onOpenChannel(item.user._id)}>
              {item.user?.channelName || item.user?.name || 'User'}
            </Text>
            {Boolean(item.user?.isVerified) && <VerifiedBadge size={12} style={{ marginLeft: 2 }} />}
            <Text style={styles.time}> • {formatTimeAgo(item.createdAt)}</Text>
          </View>
          {(isOwner || canManagePin) && (
            <TouchableOpacity onPress={showOptions} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-vertical" size={14} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
        <HashtagText text={item.text} style={styles.commentText} />
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.actionItem} onPress={onLike}>
            <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={liked ? Colors.primary : Colors.textGray} />
            <Text style={styles.actionText}>{item.likes?.length || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={onReply}>
            <Text style={styles.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>

        {(item.replies || []).map((reply: any) => {
          const replyLiked = reply.likes?.some((id: string) => id === userId);
          return (
            <View key={reply._id || reply.createdAt} style={styles.replyItem}>
              <View style={styles.replyHeader}>
                <Text style={styles.username}>{reply.user?.channelName || reply.user?.name || 'User'}</Text>
                {Boolean(reply.user?.isVerified) && <VerifiedBadge size={11} style={{ marginLeft: 2 }} />}
                <Text style={styles.time}> • {formatTimeAgo(reply.createdAt)}</Text>
              </View>
              <HashtagText text={reply.text} style={styles.commentText} />
              <View style={styles.commentActions}>
                <TouchableOpacity style={styles.actionItem} onPress={() => onLikeReply(reply._id)}>
                  <Ionicons name={replyLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={12} color={replyLiked ? Colors.primary : Colors.textGray} />
                  <Text style={styles.actionText}>{reply.likes?.length || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={onReply}>
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
  container: { padding: 12, paddingBottom: 24 },
  headerText: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  inputSection: { marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, fontSize: 14, color: Colors.text, maxHeight: 100 },
  sendButton: { padding: 5, marginLeft: 10 },
  commentsList: { marginTop: 6 },
  commentItem: { flexDirection: 'row', marginBottom: 18 },
  pinnedCommentItem: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 8,
    borderRadius: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  pinnedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pinnedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textGray,
  },
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
  replyItem: { marginTop: 15, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: Colors.border },
  replyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  replyModal: { flex: 1, justifyContent: 'flex-end' },
  replyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  replyComposer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  replyComposerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  replyingToText: { flex: 1, color: Colors.textGray, fontSize: 12, fontWeight: '600' },
  closeReplyBtn: { padding: 4, marginLeft: 8 },
  replyComposerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  replyComposerInput: { flex: 1, color: Colors.text, fontSize: 14, maxHeight: 110, paddingVertical: 6 },
  replySendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  replySendBtnDisabled: { opacity: 0.45 },
});

export default CommentList;
