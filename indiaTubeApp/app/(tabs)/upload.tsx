import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';

export default function UploadScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [showChannelPrompt, setShowChannelPrompt] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnail, setThumbnail] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
    } else if (!user?.channelName) {
      setShowChannelPrompt(true);
    } else {
      setShowChannelPrompt(false);
    }
    loadCategories();
    if (editId) {
      loadVideoDetails(editId);
    }
  }, [isAuthenticated, user?.channelName, editId]);

  const loadVideoDetails = async (id: string) => {
    try {
      const res = await api.get(`/videos/${id}`);
      if (res.data.success) {
        const v = res.data.data;
        setTitle(v.title);
        setDescription(v.description);
        setCategory(v.category?._id || v.category);
        setTags(Array.isArray(v.tags) ? v.tags.join(', ') : (v.tags || ''));
        setVisibility(v.visibility || 'public');
      }
    } catch (err) {
      console.log('Failed to load video details');
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/categories');
      if (res.data.success) {
        setCategories(res.data.data);
        if (res.data.data.length > 0 && !editId) setCategory(res.data.data[0]._id);
      }
    } catch (err) {
      console.log('Failed to load categories');
    }
  };

  const pickVideo = async () => {
    if (editId) return; // Cannot change video on edit
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setVideo(result.assets[0]);
    }
  };

  const pickThumbnail = async () => {
    if (editId) return; // For simplicity, only edit metadata
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setThumbnail(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }

    if (!user?.channelName) {
      setShowChannelPrompt(true);
      return;
    }

    if (editId) {
      handleUpdate();
      return;
    }

    if (!video || !thumbnail || !title || !category) {
      Alert.alert('Error', 'Please fill all required fields and select both video and thumbnail');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('tags', tags);
      formData.append('visibility', visibility);
      
      // @ts-ignore
      formData.append('video', {
        uri: video.uri,
        type: 'video/mp4',
        name: 'video.mp4',
      });

      // @ts-ignore
      formData.append('thumbnail', {
        uri: thumbnail.uri,
        type: 'image/jpeg',
        name: 'thumbnail.jpg',
      });

      await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Video uploaded successfully!');
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    setUploading(true);
    try {
      await api.put(`/videos/${editId}`, {
        title,
        description,
        category,
        tags,
        visibility
      });
      Alert.alert('Success', 'Video updated successfully!');
      router.replace('/your-videos');
    } catch (err: any) {
      Alert.alert('Update Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated && !authModalVisible) {
    return (
      <View style={styles.center}>
        <Text style={styles.promptText}>Please login to upload videos</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => setAuthModalVisible(true)}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </View>
    );
  }

  if (showChannelPrompt) {
    return (
      <View style={styles.center}>
        <Ionicons name="megaphone-outline" size={80} color={Colors.primary} />
        <Text style={styles.promptTitle}>Channel Required</Text>
        <Text style={styles.promptText}>You need to create a channel name before you can upload videos.</Text>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => router.push('/edit-channel')}
        >
          <Text style={styles.actionBtnText}>Create Channel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      
      <Text style={styles.headerTitle}>{editId ? 'Edit Video' : 'Upload Video'}</Text>

      {!editId && (
        <>
          <Text style={styles.label}>Video File *</Text>
          <TouchableOpacity style={styles.picker} onPress={pickVideo}>
            {video ? (
              <View style={styles.fileInfo}>
                <Ionicons name="videocam" size={24} color={Colors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>{video.uri.split('/').pop()}</Text>
              </View>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={40} color={Colors.textGray} />
                <Text style={styles.pickerText}>Select Video</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Thumbnail *</Text>
          <TouchableOpacity style={[styles.picker, styles.thumbnailPicker]} onPress={pickThumbnail}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail.uri }} style={styles.thumbnailPreview} />
            ) : (
              <>
                <Ionicons name="image-outline" size={40} color={Colors.textGray} />
                <Text style={styles.pickerText}>Select Thumbnail</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter video title"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Enter video description"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((c) => (
            <TouchableOpacity 
              key={c._id} 
              style={[styles.categoryBtn, category === c._id && styles.categoryBtnActive]}
              onPress={() => setCategory(c._id)}
            >
              <Text style={[styles.categoryBtnText, category === c._id && styles.categoryBtnTextActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.label}>Tags (comma separated)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. tech, tutorial, react"
        value={tags}
        onChangeText={setTags}
      />

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.visibilityContainer}>
        {['public', 'private'].map((v) => (
          <TouchableOpacity 
            key={v} 
            style={[styles.visibilityBtn, visibility === v && styles.visibilityBtnActive]}
            onPress={() => setVisibility(v)}
          >
            <Text style={[styles.visibilityBtnText, visibility === v && styles.visibilityBtnTextActive]}>
              {v.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.uploadButton, uploading && styles.disabledButton]} 
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.uploadButtonText}>{editId ? 'Save Changes' : 'Upload Video'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  promptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
  },
  promptText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  picker: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  thumbnailPicker: {
    height: 180,
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  pickerText: {
    color: Colors.textGray,
    marginTop: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  fileName: {
    marginLeft: 10,
    color: Colors.text,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  categoryBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 10,
  },
  categoryBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryBtnText: {
    color: Colors.text,
  },
  categoryBtnTextActive: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  visibilityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visibilityBtn: {
    flex: 0.48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  visibilityBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  visibilityBtnText: {
    fontWeight: 'bold',
    color: Colors.text,
  },
  visibilityBtnTextActive: {
    color: Colors.white,
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
