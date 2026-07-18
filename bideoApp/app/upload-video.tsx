import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from '../components/AppAlert';
import { hapticSelection } from '../utils/haptics';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video, Image as ImageCompressor } from 'react-native-compressor';

const FALLBACK_THUMBNAIL = 'https://via.placeholder.com/640x360.png?text=Tube+India';

export default function UploadVideoScreen() {
  const router = useRouter();
  const { editId, type } = useLocalSearchParams<{ editId?: string; type?: 'video' | 'short' }>();

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
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadType = type || (editId ? 'video' : 'video');

  useEffect(() => {
    loadCategories();
    if (editId) {
      loadVideoDetails(editId);
    }
  }, [editId]);

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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your files to upload videos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset: any = result.assets[0];
        if (asset.fileSize && asset.fileSize > 100 * 1024 * 1024) {
          showAlert('File Too Large', 'Please select a video file under 100MB.');
          return;
        }
        if (uploadType === 'short') {
          if (asset.width && asset.height && Math.abs((asset.width / asset.height) - (9 / 16)) > 0.035) {
            showAlert('Invalid short', 'Shorts must be portrait 9:16 videos.');
            return;
          }
        }
        setVideo(asset);
      }
    } catch (err) {
      showAlert('Error', 'Failed to pick video.');
    }
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your photos to set a thumbnail.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: uploadType === 'short' ? [9, 16] : [16, 9],
        quality: 0.7,
      });

      if (!result.canceled) {
        setThumbnail(result.assets[0]);
        setThumbnailChanged(true);
      }
    } catch (err) {
      showAlert('Error', 'Failed to pick or crop thumbnail.');
    }
  };

  const handleUpload = async () => {
    if (editId) {
      handleUpdate();
      return;
    }

    if (!video) {
      showAlert('Error', 'Please select a video');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      let finalVideoUri = video.uri;

      // Compress video silently
      try {
        const compressedUri = await Video.compress(
          video.uri,
          {
            compressionMethod: 'auto',
          }
        );
        if (compressedUri) {
          finalVideoUri = compressedUri;
          console.log('Video compressed successfully:', finalVideoUri);
        }
      } catch (compressErr) {
        console.warn('Video compression failed, uploading raw video:', compressErr);
      }

      const formData = new FormData();
      formData.append('uploadType', uploadType);
      if (title.trim()) formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (category) formData.append('category', category);
      if (tags.trim()) formData.append('tags', tags.trim());
      formData.append('visibility', visibility);

      if (video.duration !== undefined && video.duration !== null) {
        const durationSec = video.duration > 10000 ? video.duration / 1000 : video.duration;
        formData.append('duration', String(durationSec));
      }
      if (video.width) {
        formData.append('width', String(video.width));
      }
      if (video.height) {
        formData.append('height', String(video.height));
      }

      // @ts-ignore
      formData.append('video', {
        uri: finalVideoUri,
        type: 'video/mp4',
        name: 'video.mp4',
      });

      let finalThumbnailUri = thumbnail?.uri;
      if (finalThumbnailUri) {
        // Compress custom thumbnail
        try {
          const compressedThumb = await ImageCompressor.compress(finalThumbnailUri, {
            compressionMethod: 'auto',
          });
          if (compressedThumb) {
            finalThumbnailUri = compressedThumb;
            console.log('Thumbnail compressed successfully:', finalThumbnailUri);
          }
        } catch (thumbCompressErr) {
          console.warn('Thumbnail compression failed:', thumbCompressErr);
        }
      } else if (video.uri) {
        // Generate automatic thumbnail from the video
        try {
          const thumbResult = await VideoThumbnails.getThumbnailAsync(video.uri, {
            time: 1000,
          });
          if (thumbResult && thumbResult.uri) {
            finalThumbnailUri = thumbResult.uri;
          }
        } catch (thumbErr) {
          console.warn('Error generating automatic thumbnail:', thumbErr);
        }
      }

      if (finalThumbnailUri) {
        // @ts-ignore
        formData.append('thumbnail', {
          uri: finalThumbnailUri,
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

      showAlert('Success', 'Video uploaded successfully!');
      router.replace('/');
    } catch (err: any) {
      showAlert('Upload Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      if (thumbnailChanged && thumbnail) {
        let finalThumbnailUri = thumbnail.uri;
        try {
          const compressed = await ImageCompressor.compress(finalThumbnailUri, {
            compressionMethod: 'auto',
          });
          if (compressed) {
            finalThumbnailUri = compressed;
          }
        } catch (err) {
          console.warn('Thumbnail compression failed during update:', err);
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('tags', tags);
        formData.append('visibility', visibility);
        // @ts-ignore
        formData.append('thumbnail', {
          uri: finalThumbnailUri,
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
        await api.put(`/videos/${editId}`, { title, description, category, tags, visibility });
      }
      showAlert('Success', 'Video updated successfully!');
      router.replace('/');
    } catch (err: any) {
      showAlert('Update Failed', err.response?.data?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editId ? 'Edit Video' : `New ${uploadType === 'short' ? 'Short' : 'Video'}`}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ProgressOverlay visible={uploading} progress={uploadProgress} label={editId ? 'Saving' : 'Uploading'} />

        {!editId && (
          <>
            <Text style={styles.label}>Video File *</Text>
            <TouchableOpacity style={styles.picker} onPress={pickVideo} activeOpacity={0.85}>
              {video ? (
                <View style={styles.fileSelected}>
                  <View style={styles.fileBadge}>
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                  </View>
                  <Text style={styles.fileName} numberOfLines={1}>{video.uri.split('/').pop()}</Text>
                  <Text style={styles.changeHint}>Tap to change</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pickerIconCircle}>
                    <Ionicons name="cloud-upload" size={26} color={Colors.primary} />
                  </View>
                  <Text style={styles.pickerText}>Tap to select a video</Text>
                  <Text style={styles.pickerSubText}>MP4 format</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.label}>Thumbnail</Text>
        <TouchableOpacity style={[styles.picker, styles.thumbnailPicker]} onPress={pickThumbnail}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail.uri }} style={styles.thumbnailPreview} contentFit="cover" transition={200} />
          ) : (
            <>
              <View style={styles.pickerIconCircle}>
                <Ionicons name="image" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.pickerText}>Tap to add a thumbnail</Text>
              <Text style={styles.pickerSubText}>{uploadType === 'short' ? '9:16 recommended' : '16:9 recommended'}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter video title"
          placeholderTextColor={Colors.textGray}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter video description"
          placeholderTextColor={Colors.textGray}
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
          placeholderTextColor={Colors.textGray}
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

        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.disabledButton]}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name={editId ? 'checkmark-circle' : 'cloud-upload'} size={20} color={Colors.white} />
          <Text style={styles.uploadButtonText}>{editId ? 'Save Changes' : `Upload ${uploadType === 'short' ? 'Short' : 'Video'}`}</Text>
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
  pickerSubText: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 3,
  },
  fileSelected: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fileName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 240,
  },
  changeHint: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
    height: 100,
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
