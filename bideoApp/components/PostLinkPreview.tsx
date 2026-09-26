import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import api, { resolveMediaUrl } from '../services/api';
import VerifiedBadge from './VerifiedBadge';
import { formatViews } from '../utils/formatDate';
import { hapticLight } from '../utils/haptics';

export interface BideoLinkInfo {
  type: 'video' | 'short' | 'channel' | 'post';
  targetId: string;
  matchedUrl: string;
}

export interface PreviewData {
  mediaType: 'video' | 'short' | 'channel' | 'post';
  targetId: string;
  title: string;
  subtitle?: string;
  image?: string;
  channelName?: string;
  avatar?: string;
  isVerified?: boolean;
  meta?: string;
  url?: string;
}

// In-memory cache to prevent re-fetching previews repeatedly
const previewCache = new Map<string, PreviewData | null>();

/**
 * Parses any text to detect Bideo internal media links
 * (videos, shorts, channels, and community posts).
 */
export function detectBideoLink(text: string): BideoLinkInfo | null {
  if (!text) return null;

  // Video (/v/:id or /video/:id)
  const videoMatch = text.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9.-]+\.)?(?:bideo\.(?:in|app)|localhost:\d+)?\/(?:v|video)\/([a-zA-Z0-9_-]+)/i);
  if (videoMatch && videoMatch[1]) {
    return { type: 'video', targetId: videoMatch[1], matchedUrl: videoMatch[0] };
  }

  // Shorts (/shorts/:id)
  const shortsMatch = text.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9.-]+\.)?(?:bideo\.(?:in|app)|localhost:\d+)?\/shorts\/([a-zA-Z0-9_-]+)/i);
  if (shortsMatch && shortsMatch[1]) {
    return { type: 'short', targetId: shortsMatch[1], matchedUrl: shortsMatch[0] };
  }

  // Channel (/c/:id or /channel/:id)
  const channelMatch = text.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9.-]+\.)?(?:bideo\.(?:in|app)|localhost:\d+)?\/(?:c|channel)\/([a-zA-Z0-9_@.-]+)/i);
  if (channelMatch && channelMatch[1]) {
    return { type: 'channel', targetId: channelMatch[1], matchedUrl: channelMatch[0] };
  }

  // Post (/p/:id or /post/:id)
  const postMatch = text.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9.-]+\.)?(?:bideo\.(?:in|app)|localhost:\d+)?\/(?:p|post)\/([a-zA-Z0-9_-]+)/i);
  if (postMatch && postMatch[1]) {
    return { type: 'post', targetId: postMatch[1], matchedUrl: postMatch[0] };
  }

  return null;
}

/**
 * Fetches preview metadata for a detected link.
 */
export async function fetchBideoPreview(linkInfo: BideoLinkInfo): Promise<PreviewData | null> {
  const cacheKey = `${linkInfo.type}:${linkInfo.targetId}`;
  if (previewCache.has(cacheKey)) {
    return previewCache.get(cacheKey) || null;
  }

  try {
    if (linkInfo.type === 'video' || linkInfo.type === 'short') {
      const res = await api.get(`/videos/${linkInfo.targetId}`);
      if (res.data?.success && res.data?.data) {
        const v = res.data.data;
        const isShort = Boolean(v.isShort || linkInfo.type === 'short');
        const preview: PreviewData = {
          mediaType: isShort ? 'short' : 'video',
          targetId: v._id,
          title: v.title || 'Untitled Video',
          subtitle: v.owner?.channelName || v.owner?.name || 'Creator',
          image: v.thumbnail || '',
          avatar: v.owner?.avatar || '',
          channelName: v.owner?.channelName || v.owner?.name || 'Creator',
          isVerified: Boolean(v.owner?.isVerified),
          meta: isShort ? '⚡ Short Reel' : `🎥 Video • ${formatViews(v.views || 0)} views`,
          url: linkInfo.matchedUrl,
        };
        previewCache.set(cacheKey, preview);
        return preview;
      }
    } else if (linkInfo.type === 'channel') {
      const res = await api.get(`/channels/${linkInfo.targetId}`);
      if (res.data?.success && res.data?.data) {
        const c = res.data.data;
        const followers = c.followersCount ? `${formatViews(c.followersCount)} followers` : 'Creator';
        const preview: PreviewData = {
          mediaType: 'channel',
          targetId: c._id,
          title: c.channelName || c.name || 'Channel',
          subtitle: `@${c.name || 'creator'}`,
          image: c.coverImage || c.avatar || '',
          avatar: c.avatar || '',
          channelName: c.channelName || c.name || 'Channel',
          isVerified: Boolean(c.isVerified),
          meta: `👤 Channel • ${followers}`,
          url: linkInfo.matchedUrl,
        };
        previewCache.set(cacheKey, preview);
        return preview;
      }
    } else if (linkInfo.type === 'post') {
      const res = await api.get(`/posts/${linkInfo.targetId}`);
      if (res.data?.success && res.data?.data) {
        const p = res.data.data;
        const preview: PreviewData = {
          mediaType: 'post',
          targetId: p._id,
          title: p.text ? (p.text.length > 90 ? p.text.slice(0, 90) + '...' : p.text) : 'Community Post',
          subtitle: p.owner?.channelName || p.owner?.name || 'Creator',
          image: p.imageUrl || '',
          avatar: p.owner?.avatar || '',
          channelName: p.owner?.channelName || p.owner?.name || 'Creator',
          isVerified: Boolean(p.owner?.isVerified),
          meta: '📝 Community Post',
          url: linkInfo.matchedUrl,
        };
        previewCache.set(cacheKey, preview);
        return preview;
      }
    }
  } catch (err) {
    // If endpoint fails or media removed, cache null to avoid re-spamming
    previewCache.set(cacheKey, null);
  }

  return null;
}

interface PostLinkPreviewProps {
  previewData?: PreviewData | null;
  text?: string;
  onRemove?: () => void;
  onPreviewLoaded?: (preview: PreviewData | null) => void;
  interactive?: boolean;
  style?: any;
}

const FALLBACK_THUMB = 'https://via.placeholder.com/480x270.png?text=Bideo';
const FALLBACK_AVATAR = 'https://via.placeholder.com/80x80.png?text=User';

function PostLinkPreviewComponent({
  previewData: propPreviewData,
  text,
  onRemove,
  onPreviewLoaded,
  interactive = true,
  style,
}: PostLinkPreviewProps) {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(propPreviewData || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (propPreviewData) {
      setData(propPreviewData);
      return;
    }

    if (!text) {
      setData(null);
      if (onPreviewLoaded) onPreviewLoaded(null);
      return;
    }

    const detected = detectBideoLink(text);
    if (!detected) {
      setData(null);
      if (onPreviewLoaded) onPreviewLoaded(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    fetchBideoPreview(detected)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        if (onPreviewLoaded) onPreviewLoaded(res);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [propPreviewData, text]);

  if (loading && !data) {
    return (
      <View style={[styles.loadingBox, style]}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading link preview...</Text>
      </View>
    );
  }

  if (!data) return null;

  const handlePress = () => {
    if (!interactive) return;
    hapticLight();

    if (data.mediaType === 'video') {
      router.push(`/v/${data.targetId}`);
    } else if (data.mediaType === 'short') {
      router.push({ pathname: '/shorts', params: { initialShortId: data.targetId } });
    } else if (data.mediaType === 'channel') {
      router.push(`/channel/${data.targetId}`);
    } else if (data.mediaType === 'post') {
      router.push(`/post/${data.targetId}`);
    }
  };

  const isChannel = data.mediaType === 'channel';
  const isShort = data.mediaType === 'short';

  return (
    <View style={[styles.outerContainer, style]}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={interactive ? 0.85 : 1}
        onPress={handlePress}
        disabled={!interactive}
      >
        {/* Top Type Header */}
        <View style={styles.typeHeader}>
          <View style={[styles.typeBadge, getBadgeStyle(data.mediaType)]}>
            <Ionicons name={getBadgeIcon(data.mediaType)} size={12} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.typeBadgeText}>
              {data.mediaType === 'short'
                ? 'SHORTS'
                : data.mediaType === 'video'
                ? 'VIDEO'
                : data.mediaType === 'channel'
                ? 'CHANNEL'
                : 'COMMUNITY POST'}
            </Text>
          </View>

          {Boolean(onRemove) && (
            <TouchableOpacity
              onPress={onRemove}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.removeBtn}
            >
              <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Content Body */}
        {isChannel ? (
          <View style={styles.channelRow}>
            <Image
              source={{ uri: resolveMediaUrl(data.avatar || data.image) || FALLBACK_AVATAR }}
              style={styles.channelAvatar}
              contentFit="cover"
              transition={150}
            />
            <View style={styles.channelInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.channelTitle} numberOfLines={1}>
                  {data.title}
                </Text>
                {Boolean(data.isVerified) && <VerifiedBadge size={13} style={{ marginLeft: 3 }} />}
              </View>
              {Boolean(data.subtitle) && (
                <Text style={styles.channelSubtitle} numberOfLines={1}>
                  {data.subtitle}
                </Text>
              )}
              {Boolean(data.meta) && (
                <Text style={styles.channelMeta} numberOfLines={1}>
                  {data.meta}
                </Text>
              )}
            </View>
            <View style={styles.viewChannelBtn}>
              <Text style={styles.viewChannelBtnText}>View</Text>
            </View>
          </View>
        ) : (
          <View style={styles.mediaContainer}>
            {Boolean(data.image) ? (
              <View style={[styles.mediaThumbWrap, isShort && styles.mediaThumbWrapShort]}>
                <Image
                  source={{ uri: resolveMediaUrl(data.image) || FALLBACK_THUMB }}
                  style={[styles.mediaThumb, isShort && styles.mediaThumbShort]}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.playOverlay}>
                  <Ionicons name={isShort ? "play" : "play-circle"} size={22} color="#FFF" />
                </View>
              </View>
            ) : null}

            <View style={styles.mediaDetails}>
              <Text style={styles.mediaTitle} numberOfLines={2}>
                {data.title}
              </Text>

              <View style={styles.creatorRow}>
                {Boolean(data.avatar) && (
                  <Image
                    source={{ uri: resolveMediaUrl(data.avatar) || FALLBACK_AVATAR }}
                    style={styles.creatorAvatar}
                    contentFit="cover"
                    transition={150}
                  />
                )}
                <Text style={styles.creatorName} numberOfLines={1}>
                  {data.channelName || data.subtitle || 'Creator'}
                </Text>
                {Boolean(data.isVerified) && <VerifiedBadge size={11} style={{ marginLeft: 3 }} />}
              </View>

              {Boolean(data.meta) && (
                <Text style={styles.mediaMeta} numberOfLines={1}>
                  {data.meta}
                </Text>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function getBadgeStyle(type: string) {
  switch (type) {
    case 'short':
      return { backgroundColor: '#FF7A00' };
    case 'video':
      return { backgroundColor: '#2563EB' };
    case 'channel':
      return { backgroundColor: '#059669' };
    case 'post':
      return { backgroundColor: '#7C3AED' };
    default:
      return { backgroundColor: '#4B5563' };
  }
}

function getBadgeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'short':
      return 'flash';
    case 'video':
      return 'videocam';
    case 'channel':
      return 'person';
    case 'post':
      return 'document-text';
    default:
      return 'link';
  }
}

export const PostLinkPreview = memo(PostLinkPreviewComponent);

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 8,
    width: '100%',
  },
  loadingBox: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    padding: 10,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  removeBtn: {
    padding: 2,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
  },
  // Channel preview
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
  },
  channelInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  channelSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  channelMeta: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  viewChannelBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  viewChannelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  // Media preview (video, short, post)
  mediaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mediaThumbWrap: {
    width: 90,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  mediaThumbWrapShort: {
    width: 50,
    height: 70,
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  mediaThumbShort: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaDetails: {
    flex: 1,
    minWidth: 0,
  },
  mediaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 17,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  creatorAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 4,
    backgroundColor: '#DDD',
  },
  creatorName: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  mediaMeta: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
});
