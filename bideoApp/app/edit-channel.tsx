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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const editCount = user?.channelNameEditCount || 0;
  const lastChangedAt = user?.channelNameChangedAt ? new Date(user.channelNameChangedAt).getTime() : null;

  let isChannelNameLocked = false;
  let daysRemaining = 0;
  let nextAllowedDateStr = '';

  if (!isCreateMode && editCount >= 1 && lastChangedAt) {
    const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastChangedAt;
    if (elapsed < COOLDOWN_MS) {
      isChannelNameLocked = true;
      daysRemaining = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000)));
      const nextDate = new Date(lastChangedAt + COOLDOWN_MS);
      nextAllowedDateStr = nextDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

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
    const trimmedChannelName = channelName.trim();
    if (!trimmedChannelName) {
      showAlert('Error', 'Channel name is required');
      return;
    }
    if (trimmedChannelName.length > 25) {
      showAlert('Error', 'Channel name cannot exceed 25 characters');
      return;
    }

    if (isChannelNameLocked && trimmedChannelName.toLowerCase() !== (user?.channelName || '').toLowerCase()) {
      showAlert(
        'Channel Name Locked',
        `You can only change your channel name once every 60 days. You will be able to change it again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
      );
      return;
    }

    hapticLight();

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('channelName', trimmedChannelName);
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
        const updatedUser = res.data.data;
        dispatch(loginSuccess({ user: updatedUser, token: token! }));
        AsyncStorage.setItem('cached_user', JSON.stringify(updatedUser)).catch(() => {});
        showAlert('Success', 'Channel customization saved');
        router.back();
      }
    } catch (err: any) {
      console.error('[edit-channel.tsx] handleSave error:', err);
      const apiError =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.errors?.[0]?.message ||
        'Failed to update channel. Please check your network and try again.';
      showAlert('Error', apiError);
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Channel Name</Text>
                {isChannelNameLocked && (
                  <View style={styles.lockedBadge}>
                    <Ionicons name="lock-closed" size={11} color="#B45309" />
                    <Text style={styles.lockedBadgeText}>Locked</Text>
                  </View>
                )}
              </View>
              {!isChannelNameLocked && (
                <Text style={{ fontSize: 11, color: channelName.length >= 25 ? Colors.error : Colors.textGray, fontWeight: '600' }}>
                  {channelName.length}/25
                </Text>
              )}
            </View>

            {isChannelNameLocked ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => showAlert('Channel Name Locked', `Channel name can only be changed once every 60 days. You will be able to edit it again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (on ${nextAllowedDateStr}).`)}
              >
                <View style={[styles.textInput, styles.lockedInput]}>
                  <Text style={styles.lockedInputText}>{channelName}</Text>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textGray} />
                </View>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Cooking with Sam"
                placeholderTextColor={Colors.textGray}
                maxLength={25}
                value={channelName}
                onChangeText={setChannelName}
              />
            )}

            {/* Helper & Warning text below Channel Name */}
            {isChannelNameLocked ? (
              <View style={styles.warningBox}>
                <Ionicons name="time-outline" size={15} color="#D97706" style={{ marginTop: 1, marginRight: 6 }} />
                <Text style={styles.warningBoxText}>
                  Channel name is locked. You will be able to change it after 60 days (in <Text style={{ fontWeight: '700' }}>{daysRemaining} day{daysRemaining === 1 ? '' : 's'}</Text> on {nextAllowedDateStr}).
                </Text>
              </View>
            ) : !isCreateMode && editCount === 0 ? (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.primary} style={{ marginTop: 1, marginRight: 6 }} />
                <Text style={styles.infoBoxText}>
                  You can change your channel name once. After this edit, you will only be able to change it again after 60 days.
                </Text>
              </View>
            ) : isCreateMode ? (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.textGray} style={{ marginTop: 1, marginRight: 6 }} />
                <Text style={[styles.infoBoxText, { color: Colors.textGray }]}>
                  Choose your channel name. You will be able to change it once after creation, and then once every 60 days.
                </Text>
              </View>
            ) : (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#D97706" style={{ marginTop: 1, marginRight: 6 }} />
                <Text style={styles.warningBoxText}>
                  Changing your channel name now will lock it for the next 60 days.
                </Text>
              </View>
            )}
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
  lockedInput: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockedInputText: {
    fontSize: 15,
    color: Colors.textGray,
    fontWeight: '500',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 3,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 17,
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
