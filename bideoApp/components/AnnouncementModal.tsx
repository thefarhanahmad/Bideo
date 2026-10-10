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
                    setAspectRatio(Math.max(0.75, Math.min(2.4, w / h)));
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
    setVisible(false);
  };

  const handleActionPress = async () => {
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
          {/* Top Row: Title on the left (max 2 lines), Link & Close button on the right */}
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={2}>
                {announcement.title}
              </Text>
            </View>

            <View style={styles.actionsWrap}>
              {hasLink && (
                <TouchableOpacity
                  style={styles.learnMoreBtn}
                  onPress={handleActionPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.learnMoreText}>Learn More</Text>
                  <Ionicons name="open-outline" size={13} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Announcement Image (below title and link) */}
          {Boolean(announcement.image) && (
            <TouchableOpacity
              activeOpacity={hasLink ? 0.9 : 1}
              onPress={hasLink ? handleActionPress : undefined}
              style={styles.imageContainer}
            >
              <Image
                source={{ uri: resolveMediaUrl(announcement.image) }}
                style={[styles.announcementImage, { aspectRatio }]}
                contentFit="contain"
                transition={200}
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: Math.min(WINDOW_WIDTH - 28, 420),
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWrap: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  learnMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 0,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  learnMoreText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    maxHeight: 330,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementImage: {
    width: '100%',
    maxHeight: 330,
    borderRadius: 0,
  },
});

export default AnnouncementModal;
