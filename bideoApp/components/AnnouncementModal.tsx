import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Image as RNImage,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { hapticLight } from '../utils/haptics';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const resolveMediaUrl = (url: string) => {
  if (!url) return '';
  const apiBase = api.defaults.baseURL || '';
  const serverBase = apiBase.replace('/api', '');

  if (url.startsWith('/')) {
    return `${serverBase}${url}`;
  }

  if (url.includes('localhost:5000') || url.includes('127.0.0.1:5000')) {
    return url
      .replace('http://localhost:5000', serverBase)
      .replace('https://localhost:5000', serverBase)
      .replace('http://127.0.0.1:5000', serverBase)
      .replace('https://127.0.0.1:5000', serverBase);
  }

  return url;
};

// Tracks whether the announcement has already been checked during this app launch session.
let sessionAnnouncementChecked = false;

export const AnnouncementModal: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    // Only check once per app open session
    if (sessionAnnouncementChecked) return;
    sessionAnnouncementChecked = true;

    const checkAnnouncement = async () => {
      try {
        const res = await api.get('/announcements/active');
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const activeList = res.data.data.filter((item: any) => item && item.activeStatus !== false);
          if (activeList.length > 0) {
            const item = activeList[0];
            setAnnouncement(item);

            if (item.image) {
              const fullUrl = resolveMediaUrl(item.image);
              RNImage.getSize(
                fullUrl,
                (w, h) => {
                  if (w && h) {
                    setAspectRatio(Math.max(0.8, Math.min(2.2, w / h)));
                  }
                },
                () => {}
              );
            }

            // Short delay so home finishes initial layout smoothly before popup
            setTimeout(() => {
              setVisible(true);
            }, 600);
          }
        }
      } catch (err) {
        console.log('Could not fetch active announcements on app open:', err);
      }
    };

    checkAnnouncement();
  }, []);

  const handleClose = () => {
    hapticLight();
    setVisible(false);
  };

  const handleActionPress = async () => {
    hapticLight();
    if (!announcement?.link) {
      handleClose();
      return;
    }

    let url = announcement.link.trim();
    if (!url) {
      handleClose();
      return;
    }

    if (!/^https?:\/\//i.test(url) && !/^[a-zA-Z]+:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      await Linking.openURL(url);
    } catch (e) {
      console.log('Failed to open announcement URL:', url, e);
    }

    handleClose();
  };

  if (!visible || !announcement) {
    return null;
  }

  const hasLink = Boolean(announcement.link && announcement.link.trim());
  const hasImage = Boolean(announcement.image);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        {/* Click outside card to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.modalCard}>
          {/* Header: Title on Top + Close Icon */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {announcement.title}
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityLabel="Close announcement"
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Image with clean padding and rounded corners */}
          {hasImage && (
            <TouchableOpacity
              activeOpacity={hasLink ? 0.9 : 1}
              onPress={hasLink ? handleActionPress : undefined}
              style={styles.imagePaddingWrapper}
            >
              <Image
                source={{ uri: resolveMediaUrl(announcement.image) }}
                style={[styles.announcementImage, { aspectRatio }]}
                contentFit="contain"
                transition={200}
                onLoad={(e) => {
                  const { width, height } = e.source;
                  if (width && height) {
                    setAspectRatio(Math.max(0.65, Math.min(2.5, width / height)));
                  }
                }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: Math.min(WINDOW_WIDTH - 40, 420),
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginRight: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePaddingWrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    width: '100%',
  },
  announcementImage: {
    width: '100%',
    maxHeight: 380,
    borderRadius: 14,
  },
});

export default AnnouncementModal;
