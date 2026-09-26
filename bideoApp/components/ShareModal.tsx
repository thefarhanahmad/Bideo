import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Pressable,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import { RootState } from '../redux/store';
import { chatService, resolveMediaUrl } from '../services/api';
import { requestOnlineStatus } from '../services/socket';
import { shareVideo, sharePost, shareChannel } from '../utils/shareHelper';
import VerifiedBadge from './VerifiedBadge';
import AuthModal from './AuthModal';
import { AppAdBanner } from './AppAds';
import { formatViews } from '../utils/formatDate';
import { hapticLight, hapticSelection } from '../utils/haptics';

const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';
const FALLBACK_THUMBNAIL = 'https://via.placeholder.com/320x180.png?text=Bideo';

export interface ShareModalItem {
  type: 'video' | 'post' | 'channel';
  _id: string;
  title?: string;
  text?: string;
  name?: string;
  channelName?: string;
  avatar?: string;
  about?: string;
  followersCount?: number;
  isVerified?: boolean;
  thumbnail?: string;
  imageUrl?: string;
  isShort?: boolean;
  authorName?: string;
  owner?: any;
  author?: any;
  duration?: number;
}

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  item: ShareModalItem | null;
}

export default function ShareModal({ visible, onClose, item }: ShareModalProps) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [sentMap, setSentMap] = useState<Record<string, 'idle' | 'sending' | 'sent'>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const currentUserId = user?._id?.toString() || user?.id?.toString() || '';

  // Load conversations when modal opens
  useEffect(() => {
    if (visible && isAuthenticated) {
      setSentMap({});
      setCopiedLink(false);
      setSearchQuery('');
      loadChats();
    }
  }, [visible, isAuthenticated]);

  const loadChats = async () => {
    try {
      setLoadingChats(true);
      const data = await chatService.getConversations();
      if (Array.isArray(data)) {
        setConversations(data);

        // Fetch online presence
        const participantIds = data
          .map((c) => c.otherParticipant?._id)
          .filter(Boolean) as string[];

        if (participantIds.length > 0) {
          requestOnlineStatus(participantIds, (status) => {
            if (status) {
              setOnlineMap((prev) => ({ ...prev, ...status }));
            }
          });
        }
      }
    } catch (err) {
      console.warn('[ShareModal] Failed to load chats:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  // Filter conversations by search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      const name = c.otherParticipant?.name?.toLowerCase() || '';
      const channelName = c.otherParticipant?.channelName?.toLowerCase() || '';
      return name.includes(q) || channelName.includes(q);
    });
  }, [conversations, searchQuery]);

  if (!item) return null;

  const isVideo = item.type === 'video';
  const isPost = item.type === 'post';
  const isChannel = item.type === 'channel';

  const shareUrl = isVideo
    ? `https://bideo.in/v/${item._id}`
    : isPost
    ? `https://bideo.in/p/${item._id}`
    : `https://bideo.in/channel/${item._id}`;

  const creatorName = isChannel
    ? item.channelName || item.name || 'Channel'
    : item.owner?.channelName ||
      item.owner?.name ||
      item.author?.channelName ||
      item.author?.name ||
      'Creator';

  const previewThumbnail = isChannel
    ? (item.avatar ? resolveMediaUrl(item.avatar) : FALLBACK_AVATAR)
    : item.thumbnail ||
      item.imageUrl ||
      (isVideo ? resolveMediaUrl(item.thumbnail) : resolveMediaUrl(item.imageUrl)) ||
      FALLBACK_THUMBNAIL;

  // Send item directly to a conversation
  const handleSendToChat = async (conv: any) => {
    const convId = conv._id;
    if (sentMap[convId] === 'sending' || sentMap[convId] === 'sent') return;

    try {
      hapticLight();
      setSentMap((prev) => ({ ...prev, [convId]: 'sending' }));

      await chatService.sendMessage({
        conversationId: convId,
        videoId: isVideo ? item._id : undefined,
        postId: isPost ? item._id : undefined,
        text: shareUrl,
      });

      hapticSelection();
      setSentMap((prev) => ({ ...prev, [convId]: 'sent' }));
    } catch (err: any) {
      console.error('[ShareModal] Send failed:', err);
      setSentMap((prev) => ({ ...prev, [convId]: 'idle' }));
    }
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      hapticLight();
      await Clipboard.setStringAsync(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.warn('[ShareModal] Copy failed:', err);
    }
  };

  // WhatsApp share
  const handleWhatsAppShare = async () => {
    onClose();

    if (isChannel) {
      const cleanName = (item.channelName || item.name || 'Creator').trim();
      const text = `${shareUrl}\n\nCheck out @${cleanName} on Bideo`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
      try {
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
          return;
        }
      } catch {}

      await shareChannel({
        _id: item._id,
        name: item.name,
        channelName: item.channelName,
      });
      return;
    }

    const cleanTitle = (item.title || item.text || '').trim();
    const contentType = isVideo ? (item.isShort ? 'Short' : 'Video') : 'Post';
    const text = cleanTitle
      ? `${shareUrl}\n\nWatch "${cleanTitle}" on Bideo`
      : `${shareUrl}\n\nWatch this ${contentType} on Bideo`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return;
      }
    } catch {
      // Fallback to system share
    }

    // System share fallback
    if (isVideo) {
      await shareVideo({ _id: item._id, title: item.title, isShort: item.isShort });
    } else {
      await sharePost({ _id: item._id, text: item.text, authorName: creatorName });
    }
  };

  // Native More Share
  const handleMoreShare = async () => {
    onClose();
    if (isChannel) {
      await shareChannel({
        _id: item._id,
        name: item.name,
        channelName: item.channelName,
      });
    } else if (isVideo) {
      await shareVideo({ _id: item._id, title: item.title, isShort: item.isShort });
    } else {
      await sharePost({ _id: item._id, text: item.text, authorName: creatorName });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}
        >
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Share</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Item Preview Card */}
          <View style={styles.previewCard}>
            <Image
              source={{ uri: previewThumbnail }}
              style={[styles.previewImage, isChannel && styles.previewAvatar]}
              contentFit="cover"
              transition={120}
            />
            <View style={styles.previewMeta}>
              <View style={styles.previewTypeRow}>
                <Ionicons
                  name={
                    isChannel
                      ? 'person-circle-outline'
                      : isVideo
                      ? item.isShort
                        ? 'flash'
                        : 'videocam'
                      : 'document-text'
                  }
                  size={13}
                  color={Colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.previewTypeBadge}>
                  {isChannel
                    ? 'Channel'
                    : isVideo
                    ? item.isShort
                      ? 'Short'
                      : 'Video'
                    : 'Community Post'}
                </Text>
              </View>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {isChannel
                  ? item.channelName || item.name || 'Channel'
                  : item.title || item.text || 'Bideo Content'}
              </Text>
              <Text style={styles.previewCreator} numberOfLines={1}>
                {isChannel
                  ? `${formatViews(item.followersCount || 0)} followers`
                  : `by ${creatorName}`}
              </Text>
            </View>
          </View>

          {/* Section: Send on Bideo */}
          <View style={styles.chatSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Send on Bideo</Text>
              {conversations.length > 0 && (
                <Text style={styles.sectionSubtitle}>{conversations.length} recent chats</Text>
              )}
            </View>

            {!isAuthenticated ? (
              <View style={styles.authNotice}>
                <Ionicons name="chatbubbles-outline" size={26} color={Colors.primary} />
                <Text style={styles.authNoticeText}>
                  Log in to send this directly to friends and creators on Bideo.
                </Text>
                <TouchableOpacity
                  style={styles.authButton}
                  onPress={() => setAuthModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.authButtonText}>Log In</Text>
                </TouchableOpacity>
              </View>
            ) : loadingChats ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingChatsText}>Loading your chats...</Text>
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.emptyChatsBox}>
                <Text style={styles.emptyChatsText}>
                  No active chats yet. Visit any creator’s channel and tap "Chat" to start
                  conversations!
                </Text>
              </View>
            ) : (
              <>
                {/* Search bar */}
                {conversations.length > 4 && (
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={15} color={Colors.textGray} style={{ marginRight: 6 }} />
                    <TextInput
                      placeholder="Search friends..."
                      placeholderTextColor={Colors.textGray}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={styles.searchInput}
                      clearButtonMode="while-editing"
                    />
                  </View>
                )}

                {/* Vertical list of contacts - scrollable */}
                <FlatList
                  data={filteredChats}
                  keyExtractor={(c) => c._id}
                  style={styles.chatsList}
                  contentContainerStyle={styles.chatsListContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  renderItem={({ item: conv }) => {
                    const other = conv.otherParticipant;
                    const isOnline = Boolean(other?._id && onlineMap[other._id]);
                    const sendState = sentMap[conv._id] || 'idle';

                    return (
                      <View style={styles.chatRow}>
                        <View style={styles.chatRowLeft}>
                          <View style={styles.chatAvatarWrapper}>
                            <Image
                              source={{ uri: other?.avatar || FALLBACK_AVATAR }}
                              style={styles.chatAvatar}
                              contentFit="cover"
                            />
                            {isOnline && <View style={styles.onlineDot} />}
                          </View>
                          <View style={styles.chatRowInfo}>
                            <View style={styles.chatNameRow}>
                              <Text style={styles.chatName} numberOfLines={1}>
                                {other?.channelName || other?.name || 'User'}
                              </Text>
                              {Boolean(other?.isVerified) && (
                                <VerifiedBadge size={13} style={{ marginLeft: 3 }} />
                              )}
                            </View>
                            <Text style={styles.chatStatusText}>
                              {isOnline ? 'Online now' : 'Offline'}
                            </Text>
                          </View>
                        </View>

                        {/* Send / Sent Action Button */}
                        <TouchableOpacity
                          style={[
                            styles.sendButton,
                            sendState === 'sending' && styles.sendButtonActive,
                            sendState === 'sent' && styles.sendButtonSent,
                          ]}
                          onPress={() => handleSendToChat(conv)}
                          disabled={sendState === 'sending' || sendState === 'sent'}
                          activeOpacity={0.8}
                        >
                          {sendState === 'sending' ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                          ) : sendState === 'sent' ? (
                            <View style={styles.sentContent}>
                              <Ionicons name="checkmark" size={14} color={Colors.white} />
                              <Text style={styles.sendButtonText}>Sent</Text>
                            </View>
                          ) : (
                            <View style={styles.sendContent}>
                              <Ionicons
                                name="paper-plane"
                                size={12}
                                color={Colors.white}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.sendButtonText}>Send</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              </>
            )}
          </View>

          {/* Section: Share to External Apps */}
          <View style={styles.appsSection}>
            <Text style={styles.appsSectionTitle}>Share to Apps</Text>
            <View style={styles.appsRow}>
              {/* Copy Link */}
              <TouchableOpacity
                style={styles.appActionItem}
                onPress={handleCopyLink}
                activeOpacity={0.75}
              >
                <View style={[styles.appIconCircle, copiedLink && styles.appIconCircleCopied]}>
                  <Ionicons
                    name={copiedLink ? 'checkmark' : 'link-outline'}
                    size={22}
                    color={copiedLink ? '#16A34A' : Colors.text}
                  />
                </View>
                <Text style={styles.appActionLabel}>{copiedLink ? 'Copied!' : 'Copy Link'}</Text>
              </TouchableOpacity>

              {/* WhatsApp */}
              <TouchableOpacity
                style={styles.appActionItem}
                onPress={handleWhatsAppShare}
                activeOpacity={0.75}
              >
                <View style={[styles.appIconCircle, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="logo-whatsapp" size={24} color="#16A34A" />
                </View>
                <Text style={styles.appActionLabel}>WhatsApp</Text>
              </TouchableOpacity>

              {/* More Apps */}
              <TouchableOpacity
                style={styles.appActionItem}
                onPress={handleMoreShare}
                activeOpacity={0.75}
              >
                <View style={styles.appIconCircle}>
                  <Ionicons name="share-social-outline" size={22} color={Colors.text} />
                </View>
                <Text style={styles.appActionLabel}>More</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Banner Ad */}
          <View style={styles.bottomBannerWrapper}>
            <AppAdBanner containerStyle={styles.bottomBannerContainer} />
          </View>
        </View>
      </View>

      <AuthModal
        visible={authModalVisible}
        onClose={() => {
          setAuthModalVisible(false);
          if (isAuthenticated) loadChats();
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Item preview
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  previewImage: {
    width: 64,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  previewMeta: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  previewTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  previewTypeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 17,
  },
  previewCreator: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },

  // Chat Section
  chatSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.textGray,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  chatsList: {
    maxHeight: 200,
  },
  chatsListContent: {
    paddingBottom: 4,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  chatRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  chatAvatarWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  chatRowInfo: {
    flex: 1,
  },
  chatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: '85%',
  },
  chatStatusText: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 1,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    opacity: 0.8,
  },
  sendButtonSent: {
    backgroundColor: '#10B981',
  },
  sendContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Auth / Empty states
  authNotice: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  authNoticeText: {
    fontSize: 12,
    color: '#9A3412',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 17,
  },
  authButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 16,
  },
  authButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingChatsText: {
    fontSize: 12,
    color: Colors.textGray,
  },
  emptyChatsBox: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  emptyChatsText: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 17,
  },

  // External Apps
  appsSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  appsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  appActionItem: {
    alignItems: 'center',
    width: 76,
  },
  appIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  appIconCircleCopied: {
    backgroundColor: '#DCFCE7',
  },
  appActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  bottomBannerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 4,
  },
  bottomBannerContainer: {
    paddingVertical: 2,
    marginVertical: 0,
  },
});
