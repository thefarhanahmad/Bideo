import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert, Modal, Animated, Easing } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AuthModal from '../../components/AuthModal';

export default function UploadScreen() {
  const router = useRouter();
  const { editId, editPostId } = useLocalSearchParams<{ editId?: string; editPostId?: string }>();
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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [thumbnailChanged, setThumbnailChanged] = useState(false);
  const [uploadType, setUploadType] = useState<'video' | 'short' | 'post' | null>(editId ? 'video' : editPostId ? 'post' : null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [postImageChanged, setPostImageChanged] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!editId && !editPostId) {
        setUploadType(null);
        setTitle('');
        setDescription('');
        setCategory('');
        setTags('');
        setVisibility('public');
        setVideo(null);
        setThumbnail(null);
        setPostText('');
        setPostImage(null);
        setPostImageChanged(false);
      }
    }, [editId, editPostId])
  );

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
      setUploadType('video');
    } else if (editPostId) {
      loadPostDetails(editPostId);
      setUploadType('post');
    }
  }, [isAuthenticated, user?.channelName, editId, editPostId]);

  const loadPostDetails = async (id: string) => {
    try {
      const res = await api.get(`/posts/${id}`);
      if (res.data.success) {
        const p = res.data.data;
        setPostText(p.text || '');
        setVisibility(p.visibility || 'public');
        if (p.imageUrl) {
          setPostImage({ uri: p.imageUrl } as ImagePicker.ImagePickerAsset);
        }
      }
    } catch (err) {
      console.log('Failed to load post details');
    }
  };

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
        if (v.thumbnail) {
          setThumbnail({ uri: v.thumbnail } as ImagePicker.ImagePickerAsset);
        }
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
      }
    } catch (err) {
      console.log('Failed to load categories');
    }
  };

  const pickVideo = async () => {
    if (editId) return; // Cannot change video on edit
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your files to upload videos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8, // Better performance for large videos
      });

      if (!result.canceled) {
        if (uploadType === 'short') {
          const asset: any = result.assets[0];
          if (asset.width && asset.height && Math.abs((asset.width / asset.height) - (9 / 16)) > 0.035) {
            Alert.alert('Invalid short', 'Shorts must be portrait 9:16 videos.');
            return;
          }
        }
        setVideo(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick video.');
    }
  };

  const pickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to create a post.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7, // Lower quality prevents system editor crashes
      });
      if (!result.canceled) {
        setPostImage(result.assets[0]);
        setPostImageChanged(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick or crop image.');
    }
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to set a thumbnail.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7, // Lower quality prevents system editor crashes
      });

      if (!result.canceled) {
        setThumbnail(result.assets[0]);
        setThumbnailChanged(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick or crop thumbnail.');
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

    if (editPostId) {
      handlePostUpdate();
      return;
    }

    if (uploadType === 'post') {
      handlePostUpload();
      return;
    }

    if (!video) {
      Alert.alert('Error', 'Please select a video');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('uploadType', uploadType || 'video');
      const hasMetadata = !!(title.trim() || description.trim() || category || tags.trim() || thumbnail);
      if (title.trim()) formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (category) formData.append('category', category);
      if (tags.trim()) formData.append('tags', tags.trim());
      formData.append('visibility', hasMetadata ? visibility : 'private');
      
      // @ts-ignore
      formData.append('video', {
        uri: video.uri,
        type: 'video/mp4',
        name: 'video.mp4',
      });

      if (thumbnail) {
        // @ts-ignore
        formData.append('thumbnail', {
          uri: thumbnail.uri,
          type: 'image/jpeg',
          name: 'thumbnail.jpg',
        });
      }

      await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
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

  const handlePostUpload = async () => {
    if (!postText.trim() && !postImage) {
      Alert.alert('Error', 'Add text or an image for your post');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('text', postText);
      formData.append('visibility', visibility);
      if (postImage) {
        // @ts-ignore
        formData.append('image', { uri: postImage.uri, type: 'image/jpeg', name: 'post.jpg' });
      }
      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      Alert.alert('Success', 'Post published successfully!');
      setUploadType(null);
      setPostText('');
      setPostImage(null);
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Post Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const handlePostUpdate = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      if (postImageChanged && postImage) {
        const formData = new FormData();
        formData.append('text', postText);
        formData.append('visibility', visibility);
        // @ts-ignore
        formData.append('image', { uri: postImage.uri, type: 'image/jpeg', name: 'post.jpg' });
        await api.put(`/posts/${editPostId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
          },
        });
      } else {
        await api.put(`/posts/${editPostId}`, { text: postText, visibility });
      }
      Alert.alert('Success', 'Post updated successfully!');
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Update Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      if (thumbnailChanged && thumbnail) {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('tags', tags);
        formData.append('visibility', visibility);
        // @ts-ignore
        formData.append('thumbnail', {
          uri: thumbnail.uri,
          type: 'image/jpeg',
          name: 'thumbnail.jpg',
        });
        await api.put(`/videos/${editId}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (event) => {
            if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
          },
        });
      } else {
        await api.put(`/videos/${editId}`, {
          title,
          description,
          category,
          tags,
          visibility
        });
      }
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
        <View style={styles.loginCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-upload" size={50} color={Colors.primary} />
          </View>
          <Text style={styles.loginTitle}>Ready to Share?</Text>
          <Text style={styles.loginSubtitle}>Login to your account to start uploading your videos, shorts, and community posts.</Text>
          
          <TouchableOpacity 
            style={styles.mainLoginBtn} 
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.mainLoginBtnText}>Sign In / Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => router.replace('/')}
          >
            <Text style={styles.secondaryBtnText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
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
      <ProgressOverlay visible={uploading} progress={uploadProgress} label={editId || editPostId ? 'Saving' : uploadType === 'post' ? 'Publishing' : 'Uploading'} />
      
      <Text style={styles.headerTitle}>{editId || editPostId ? `Edit ${editId ? 'Video' : 'Post'}` : uploadType ? `Upload ${uploadType === 'short' ? 'Short' : uploadType === 'post' ? 'Post' : 'Video'}` : 'Create'}</Text>

      {!editId && !editPostId && !uploadType && (
        <View style={styles.typeGrid}>
          {[
            { key: 'video', label: 'Video', icon: 'videocam-outline' },
            { key: 'short', label: 'Short', icon: 'phone-portrait-outline' },
            { key: 'post', label: 'Post', icon: 'document-text-outline' },
          ].map((item: any) => (
            <TouchableOpacity key={item.key} style={styles.typeCard} onPress={() => setUploadType(item.key)}>
              <Ionicons name={item.icon} size={32} color={Colors.primary} />
              <Text style={styles.typeText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {(editPostId || (!editId && uploadType === 'post')) && (
        <>
          <Text style={styles.label}>Post Text</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Share an update..." multiline value={postText} onChangeText={setPostText} />
          <Text style={styles.label}>Image</Text>
          <TouchableOpacity style={[styles.picker, styles.thumbnailPicker]} onPress={pickPostImage}>
            {postImage ? <Image source={{ uri: postImage.uri }} style={styles.thumbnailPreview} /> : (
              <>
                <Ionicons name="image-outline" size={40} color={Colors.textGray} />
                <Text style={styles.pickerText}>Select Image</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.selectContainer}>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setVisibilityOpen(!visibilityOpen)}>
              <Text style={styles.selectValue}>{visibility === 'private' ? 'Private' : 'Public'}</Text>
              <Ionicons name={visibilityOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textGray} />
            </TouchableOpacity>
            {visibilityOpen && (
              <View style={styles.selectMenu}>
                {['public', 'private'].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={styles.selectOption}
                    onPress={() => {
                      setVisibility(v);
                      setVisibilityOpen(false);
                    }}
                  >
                    <Text style={[styles.selectOptionText, visibility === v && styles.selectOptionTextActive]}>{v.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {!editId && !editPostId && uploadType && uploadType !== 'post' && (
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

        </>
      )}

      {uploadType !== null && uploadType !== 'post' && (
      <>
      <Text style={styles.label}>Thumbnail</Text>
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

      <Text style={styles.label}>Title</Text>
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

      <Text style={styles.label}>Category</Text>
      <View style={styles.selectContainer}>
        <TouchableOpacity style={styles.selectTrigger} onPress={() => setCategoryOpen(!categoryOpen)}>
          <Text style={styles.selectValue}>
            {categories.find((c) => c._id === category)?.name || 'Select category'}
          </Text>
          <Ionicons name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textGray} />
        </TouchableOpacity>
        {categoryOpen && (
          <View style={styles.selectMenu}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c._id}
                style={styles.selectOption}
                onPress={() => {
                  setCategory(c._id);
                  setCategoryOpen(false);
                }}
              >
                <Text style={[styles.selectOptionText, category === c._id && styles.selectOptionTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.label}>Tags (comma separated)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. tech, tutorial, react"
        value={tags}
        onChangeText={setTags}
      />

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.selectContainer}>
        <TouchableOpacity style={styles.selectTrigger} onPress={() => setVisibilityOpen(!visibilityOpen)}>
          <Text style={styles.selectValue}>{visibility === 'private' ? 'Private' : 'Public'}</Text>
          <Ionicons name={visibilityOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textGray} />
        </TouchableOpacity>
        {visibilityOpen && (
          <View style={styles.selectMenu}>
            {['public', 'private'].map((v) => (
              <TouchableOpacity
                key={v}
                style={styles.selectOption}
                onPress={() => {
                  setVisibility(v);
                  setVisibilityOpen(false);
                }}
              >
                <Text style={[styles.selectOptionText, visibility === v && styles.selectOptionTextActive]}>{v.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      </>)}

      {uploadType && (
      <TouchableOpacity 
        style={[styles.uploadButton, uploading && styles.disabledButton]} 
        onPress={handleUpload}
        disabled={uploading}
      >
        <Text style={styles.uploadButtonText}>{editId || editPostId ? 'Save Changes' : uploadType === 'post' ? 'Publish Post' : 'Upload Video'}</Text>
      </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const ProgressOverlay = ({ visible, progress, label }: { visible: boolean; progress: number; label: string }) => {
  const spin = useRef(new Animated.Value(0)).current;
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const progressValue = Math.max(0, Math.min(progress || 0, 100));

  useEffect(() => {
    if (!visible) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spin]);

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progressValue,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progressValue]);

  const spinRotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.progressOverlay}>
        <View style={styles.progressBox}>
          <View style={styles.progressRing}>
            <Animated.View style={[styles.progressArc, { transform: [{ rotate: spinRotation }] }]} />
            <View style={styles.progressRingInner}>
              <Text style={styles.progressPercent}>{progressValue}%</Text>
            </View>
          </View>
          <Text style={styles.progressLabel}>{label}...</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressHint}>Keep this screen open</Text>
        </View>
      </View>
    </Modal>
  );
};

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
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  loginCard: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 15,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  mainLoginBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainLoginBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: Colors.textGray,
    fontSize: 15,
    fontWeight: '600',
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
  selectContainer: {
    marginBottom: 6,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  typeCard: {
    flex: 1,
    minHeight: 110,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  typeText: {
    marginTop: 8,
    color: Colors.text,
    fontWeight: '700',
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    color: Colors.text,
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  selectOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  selectOptionText: {
    color: Colors.text,
  },
  selectOptionTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
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
  progressOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  progressBox: {
    width: 220,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 24,
  },
  progressRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 9,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progressArc: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderTopWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 9,
    borderColor: Colors.primary,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  progressRingInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressLabel: {
    marginTop: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  progressHint: {
    marginTop: 10,
    color: Colors.textGray,
    fontSize: 12,
  },
});
