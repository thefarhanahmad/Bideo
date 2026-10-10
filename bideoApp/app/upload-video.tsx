import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from '../components/AppAlert';
import { hapticSelection } from '../utils/haptics';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Constants from 'expo-constants';
import MentionSuggestions from '../components/MentionSuggestions';
import { AppAdBanner } from '../components/AppAds';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const FALLBACK_THUMBNAIL = 'https://via.placeholder.com/640x360.png?text=Tube+India';

export default function UploadVideoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);
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
  const [bottomAdLoaded, setBottomAdLoaded] = useState(false);

  // @mention autocomplete states
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActiveField, setMentionActiveField] = useState<'title' | 'description' | null>(null);

  const checkMention = (text: string, field: 'title' | 'description') => {
    const match = text.match(/@([a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F.-]*)$/);
    if (match) {
      setMentionActiveField(field);
      setMentionQuery(match[1] || '');
    } else {
      if (mentionActiveField === field) {
        setMentionActiveField(null);
      }
    }
  };

  const handleTitleChange = (newText: string) => {
    setTitle(newText);
    checkMention(newText, 'title');
  };

  const handleDescriptionChange = (newText: string) => {
    setDescription(newText);
    checkMention(newText, 'description');
  };

  const handleSelectMention = (selectedUser: any) => {
    const handle = selectedUser.channelName || selectedUser.name || 'user';
    if (mentionActiveField === 'title') {
      const replaced = title.replace(/@([a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F.-]*)$/, `@${handle} `);
      setTitle(replaced);
    } else if (mentionActiveField === 'description') {
      const replaced = description.replace(/@([a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F.-]*)$/, `@${handle} `);
      setDescription(replaced);
    }
    setMentionActiveField(null);
    setMentionQuery('');
  };

  const uploadType = type || (editId ? 'video' : 'video');

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      let loadedCats: any[] = [];
      try {
        const res = await api.get('/categories');
        if (res.data.success && Array.isArray(res.data.data)) {
          loadedCats = res.data.data;
          if (isMounted) {
            setCategories(loadedCats);
          }
        }
      } catch (err) {
        console.log('Failed to load categories');
      }

      const topCatId = loadedCats.length > 0 ? loadedCats[0]._id : '';

      if (editId) {
        try {
          const res = await api.get(`/videos/${editId}`);
          if (res.data.success && isMounted) {
            const v = res.data.data;
            setTitle(v.title || '');
            setDescription(v.description || '');
            const existingCat = v.category?._id || v.category;
            // If existing category is valid in loaded categories, keep it; otherwise default to top category
            const isValid = existingCat && loadedCats.some((c) => c._id === existingCat);
            if (isValid) {
              setCategory(existingCat);
            } else if (topCatId) {
              setCategory(topCatId);
            }
            setTags(Array.isArray(v.tags) ? v.tags.join(', ') : (v.tags || ''));
            setVisibility(v.visibility || 'public');
            if (v.thumbnail) {
              setThumbnail({ uri: v.thumbnail } as ImagePicker.ImagePickerAsset);
            }
          }
        } catch (err) {
          console.log('Failed to load video details');
          if (topCatId && isMounted) {
            setCategory((prev) => prev || topCatId);
          }
        }
      } else {
        // By default, select the top category for new uploads (both long videos and shorts)
        if (isMounted && topCatId) {
          setCategory((prev) => prev || topCatId);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [editId]);

  // Fallback sync: ensure top category is selected by default on upload & edit (shorts and long videos)
  useEffect(() => {
    if (categories.length > 0) {
      if (!category || !categories.some((c) => c._id === category)) {
        setCategory(categories[0]._id);
      }
    }
  }, [categories, category]);

  const loadVideoDetails = async (id: string, loadedCats?: any[]) => {
    try {
      const res = await api.get(`/videos/${id}`);
      if (res.data.success) {
        const v = res.data.data;
        setTitle(v.title || '');
        setDescription(v.description || '');
        const existingCat = v.category?._id || v.category;
        const catsList = loadedCats && loadedCats.length > 0 ? loadedCats : categories;
        const isValid = existingCat && catsList.some((c) => c._id === existingCat);
        if (isValid) {
          setCategory(existingCat);
        } else if (catsList.length > 0) {
          setCategory(catsList[0]._id);
        }
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
      if (res.data.success && Array.isArray(res.data.data)) {
        setCategories(res.data.data);
        if (res.data.data.length > 0 && !category) {
          setCategory(res.data.data[0]._id);
        }
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
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset: any = result.assets[0];
        if (asset.fileSize && asset.fileSize > 500 * 1024 * 1024) {
          showAlert('File Too Large', 'Please select a video file under 500MB.');
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
        mediaTypes: ['images'],
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
    setUploadProgress(1);

    try {
      await activateKeepAwakeAsync();
    } catch {
      // keep-awake fallback
    }

    try {
      let finalVideoUri = video.uri;
      let hasCompression = false;

      // Compress video silently (skip if in Expo Go)
      const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
      if (!isExpoGo) {
        try {
          const { Video } = require('react-native-compressor');
          const compressedUri = await Video.compress(
            video.uri,
            {
              compressionMethod: 'manual',
              maxSize: 1280,
              bitrate: 1500000,
              minimumFileSizeForCompress: 0,
            },
            (progress: number) => {
              hasCompression = true;
              const p = Math.round(progress * 25);
              setUploadProgress(Math.min(Math.max(p, 1), 25));
            }
          );
          if (compressedUri) {
            finalVideoUri = compressedUri;
            console.log('Video compressed successfully:', finalVideoUri);
          }
        } catch (compressErr) {
          console.warn('Video compression failed, uploading raw video:', compressErr);
        }
      } else {
        console.log('Expo Go detected: skipping video compression');
      }

      const formData = new FormData();
      formData.append('uploadType', uploadType);
      const safeTitle = title.trim().slice(0, 100);
      const safeDescription = description.trim().slice(0, 1000);
      if (safeTitle) formData.append('title', safeTitle);
      if (safeDescription) formData.append('description', safeDescription);
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
      if (video.fileSize) {
        formData.append('originalVideoSize', String(video.fileSize));
      }
      if (thumbnail && thumbnail.fileSize) {
        formData.append('originalThumbnailSize', String(thumbnail.fileSize));
      }

      // @ts-ignore
      formData.append('video', {
        uri: finalVideoUri,
        type: 'video/mp4',
        name: 'video.mp4',
      });

      let finalThumbnailUri = thumbnail?.uri;
      if (finalThumbnailUri) {
        // Compress custom thumbnail (skip if in Expo Go)
        if (!isExpoGo) {
          try {
            const { Image: ImageCompressor } = require('react-native-compressor');
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
        } else {
          console.log('Expo Go detected: skipping thumbnail compression');
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
        timeout: 900000, // 15 minutes timeout for large video uploads
        onUploadProgress: (event) => {
          if (event.total) {
            const raw = event.loaded / event.total;
            const uploadPercent = hasCompression
              ? 25 + Math.round(raw * 70)
              : Math.round(raw * 95);
            setUploadProgress(Math.min(Math.max(uploadPercent, 1), 95));
          }
        },
      });

      setUploadProgress(100);
      showAlert('Success', 'Video uploaded successfully!');
      router.replace('/');
    } catch (err: any) {
      console.error('[upload-video.tsx] handleUpload error:', err);
      if (err.response?.data) {
        console.error('[upload-video.tsx] handleUpload error response:', err.response.data);
      }
      const serverMessage = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      let displayMsg = 'Something went wrong';
      if (serverMessage) {
        displayMsg = serverMessage;
      } else if (validationErrors && Array.isArray(validationErrors)) {
        displayMsg = validationErrors.map((e: any) => e.msg).join('\n');
      }
      showAlert('Upload Failed', displayMsg);
    } finally {
      try {
        deactivateKeepAwake();
      } catch {
        // ignore
      }
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    setUploading(true);
    setUploadProgress(1);

    try {
      await activateKeepAwakeAsync();
    } catch {
      // ignore
    }

    try {
      const safeTitle = title.trim().slice(0, 100);
      const safeDescription = description.trim().slice(0, 1000);

      if (thumbnailChanged && thumbnail) {
        let finalThumbnailUri = thumbnail.uri;
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          try {
            const { Image: ImageCompressor } = require('react-native-compressor');
            const compressed = await ImageCompressor.compress(finalThumbnailUri, {
              compressionMethod: 'auto',
            });
            if (compressed) {
              finalThumbnailUri = compressed;
            }
          } catch (err) {
            console.warn('Thumbnail compression failed during update:', err);
          }
        }

        const formData = new FormData();
        formData.append('title', safeTitle);
        formData.append('description', safeDescription);
        formData.append('category', category);
        formData.append('tags', tags);
        formData.append('visibility', visibility);
        if (thumbnail && thumbnail.fileSize) {
          formData.append('originalThumbnailSize', String(thumbnail.fileSize));
        }
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
          timeout: 900000,
          onUploadProgress: (event) => {
            if (event.total) setUploadProgress(Math.min(Math.round((event.loaded / event.total) * 95), 95));
          },
        });
      } else {
        await api.put(`/videos/${editId}`, {
          title: safeTitle,
          description: safeDescription,
          category,
          tags,
          visibility,
        });
      }
      setUploadProgress(100);
      showAlert('Success', 'Video updated successfully!');
      router.replace('/');
    } catch (err: any) {
      console.error('[upload-video.tsx] handleUpdate error:', err);
      if (err.response?.data) {
        console.error('[upload-video.tsx] handleUpdate error response:', err.response.data);
      }
      const serverMessage = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      let displayMsg = 'Something went wrong';
      if (serverMessage) {
        displayMsg = serverMessage;
      } else if (validationErrors && Array.isArray(validationErrors)) {
        displayMsg = validationErrors.map((e: any) => e.msg).join('\n');
      }
      showAlert('Update Failed', displayMsg);
    } finally {
      try {
        deactivateKeepAwake();
      } catch {
        // ignore
      }
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editId ? 'Edit Video' : `New ${uploadType === 'short' ? 'Short' : 'Video'}`}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ProgressOverlay visible={uploading} progress={uploadProgress} label={editId ? 'Saving' : undefined} />

        {/* Top Banner Ad */}
        <AppAdBanner containerStyle={styles.topBannerContainer} />

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

        <View style={styles.labelRow}>
          <Text style={styles.labelInRow}>Title</Text>
          <Text style={[styles.charCount, title.length >= 100 && styles.charCountOver]}>
            {title.length}/100
          </Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Enter video title (type @ to mention a creator)"
          placeholderTextColor={Colors.textGray}
          value={title}
          maxLength={100}
          onChangeText={handleTitleChange}
        />
        <MentionSuggestions
          visible={mentionActiveField === 'title'}
          query={mentionQuery}
          onSelectUser={handleSelectMention}
          onClose={() => setMentionActiveField(null)}
        />

        <View style={styles.labelRow}>
          <Text style={styles.labelInRow}>Description</Text>
          <Text style={[styles.charCount, description.length >= 1000 && styles.charCountOver]}>
            {description.length}/1000
          </Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter video description (type @ to mention a creator)"
          placeholderTextColor={Colors.textGray}
          multiline
          numberOfLines={4}
          maxLength={1000}
          value={description}
          onChangeText={handleDescriptionChange}
        />
        <MentionSuggestions
          visible={mentionActiveField === 'description'}
          query={mentionQuery}
          onSelectUser={handleSelectMention}
          onClose={() => setMentionActiveField(null)}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.selectContainer}>
          <TouchableOpacity style={styles.selectTrigger} onPress={() => setCategoryOpen(!categoryOpen)}>
            <Text style={styles.selectValue}>
              {categories.find((c) => c._id === category)?.name || categories[0]?.name || 'Select category'}
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

        {Boolean(editId) && (
          <>
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

      {/* Bottom Sticky Banner Ad */}
      <View style={[styles.bottomBannerWrapper, !bottomAdLoaded && { display: 'none' }, { paddingBottom: Math.max(insets.bottom, 4) }]}>
        <AppAdBanner
          containerStyle={styles.bottomBannerContainer}
          onAdLoaded={() => setBottomAdLoaded(true)}
          onAdFailedToLoad={() => setBottomAdLoaded(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const ProgressOverlay = ({ visible, progress, label }: { visible: boolean; progress: number; label?: string }) => {
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
      duration: 220,
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

  const displayText = label && label !== 'Uploading' && label !== 'Publishing'
    ? (label.endsWith('...') ? label : `${label}...`)
    : progressValue >= 95
      ? 'Finishing up...'
      : 'Uploading...';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.progressOverlay}>
        {/* Banner Ad above progress */}
        <AppAdBanner containerStyle={styles.progressAdBanner} />

        <View style={styles.progressBox}>
          <View style={styles.progressRing}>
            <Animated.View style={[styles.progressArc, { transform: [{ rotate: spinRotation }] }]} />
            <View style={styles.progressRingInner}>
              <Text style={styles.progressPercent}>{progressValue}%</Text>
            </View>
          </View>
          <Text style={styles.progressLabel}>{displayText}</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressHint}>Keep this screen open</Text>
        </View>

        {/* Banner Ad below progress */}
        <AppAdBanner containerStyle={styles.progressAdBanner} />
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
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    color: Colors.text,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 12,
  },
  labelInRow: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  charCount: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textGray,
  },
  charCountOver: {
    color: '#EF4444',
  },
  picker: {
    height: 105,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary + '55',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '08',
  },
  thumbnailPicker: {
    height: 130,
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  pickerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pickerText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerSubText: {
    color: Colors.textGray,
    fontSize: 11,
    marginTop: 2,
  },
  fileSelected: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fileBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  fileName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 240,
  },
  changeHint: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 85,
    textAlignVertical: 'top',
  },
  selectContainer: {
    marginBottom: 4,
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
  },
  selectValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  selectOptionText: {
    color: Colors.text,
    fontSize: 14,
  },
  selectOptionTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 28,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  progressAdBanner: {
    alignSelf: 'center',
    marginVertical: 12,
  },
  progressBox: {
    width: 250,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
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
    fontSize: 15,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginTop: 16,
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
  topBannerContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  bottomBannerWrapper: {
    width: '100%',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBannerContainer: {
    paddingVertical: 4,
    marginVertical: 0,
  },
});
