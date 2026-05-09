import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api from '../../services/api';
import { useRouter } from 'expo-router';

export default function UploadScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('All');
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnail, setThumbnail] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickVideo = async () => {
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
    if (!video || !thumbnail || !title || !category) {
      Alert.alert('Error', 'Please fill all fields and select both video and thumbnail');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Video File</Text>
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

      <TouchableOpacity 
        style={[styles.uploadButton, uploading && styles.disabledButton]} 
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.uploadButtonText}>Upload Video</Text>
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
