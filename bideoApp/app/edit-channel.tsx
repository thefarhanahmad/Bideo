import { showAlert } from '../components/AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import { hapticLight, hapticSelection } from '../utils/haptics';
import api from '../services/api';
import { RootState } from '../redux/store';
import { loginSuccess } from '../redux/slices/authSlice';
import Constants from 'expo-constants';

const getAvatarUri = (avatar?: string) => {
  if (!avatar) return null;
  const value = avatar.trim();
  if (!value || value === 'default-avatar.png') return null;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('content://') ||
    value.startsWith('data:image/')
  ) {
    return value;
  }
  return null;
};

export default function EditChannelScreen() {
  const { user, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const router = useRouter();
  const isCreateMode = !user?.channelName;

  const [name, setName] = useState(user?.name || '');
  const [channelName, setChannelName] = useState(user?.channelName || '');
  const [about, setAbout] = useState(user?.about || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [coverImage, setCoverImage] = useState(user?.coverImage || '');
  const [loading, setLoading] = useState(false);

  const pickAvatar = async () => {
    hapticSelection();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your photos to update your profile picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        setAvatar(result.assets[0].uri);
      }
    } catch (err) {
      showAlert('Error', 'Failed to pick image.');
    }
  };

  const pickCoverImage = async () => {
    hapticSelection();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your photos to update your channel banner.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 5], 
        quality: 0.8,
      });

      if (!result.canceled) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (err) {
      showAlert('Error', 'Failed to pick cover image.');
    }
  };

  const handleSave = async () => {
    if (!channelName.trim()) {
      showAlert('Error', 'Channel name is required');
      return;
    }
    hapticLight();

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('channelName', channelName);
      formData.append('about', about);
      
      const isLocalAvatar = avatar?.startsWith('file://') || avatar?.startsWith('content://');
      const isRemoteAvatar = avatar?.startsWith('http://') || avatar?.startsWith('https://');

      let finalAvatarUri = avatar;
      if (isLocalAvatar && avatar) {
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          try {
            const { Image: ImageCompressor } = require('react-native-compressor');
            const compressed = await ImageCompressor.compress(avatar, {
              compressionMethod: 'auto',
            });
            if (compressed) {
              finalAvatarUri = compressed;
              console.log('Avatar compressed:', finalAvatarUri);
            }
          } catch (err) {
            console.warn('Avatar compression failed:', err);
          }
        } else {
          console.log('Expo Go detected: skipping avatar compression');
        }
      }

      if (isLocalAvatar && finalAvatarUri) {
        // @ts-ignore
        formData.append('avatar', {
          uri: finalAvatarUri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        });
      } else if (isRemoteAvatar) {
        formData.append('avatar', avatar);
      }

      const isLocalCover = coverImage?.startsWith('file://') || coverImage?.startsWith('content://');
      const isRemoteCover = coverImage?.startsWith('http://') || coverImage?.startsWith('https://');

      let finalCoverUri = coverImage;
      if (isLocalCover && coverImage) {
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          try {
            const { Image: ImageCompressor } = require('react-native-compressor');
            const compressed = await ImageCompressor.compress(coverImage, {
              compressionMethod: 'auto',
            });
            if (compressed) {
              finalCoverUri = compressed;
              console.log('Cover image compressed:', finalCoverUri);
            }
          } catch (err) {
            console.warn('Cover image compression failed:', err);
          }
        } else {
          console.log('Expo Go detected: skipping cover image compression');
        }
      }

      if (isLocalCover && finalCoverUri) {
        // @ts-ignore
        formData.append('coverImage', {
          uri: finalCoverUri,
          type: 'image/jpeg',
          name: 'cover.jpg',
        });
      } else if (isRemoteCover) {
        formData.append('coverImage', coverImage);
      }

      const res = await api.put('/auth/channel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        dispatch(loginSuccess({ user: res.data.data, token: token! }));
        showAlert('Success', 'Channel customization saved');
        router.back();
      }
    } catch (err: any) {
      console.error('[edit-channel.tsx] handleSave error:', err);
      showAlert('Error', 'Failed to update channel. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={26} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isCreateMode ? 'Setup Channel' : 'Customize Channel'}</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={loading}
            style={[styles.saveHeaderBtn, loading && { opacity: 0.5 }]}
          >
            {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveHeaderBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Live Preview Section */}
        <View style={styles.previewCard}>
          <View style={styles.previewContainer}>
            <TouchableOpacity style={styles.coverSelector} onPress={pickCoverImage}>
              {getAvatarUri(coverImage) ? (
                <Image source={{ uri: getAvatarUri(coverImage)! }} style={styles.previewCover} contentFit="cover" transition={200} />
              ) : (
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.coverPlaceholder}
                >
                  <Ionicons name="image-outline" size={24} color={Colors.white} />
                  <Text style={styles.placeholderText}>Add Banner</Text>
                </LinearGradient>
              )}
              <View style={styles.cameraBadgeCover}>
                <Ionicons name="camera" size={16} color={Colors.white} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.avatarPreviewRow}>
              <TouchableOpacity style={styles.avatarSelector} onPress={pickAvatar}>
                <View style={styles.avatarWrapper}>
                  {getAvatarUri(avatar) ? (
                    <Image source={{ uri: getAvatarUri(avatar)! }} style={styles.previewAvatar} contentFit="cover" transition={200} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={28} color={Colors.textGray} />
                    </View>
                  )}
                </View>
                <View style={styles.cameraBadgeAvatar}>
                  <Ionicons name="camera" size={12} color={Colors.white} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.previewIdentity}>
              <Text style={styles.previewName} numberOfLines={1}>{channelName || user?.name || 'Your Channel'}</Text>
            </View>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Your public name"
              placeholderTextColor={Colors.textGray}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Channel Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Cooking with Sam"
              placeholderTextColor={Colors.textGray}
              value={channelName}
              onChangeText={setChannelName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Bio / Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Tell the world what your channel is about..."
              placeholderTextColor={Colors.textGray}
              multiline
              numberOfLines={3}
              value={about}
              onChangeText={setAbout}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.mainSaveBtn, loading && styles.disabledBtn]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.mainSaveBtnText}>Publish Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 20,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 40,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  saveHeaderBtn: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.primary + '10',
  },
  saveHeaderBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },

  // Preview Card
  previewCard: {
    margin: 12,
  },
  previewContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coverSelector: {
    width: '100%',
    aspectRatio: 16 / 5,
    backgroundColor: '#F3F4F6',
  },
  previewCover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 4,
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cameraBadgeCover: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 15,
  },
  
  avatarPreviewRow: {
    paddingHorizontal: 12,
    marginTop: -30,
  },
  avatarSelector: {
    alignSelf: 'flex-start',
  },
  avatarWrapper: {
    padding: 2,
    backgroundColor: Colors.white,
    borderRadius: 35,
  },
  previewAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadgeAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    padding: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  previewIdentity: {
    padding: 12,
    paddingTop: 6,
  },
  previewName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },

  // Form
  formCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 12,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputGroup: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  // Footer Button
  mainSaveBtn: {
    margin: 12,
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  mainSaveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
