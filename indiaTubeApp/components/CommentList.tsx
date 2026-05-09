import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import api from '../services/api';

interface CommentListProps {
  videoId: string;
  onCommentAdded: () => void;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
}

const CommentList: React.FC<CommentListProps> = ({ videoId, onCommentAdded, isAuthenticated, onAuthRequired }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [videoId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/comments/${videoId}`);
      setComments(response.data.data);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }

    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await api.post('/comments', {
        video: videoId,
        text: newComment,
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

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>{comments.length} Comments</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          value={newComment}
          onChangeText={setNewComment}
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleAddComment}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="send" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {comments.map((item) => (
        <View key={item._id} style={styles.commentItem}>
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.username}>{item.user.name}</Text>
              <Text style={styles.time}> • 2h ago</Text>
            </View>
            <Text style={styles.commentText}>{item.text}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity style={styles.actionItem}>
                <Ionicons name="thumbs-up-outline" size={14} color={Colors.textGray} />
                <Text style={styles.actionText}>{item.likes?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem}>
                <Ionicons name="thumbs-down-outline" size={14} color={Colors.textGray} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem}>
                <Text style={styles.replyText}>Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  sendButton: {
    padding: 8,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
  time: {
    fontSize: 11,
    color: Colors.textGray,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 12,
    color: Colors.textGray,
    marginLeft: 4,
  },
  replyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
});

export default CommentList;
