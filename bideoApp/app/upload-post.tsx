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
import Constants from 'expo-constants';
import MentionSuggestions from '../components/MentionSuggestions';
import { PostLinkPreview, PreviewData, detectBideoLink } from '../components/PostLinkPreview';
import { AppAdBanner } from '../components/AppAds';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export default function UploadPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);
  const { editPostId } = useLocalSearchParams<{ editPostId?: string }>();

  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [postImageChanged, setPostImageChanged] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [uploading, setUploading] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bottomAdLoaded, setBottomAdLoaded] = useState(false);

  // Link preview state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [dismissedPreview, setDismissedPreview] = useState(false);
  const lastDetectedUrlRef = useRef<string | null>(null);

  // @mention autocomplete states
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActive, setMentionActive] = useState(false);

  const handleTextChange = (newText: string) => {
    setPostText(newText);

    // Auto-detect Bideo URLs for live preview
    const detected = detectBideoLink(newText);
    if (detected) {
      if (detected.matchedUrl !== lastDetectedUrlRef.current) {
        lastDetectedUrlRef.current = detected.matchedUrl;
        setDismissedPreview(false);
      }
    } else {
      lastDetectedUrlRef.current = null;
    }

    const match = newText.match(/@([a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F.-]*)$/);
    if (match) {
      setMentionActive(true);
      setMentionQuery(match[1] || '');
    } else {
      setMentionActive(false);
    }
  };

  const handleSelectMention = (selectedUser: any) => {
    const handle = selectedUser.channelName || selectedUser.name || 'user';
    const replaced = postText.replace(/@([a-zA-Z0-9_\u0600-\u06FF\u0900-\u097F.-]*)$/, `@${handle} `);
    setPostText(replaced);
    setMentionActive(false);
    setMentionQuery('');
  };

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
        if (p.previewMedia) {
          setPreviewData(p.previewMedia);
          setDismissedPreview(false);
        }
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
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPostImage(result.assets[0]);
        setPostImageChanged(true);
      }
    } catch (err) {
      showAlert('Error', 'Failed to select image.');
    }
  };

  const handlePostUpload = async () => {
    if (!postText.trim() && !postImage && !previewData) {
      showAlert('Error', 'Add text, a link, or an image for your post');
      return;
    }
    setUploading(true);
    setUploadProgress(1);

    try {
      await activateKeepAwakeAsync();
    } catch {
      // ignore
    }

    try {
      let finalImgUri = postImage?.uri;
      if (postImage) {
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          try {
            const { Image: ImageCompressor } = require('react-native-compressor');
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
        } else {
          console.log('Expo Go detected: skipping post image compression');
        }
      }

      const formData = new FormData();
      formData.append('text', postText);
      formData.append('visibility', visibility);
      if (previewData && !dismissedPreview) {
        formData.append('previewMedia', JSON.stringify(previewData));
      }
      if (postImage && postImage.fileSize) {
        formData.append('originalImageSize', String(postImage.fileSize));
      }
      if (postImage && finalImgUri) {
        // @ts-ignore
        formData.append('image', { uri: finalImgUri, type: 'image/jpeg', name: 'post.jpg' });
      }
      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 900000,
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.min(Math.round((event.loaded / event.total) * 95), 95));
        },
      });
      setUploadProgress(100);
      showAlert('Success', 'Post published successfully!');
      router.replace('/');
    } catch (err: any) {
      console.error('[upload-post.tsx] handlePostUpload error:', err);
      if (err.response?.data) {
        console.error('[upload-post.tsx] handlePostUpload error response:', err.response.data);
      }
      const serverMessage = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      let displayMsg = 'Something went wrong';
      if (serverMessage) {
        displayMsg = serverMessage;
      } else if (validationErrors && Array.isArray(validationErrors)) {
        displayMsg = validationErrors.map((e: any) => e.msg).join('\n');
      }
      showAlert('Post Failed', displayMsg);
    } finally {
      try {
        deactivateKeepAwake();
      } catch {
        // ignore
      }
      setUploading(false);
    }
  };

  const handlePostUpdate = async () => {
    setUploading(true);
    setUploadProgress(1);

    try {
      await activateKeepAwakeAsync();
    } catch {
      // ignore
    }

    try {
      const previewPayload = previewData && !dismissedPreview ? JSON.stringify(previewData) : '';
      if (postImageChanged && postImage) {
        let finalImgUri = postImage.uri;
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          try {
            const { Image: ImageCompressor } = require('react-native-compressor');
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
        } else {
          console.log('Expo Go detected: skipping updated post image compression');
        }

        const formData = new FormData();
        formData.append('text', postText);
        formData.append('visibility', visibility);
        if (previewPayload) {
          formData.append('previewMedia', previewPayload);
        } else {
          formData.append('previewMedia', 'null');
        }
        if (postImage && postImage.fileSize) {
          formData.append('originalImageSize', String(postImage.fileSize));
        }
        // @ts-ignore
        formData.append('image', { uri: finalImgUri, type: 'image/jpeg', name: 'post.jpg' });
        await api.put(`/posts/${editPostId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 900000,
          onUploadProgress: (event) => {
            if (event.total) setUploadProgress(Math.min(Math.round((event.loaded / event.total) * 95), 95));
          },
        });
      } else {
        await api.put(`/posts/${editPostId}`, {
          text: postText,
          visibility,
          previewMedia: previewPayload ? JSON.parse(previewPayload) : null,
        });
      }
      setUploadProgress(100);
      showAlert('Success', 'Post updated successfully!');
      router.replace('/');
    } catch (err: any) {
      console.error('[upload-post.tsx] handlePostUpdate error:', err);
      if (err.response?.data) {
        console.error('[upload-post.tsx] handlePostUpdate error response:', err.response.data);
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

  const handleSubmit = () => {
    if (editPostId) {
      handlePostUpdate();
    } else {
      handlePostUpload();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editPostId ? 'Edit Post' : 'New Post'}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ProgressOverlay visible={uploading} progress={uploadProgress} label={editPostId ? 'Saving' : 'Publishing'} />

        {/* Top Banner Ad */}
        <AppAdBanner containerStyle={styles.topBannerContainer} />

        <Text style={styles.label}>Post Text</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Share an update... (type @ to mention a creator)"
          placeholderTextColor={Colors.textGray}
          multiline
          value={postText}
          onChangeText={handleTextChange}
        />
        <MentionSuggestions
          visible={mentionActive}
          query={mentionQuery}
          onSelectUser={handleSelectMention}
          onClose={() => setMentionActive(false)}
        />

        {/* Live Link Preview (Video, Short, Channel, Post) */}
        {!dismissedPreview && (
          <PostLinkPreview
            text={postText}
            previewData={previewData}
            onPreviewLoaded={(p) => setPreviewData(p)}
            onRemove={() => {
              setDismissedPreview(true);
              setPreviewData(null);
            }}
          />
        )}

        <Text style={styles.label}>Image (Optional)</Text>
        {postImage ? (
          <View style={styles.imagePreviewWrapper}>
            <TouchableOpacity style={styles.thumbnailPickerFilled} onPress={pickPostImage} activeOpacity={0.9}>
              <Image source={{ uri: postImage.uri }} style={styles.thumbnailPreview} contentFit="contain" transition={200} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => {
                setPostImage(null);
                setPostImageChanged(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.tapToChangeHint}>Tap image to change</Text>
          </View>
        ) : (
          <TouchableOpacity style={[styles.picker, styles.thumbnailPicker]} onPress={pickPostImage}>
            <View style={styles.pickerIconCircle}>
              <Ionicons name="image" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.pickerText}>Tap to add an image</Text>
          </TouchableOpacity>
        )}

        {Boolean(editPostId) && (
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
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.85}
        >
          <Ionicons name={editPostId ? 'checkmark-circle' : 'cloud-upload'} size={20} color={Colors.white} />
          <Text style={styles.uploadButtonText}>{editPostId ? 'Save Changes' : 'Publish Post'}</Text>
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
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const progressValue = Math.max(0, Math.min(progress || 0, 100));

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progressValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progressValue]);

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const displayText = label
    ? `${label}...`
    : progressValue >= 95
      ? 'Finishing up...'
      : 'Uploading...';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.progressOverlay}>
        {/* Banner Ad above progress */}
        <AppAdBanner containerStyle={styles.progressAdBanner} />

        <View style={styles.progressBox}>
          <View style={styles.progressIconRow}>
            <View style={styles.progressIconBadge}>
              <Ionicons name="cloud-upload" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressLabel}>{displayText}</Text>
              <Text style={styles.progressHint}>Please keep app open</Text>
            </View>
            <Text style={styles.progressPercent}>{progressValue}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
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
    height: 110,
  },
  imagePreviewWrapper: {
    position: 'relative',
    width: '100%',
  },
  thumbnailPickerFilled: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapToChangeHint: {
    fontSize: 11,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 4,
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
    height: 95,
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
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  progressAdBanner: {
    alignSelf: 'center',
    marginVertical: 12,
  },
  progressBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  progressIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  progressIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  progressHint: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.primary,
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
