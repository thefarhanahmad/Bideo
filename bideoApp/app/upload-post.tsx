import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from '../components/AppAlert';
import { Image as ImageCompressor } from 'react-native-compressor';

export default function UploadPostScreen() {
  const router = useRouter();
  const { editPostId } = useLocalSearchParams<{ editPostId?: string }>();

  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [postImageChanged, setPostImageChanged] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [uploading, setUploading] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (editPostId) {
      loadPostDetails(editPostId);
    }
  }, [editPostId]);

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

  const pickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your photos to create a post.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled) {
        setPostImage(result.assets[0]);
        setPostImageChanged(true);
      }
    } catch (err) {
      showAlert('Error', 'Failed to pick or crop image.');
    }
  };

  const handlePostUpload = async () => {
    if (!postText.trim() && !postImage) {
      showAlert('Error', 'Add text or an image for your post');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      let finalImgUri = postImage?.uri;
      if (postImage) {
        try {
          const compressed = await ImageCompressor.compress(postImage.uri, {
            compressionMethod: 'auto',
          });
          if (compressed) {
            finalImgUri = compressed;
            console.log('Post image compressed:', finalImgUri);
          }
        } catch (compressErr) {
          console.warn('Post image compression failed:', compressErr);
        }
      }

      const formData = new FormData();
      formData.append('text', postText);
      formData.append('visibility', visibility);
      if (postImage && postImage.fileSize) {
        formData.append('originalImageSize', String(postImage.fileSize));
      }
      if (postImage && finalImgUri) {
        // @ts-ignore
        formData.append('image', { uri: finalImgUri, type: 'image/jpeg', name: 'post.jpg' });
      }
      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      showAlert('Success', 'Post published successfully!');
      router.replace('/');
    } catch (err: any) {
      showAlert('Post Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const handlePostUpdate = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      if (postImageChanged && postImage) {
        let finalImgUri = postImage.uri;
        try {
          const compressed = await ImageCompressor.compress(postImage.uri, {
            compressionMethod: 'auto',
          });
          if (compressed) {
            finalImgUri = compressed;
            console.log('Updated post image compressed:', finalImgUri);
          }
        } catch (compressErr) {
          console.warn('Updated post image compression failed:', compressErr);
        }

        const formData = new FormData();
        formData.append('text', postText);
        formData.append('visibility', visibility);
        if (postImage && postImage.fileSize) {
          formData.append('originalImageSize', String(postImage.fileSize));
        }
        // @ts-ignore
        formData.append('image', { uri: finalImgUri, type: 'image/jpeg', name: 'post.jpg' });
        await api.put(`/posts/${editPostId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
          },
        });
      } else {
        await api.put(`/posts/${editPostId}`, { text: postText, visibility });
      }
      showAlert('Success', 'Post updated successfully!');
      router.replace('/');
    } catch (err: any) {
      showAlert('Update Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (editPostId) {
      handlePostUpdate();
    } else {
      handlePostUpload();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editPostId ? 'Edit Post' : 'New Post'}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ProgressOverlay visible={uploading} progress={uploadProgress} label={editPostId ? 'Saving' : 'Publishing'} />

        <Text style={styles.label}>Post Text</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Share an update..."
          placeholderTextColor={Colors.textGray}
          multiline
          value={postText}
          onChangeText={setPostText}
        />

        <Text style={styles.label}>Image</Text>
        <TouchableOpacity style={[styles.picker, styles.thumbnailPicker]} onPress={pickPostImage}>
          {postImage ? (
            <Image source={{ uri: postImage.uri }} style={styles.thumbnailPreview} contentFit="cover" transition={200} />
          ) : (
            <>
              <View style={styles.pickerIconCircle}>
                <Ionicons name="image" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.pickerText}>Tap to add an image</Text>
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

        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name={editPostId ? 'checkmark-circle' : 'cloud-upload'} size={20} color={Colors.white} />
          <Text style={styles.uploadButtonText}>{editPostId ? 'Save Changes' : 'Publish Post'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    color: Colors.text,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 18,
  },
  picker: {
    height: 130,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primary + '55',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '08',
  },
  thumbnailPicker: {
    height: 180,
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  pickerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pickerText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  selectContainer: {
    marginBottom: 6,
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
  },
  selectValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  selectOption: {
    paddingVertical: 13,
    paddingHorizontal: 14,
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
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    marginBottom: 40,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
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
    width: 240,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
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
