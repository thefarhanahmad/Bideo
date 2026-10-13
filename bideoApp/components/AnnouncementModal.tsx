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
import { LinearGradient } from 'expo-linear-gradient';
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
          {/* Floating Close Button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
            accessibilityLabel="Close announcement"
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Edge-to-edge Hero Image (Zero unnecessary padding) */}
          {hasImage && (
            <TouchableOpacity
              activeOpacity={hasLink ? 0.95 : 1}
              onPress={hasLink ? handleActionPress : undefined}
              style={styles.imageContainer}
            >
              <Image
                source={{ uri: resolveMediaUrl(announcement.image) }}
                style={[styles.announcementImage, { aspectRatio }]}
                contentFit="cover"
                transition={200}
                onLoad={(e) => {
                  const { width, height } = e.source;
                  if (width && height) {
                    setAspectRatio(Math.max(0.8, Math.min(2.2, width / height)));
                  }
                }}
              />
            </TouchableOpacity>
          )}

          {/* Clean Content Section */}
          <View style={[styles.contentWrap, !hasImage && { paddingTop: 24 }]}>
            <View style={styles.badge}>
              <Ionicons name="megaphone-outline" size={12} color="#FF7A00" style={{ marginRight: 5 }} />
              <Text style={styles.badgeText}>ANNOUNCEMENT</Text>
            </View>

            <Text style={styles.title} numberOfLines={3}>
              {announcement.title}
            </Text>

            {hasLink ? (
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleActionPress}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FF7A00', '#FF5500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>Learn More</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissText}>Got It</Text>
              </TouchableOpacity>
            )}
          </View>
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
    paddingHorizontal: 18,
  },
  modalCard: {
    width: Math.min(WINDOW_WIDTH - 36, 400),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  announcementImage: {
    width: '100%',
    maxHeight: 340,
  },
  contentWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  badgeText: {
    color: '#EA580C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  ctaButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dismissBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  dismissText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AnnouncementModal;
