import { showAlert } from '../components/AppAlert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import api from '../services/api';
import { RootState } from '../redux/store';
import { loginSuccess } from '../redux/slices/authSlice';

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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your photos to update your profile picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'We need access to your photos to update your channel banner.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // Restored ratio
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

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('channelName', channelName);
      formData.append('about', about);
      
      const isLocalAvatar = avatar?.startsWith('file://') || avatar?.startsWith('content://');
      const isRemoteAvatar = avatar?.startsWith('http://') || avatar?.startsWith('https://');

      if (isLocalAvatar) {
        // @ts-ignore
        formData.append('avatar', {
          uri: avatar,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        });
      } else if (isRemoteAvatar) {
        formData.append('avatar', avatar);
      }

      const isLocalCover = coverImage?.startsWith('file://') || coverImage?.startsWith('content://');
      const isRemoteCover = coverImage?.startsWith('http://') || coverImage?.startsWith('https://');

      if (isLocalCover) {
        // @ts-ignore
        formData.append('coverImage', {
          uri: coverImage,
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
          <Text style={styles.sectionLabel}>Profile Preview</Text>
          <View style={styles.previewContainer}>
            <TouchableOpacity style={styles.coverSelector} onPress={pickCoverImage}>
              {getAvatarUri(coverImage) ? (
                <Image source={{ uri: getAvatarUri(coverImage)! }} style={styles.previewCover} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={32} color={Colors.textGray} />
                  <Text style={styles.placeholderText}>Add Banner</Text>
                </View>
              )}
              <View style={styles.cameraBadgeCover}>
                <Ionicons name="camera" size={18} color={Colors.white} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.avatarPreviewRow}>
              <TouchableOpacity style={styles.avatarSelector} onPress={pickAvatar}>
                <View style={styles.avatarWrapper}>
                  {getAvatarUri(avatar) ? (
                    <Image source={{ uri: getAvatarUri(avatar)! }} style={styles.previewAvatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={32} color={Colors.textGray} />
                    </View>
                  )}
                </View>
                <View style={styles.cameraBadgeAvatar}>
                  <Ionicons name="camera" size={14} color={Colors.white} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.previewIdentity}>
              <Text style={styles.previewName} numberOfLines={1}>{channelName || user?.name || 'Your Channel'}</Text>
              <Text style={styles.previewHandle}>Profile Preview</Text>
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
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Channel Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Cooking with Sam"
              value={channelName}
              onChangeText={setChannelName}
            />
            <Text style={styles.helpText}>This is your unique channel identity.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Bio / Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Tell the world what your channel is about..."
              multiline
              numberOfLines={4}
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
    paddingBottom: 40,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
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
    paddingHorizontal: 16,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  previewCard: {
    margin: 16,
  },
  previewContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  coverSelector: {
    width: '100%',
    aspectRatio: 16 / 9, // Match restored profile ratio
    backgroundColor: '#F3F4F6',
  },
  previewCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: Colors.textGray,
    fontSize: 14,
    fontWeight: '600',
  },
  cameraBadgeCover: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  
  avatarPreviewRow: {
    paddingHorizontal: 16,
    marginTop: -35, // Match profile overlap
  },
  avatarSelector: {
    alignSelf: 'flex-start',
  },
  avatarWrapper: {
    padding: 3,
    backgroundColor: Colors.white,
    borderRadius: 40,
    elevation: 2,
  },
  previewAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadgeAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    padding: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  previewIdentity: {
    padding: 16,
    paddingTop: 8,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  previewHandle: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },

  // Form
  formCard: {
    backgroundColor: Colors.white,
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // Footer Button
  mainSaveBtn: {
    margin: 16,
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  mainSaveBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
