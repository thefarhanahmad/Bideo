import { showAlert } from '../../components/AppAlert';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Dimensions, Share, Modal, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import api, { chatService } from '../../services/api';
import PostCard from '../../components/PostCard';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { updateUser } from '../../redux/slices/authSlice';
import AuthModal from '../../components/AuthModal';
import VerifiedBadge from '../../components/VerifiedBadge';
import { formatTimeAgo, formatViews, formatJoinedDate } from '../../utils/formatDate';
import { hapticLight, hapticSelection } from '../../utils/haptics';
import { shareChannel, shareVideo } from '../../utils/shareHelper';
import ShareModal, { ShareModalItem } from '../../components/ShareModal';

const { width } = Dimensions.get('window');
const FALLBACK_AVATAR = 'https://via.placeholder.com/100x100.png?text=User';

export default function ChannelScreen() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'videos' | 'shorts' | 'posts'>('videos');
  const [sort, setSort] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [error, setError] = useState<string | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [dpModalVisible, setDpModalVisible] = useState(false);
  const [nameHistoryModalVisible, setNameHistoryModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareItem, setShareItem] = useState<ShareModalItem | null>(null);

  useEffect(() => {
    loadChannel(filter, sort);
  }, [id, filter, sort]);

  const loadChannel = async (activeFilter = filter, activeSort = sort) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/channels/${id}`, { 
        params: { filter: activeFilter, sort: activeSort } 
      });
      if (res.data.success) {
        const fetchedChannel = res.data.data.channel;
        setChannel(fetchedChannel);
        setVideos(activeFilter === 'posts' ? [] : res.data.data.videos || []);
        setPosts(activeFilter === 'posts' ? res.data.data.posts || [] : []);

        const channelOwnerId = fetchedChannel?._id?.toString() || '';
        const currentUserId = user?._id?.toString() || user?.id?.toString() || '';
        if (currentUserId && channelOwnerId && currentUserId === channelOwnerId) {
          dispatch(updateUser({
            isVerified: Boolean(fetchedChannel.isVerified),
          }));
        }
        return;
      }
      throw new Error('Channel not found');
    } catch (err) {
      const apiError: any = err;
      setError(apiError?.response?.data?.message || 'Failed to load channel');
      setChannel(null);
      console.error('Load Channel Error:', apiError);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    if (!channel) return;
    hapticLight();

    const prevFollowing = channel.isFollowing;
    const prevCount = channel.followersCount || 0;

    setChannel({
      ...channel,
      isFollowing: !prevFollowing,
      followersCount: prevFollowing ? prevCount - 1 : prevCount + 1
    });

    try {
      await api.post(`/followers/${id}`);
    } catch (err) {
      setChannel({
        ...channel,
        isFollowing: prevFollowing,
        followersCount: prevCount
      });
      showAlert('Error', 'Failed to update follow status');
    }
  };

  const handleShare = () => {
    if (!channel) return;
    hapticLight();
    setShareItem({
      type: 'channel',
      _id: channel._id || id,
      name: channel.name,
      channelName: channel.channelName,
      avatar: channel.avatar,
      about: channel.about,
      followersCount: channel.followersCount,
      isVerified: channel.isVerified,
    });
    setShareModalVisible(true);
  };

  const handleChat = async () => {
    if (!isAuthenticated) {
      setAuthModalVisible(true);
      return;
    }
    const targetUserId = channel?._id || id;
    if (!targetUserId) return;
    try {
      const conv = await chatService.getOrCreateConversation(targetUserId);
      if (conv?._id) {
        router.push({
          pathname: `/chat/${conv._id}`,
          params: {
            name: channel?.channelName || channel?.name || '',
            avatar: channel?.avatar || '',
            isVerified: channel?.isVerified ? '1' : '0',
          },
        });
      }
    } catch (err: any) {
      showAlert('Chat', err?.response?.data?.message || 'Failed to open chat');
    }
  };

  const openMenu = (video: any) => {
    setSelectedVideo(video);
    setMenuVisible(true);
  };

  const handleEdit = () => {
    const videoId = selectedVideo?._id;
    setMenuVisible(false);
    router.push({ pathname: '/upload-video', params: { editId: videoId }});
  };

  const handleShareVideo = () => {
    if (!selectedVideo) return;
    setMenuVisible(false);
    hapticLight();
    setShareItem({
      type: 'video',
      _id: selectedVideo._id,
      title: selectedVideo.title,
      thumbnail: selectedVideo.thumbnail,
      isShort: Boolean(selectedVideo.isShort),
      owner: channel,
      duration: selectedVideo.duration,
    });
    setShareModalVisible(true);
  };

  const handleDeleteVideo = async () => {
    const videoId = selectedVideo?._id;
    setMenuVisible(false);
    
    showAlert(
      'Delete Video',
      'Are you sure you want to delete this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/videos/${videoId}`);
              setVideos(videos.filter(v => v._id !== videoId));
              showAlert('Success', 'Video deleted');
            } catch (err) {
              showAlert('Error', 'Failed to delete video');
            }
          }
        }
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderHorizontalVideoCard = (item: any) => {
    return (
      <TouchableOpacity 
        style={styles.horizontalCard} 
        onPress={() => router.push({ pathname: `/video/${item._id}`, params: { fromChannelId: id } })}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" transition={250} />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration || 0)}</Text>
          </View>
        </View>
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.videoMeta}>
            {formatViews(item.views || 0)} views • {formatTimeAgo(item.createdAt)}
          </Text>
          <TouchableOpacity 
            style={styles.menuDots} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => {
              e.stopPropagation();
              openMenu(item);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderShortGridItem = (item: any) => {
    return (
      <TouchableOpacity 
        style={styles.shortGridItem} 
        onPress={() => router.push({ pathname: '/shorts', params: { initialShortId: item._id, fromChannelId: id } })}
        activeOpacity={0.9}
      >
        <View style={styles.shortGridThumbnailContainer}>
          <Image source={{ uri: item.thumbnail }} style={styles.shortGridThumbnail} contentFit="cover" transition={250} />
          <View style={styles.shortViewsBadge}>
            <Ionicons name="play-outline" size={10} color={Colors.white} />
            <Text style={styles.shortViewsText}>{formatViews(item.views || 0)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.gridMenuDots} 
            onPress={(e) => {
              e.stopPropagation();
              openMenu(item);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={14} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.shortGridTitle} numberOfLines={2}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  const currentUserId = user?._id?.toString() || user?.id?.toString() || '';
  const channelOwnerId = channel?._id?.toString() || (typeof id === 'string' ? id : '');
  const isOwner = Boolean(currentUserId && (currentUserId === channelOwnerId || currentUserId === id));
  const tabItems = [
    { key: 'videos', label: 'Videos' },
    { key: 'shorts', label: 'Shorts' },
    { key: 'posts', label: 'Posts' },
  ] as const;

  const sortOptions = [
    { key: 'latest', label: 'Latest' },
    { key: 'popular', label: 'Popular' },
    { key: 'oldest', label: 'Oldest' },
  ] as const;

  const content = filter === 'posts'
    ? posts.map((item) => ({ ...item, itemType: 'post' }))
    : videos.map((item) => ({ ...item, itemType: 'video' }));

  if (loading && !channel) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  if (error && !channel) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={60} color={Colors.textGray} />
        <Text style={styles.errorTitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadChannel(filter, sort)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      
      <FlatList
        key={filter === 'shorts' ? 'shorts-grid' : 'videos-list'}
        data={content}
        numColumns={filter === 'shorts' ? 3 : 1}
        keyExtractor={(item) => item._id}
        columnWrapperStyle={filter === 'shorts' ? styles.shortsRow : null}
        renderItem={({ item }) => {
          if (item.itemType === 'post') return (
            <PostCard 
              post={item} 
              onDelete={(postId) => setPosts(prev => prev.filter(p => p._id !== postId))} 
            />
          );
          if (filter === 'shorts') return renderShortGridItem(item);
          return renderHorizontalVideoCard(item);
        }}
        ListHeaderComponent={
          <View>
            {/* Banner Section */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              
              {channel?.coverImage ? (
                <Image source={{ uri: channel.coverImage }} style={styles.coverImage} contentFit="cover" transition={250} />
              ) : (
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.coverPlaceholder}
                />
              )}
            </View>

            {/* Profile Section */}
            <View style={styles.profileSection}>
              <TouchableOpacity 
                style={styles.avatarWrapper}
                activeOpacity={0.85}
                onPress={() => {
                  hapticLight();
                  setDpModalVisible(true);
                }}
              >
                <Image source={{ uri: channel?.avatar || FALLBACK_AVATAR }} style={styles.avatar} contentFit="cover" transition={200} />
              </TouchableOpacity>
              
              <View style={styles.identityContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {channel?.channelName || channel?.name || 'Channel'}
                  </Text>
                  {Boolean(channel?.isVerified) && (
                    <VerifiedBadge size={17} style={{ marginLeft: 5 }} />
                  )}
                </View>
                <Text style={styles.handle}>@{channel?.name || 'user'}</Text>
                <View style={styles.connectionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: '/channel-connections',
                        params: {
                          channelId: channel?._id || id,
                          channelName: channel?.channelName || channel?.name || 'Channel',
                          initialTab: 'followers',
                          initialFollowersCount: String(channel?.followersCount ?? 0),
                          initialFollowingCount: String(channel?.followingCount ?? 0),
                        },
                      })
                    }
                  >
                    <Text style={styles.connectionText}>
                      <Text style={styles.connectionCount}>{formatViews(channel?.followersCount || 0)}</Text> followers
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.connectionDot}>•</Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: '/channel-connections',
                        params: {
                          channelId: channel?._id || id,
                          channelName: channel?.channelName || channel?.name || 'Channel',
                          initialTab: 'followings',
                          initialFollowersCount: String(channel?.followersCount ?? 0),
                          initialFollowingCount: String(channel?.followingCount ?? 0),
                        },
                      })
                    }
                  >
                    <Text style={styles.connectionText}>
                      <Text style={styles.connectionCount}>{formatViews(channel?.followingCount || 0)}</Text> following
                    </Text>
                  </TouchableOpacity>
                </View>

                {Boolean(channel?.leaderboardRank && channel.leaderboardRank <= 3) && (
                  <View style={[
                    styles.leaderboardBadge,
                    channel.leaderboardRank === 1 ? styles.goldBadge :
                    channel.leaderboardRank === 2 ? styles.silverBadge : styles.bronzeBadge
                  ]}>
                    <Ionicons 
                      name="trophy" 
                      size={12} 
                      color={
                        channel.leaderboardRank === 1 ? '#D97706' :
                        channel.leaderboardRank === 2 ? '#4B5563' : '#B45309'
                      } 
                    />
                    <Text style={[
                      styles.leaderboardBadgeText,
                      {
                        color:
                          channel.leaderboardRank === 1 ? '#92400E' :
                          channel.leaderboardRank === 2 ? '#374151' : '#78350F'
                      }
                    ]}>
                      {channel.leaderboardRank === 1 ? '#1 Top Creator' :
                       channel.leaderboardRank === 2 ? '#2 Top Creator' : '#3 Top Creator'}
                    </Text>
                  </View>
                )}
                
                {(!!channel?.about || !!channel?.createdAt) && (
                  <TouchableOpacity 
                    activeOpacity={0.7} 
                    style={styles.aboutContainer} 
                    onPress={() => setAboutModalVisible(true)}
                  >
                    {!!channel?.about && (
                      <Text style={styles.aboutPreview} numberOfLines={2}>
                        {channel.about}
                      </Text>
                    )}
                    <Text style={styles.moreAboutText}>
                      more <Ionicons name="chevron-forward" size={10} color={Colors.textGray} />
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.actionRow}>
                {isOwner ? (
                  <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-channel')}>
                    <Ionicons name="pencil-outline" size={17} color={Colors.text} style={{ marginRight: 6 }} />
                    <Text style={styles.editBtnText}>Edit Channel</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.followBtn, channel?.isFollowing && styles.followedBtn]} 
                    onPress={handleFollow}
                  >
                    {channel?.isFollowing ? (
                      <MaterialCommunityIcons 
                        name="account-check" 
                        size={19} 
                        color={Colors.text} 
                        style={{ marginRight: 6 }}
                      />
                    ) : (
                      <Ionicons 
                        name="person-add-outline" 
                        size={18} 
                        color={Colors.white} 
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text style={[styles.followBtnText, channel?.isFollowing && styles.followedBtnText]}>
                      {channel?.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
                {!isOwner && (
                  <TouchableOpacity style={styles.iconActionBtn} onPress={handleChat}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.text} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.iconActionBtn} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Tabs & Filters */}
            <View style={styles.tabsSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                {tabItems.map((item) => {
                  const count = item.key === 'videos'
                    ? (channel?.videosCount ?? 0)
                    : item.key === 'shorts'
                    ? (channel?.shortsCount ?? 0)
                    : (channel?.postsCount ?? 0);
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.tabBtn, filter === item.key && styles.tabBtnActive]}
                      onPress={() => setFilter(item.key)}
                    >
                      <View style={styles.tabContentRow}>
                        <Text style={[styles.tabText, filter === item.key && styles.tabTextActive]}>
                          {item.label}
                        </Text>
                        <View style={[styles.tabBadge, filter === item.key && styles.tabBadgeActive]}>
                          <Text style={[styles.tabBadgeText, filter === item.key && styles.tabBadgeTextActive]}>
                            {formatViews(count)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sortContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {sortOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortBtn, sort === opt.key && styles.sortBtnActive]}
                    onPress={() => setSort(opt.key)}
                  >
                    <Text style={[styles.sortText, sort === opt.key && styles.sortTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="videocam-outline" size={60} color={Colors.border} />
            <Text style={styles.empty}>No {filter} found yet</Text>
          </View>
        ) : null}
        refreshing={loading}
        onRefresh={() => loadChannel(filter, sort)}
        contentContainerStyle={[
          styles.listContent,
          filter === 'shorts' ? styles.shortsListPadding : null
        ]}
      />

      {/* Action Menu Modal for Videos/Shorts */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContent}>
            {isOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={24} color={Colors.text} />
                <Text style={styles.menuText}>Edit Video</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handleShareVideo}>
              <Ionicons name="share-social-outline" size={24} color={Colors.text} />
              <Text style={styles.menuText}>Share Video</Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity style={[styles.menuItem, styles.deleteItem]} onPress={handleDeleteVideo}>
                <Ionicons name="trash-outline" size={24} color={Colors.primary} />
                <Text style={[styles.menuText, { color: Colors.primary }]}>Delete Video</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelItem} onPress={() => setMenuVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ShareModal
        visible={shareModalVisible}
        onClose={() => {
          setShareModalVisible(false);
          setShareItem(null);
        }}
        item={shareItem}
      />

      {/* Channel Details / About Modal */}
      <Modal
        visible={aboutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <Pressable 
          style={styles.aboutModalOverlay} 
          onPress={() => setAboutModalVisible(false)}
        >
          <Pressable style={styles.aboutModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.aboutModalHeader}>
              <Text style={styles.aboutModalTitle}>About this channel</Text>
              <TouchableOpacity onPress={() => setAboutModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.aboutModalScroll}>
              {/* Description Section */}
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Description</Text>
                <Text style={styles.aboutFullText}>
                  {channel?.about ? channel.about : 'No description provided.'}
                </Text>
              </View>

              {/* Social Media Links Section */}
              {Array.isArray(channel?.socialLinks) && channel.socialLinks.length > 0 && (
                <View style={styles.aboutSection}>
                  <Text style={styles.aboutSectionTitle}>Links</Text>
                  {channel.socialLinks.map((link: any, idx: number) => {
                    const platform = (link.platform || 'website').toLowerCase();
                    let iconName = 'globe-outline';
                    let iconColor = '#6366F1';
                    let defaultLabel = 'Website';

                    if (platform.includes('instagram')) {
                      iconName = 'logo-instagram';
                      iconColor = '#E1306C';
                      defaultLabel = 'Instagram';
                    } else if (platform.includes('facebook')) {
                      iconName = 'logo-facebook';
                      iconColor = '#1877F2';
                      defaultLabel = 'Facebook';
                    } else if (platform.includes('youtube')) {
                      iconName = 'logo-youtube';
                      iconColor = '#FF0000';
                      defaultLabel = 'YouTube';
                    } else if (platform.includes('twitter')) {
                      iconName = 'logo-twitter';
                      iconColor = '#1DA1F2';
                      defaultLabel = 'X / Twitter';
                    }

                    const displayLabel = link.label?.trim() || defaultLabel;
                    const url = link.url?.trim() || '';

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.socialLinkRow}
                        activeOpacity={0.7}
                        onPress={async () => {
                          if (!url) return;
                          hapticSelection();
                          let targetUrl = url;
                          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                            targetUrl = `https://${targetUrl}`;
                          }
                          try {
                            await Linking.openURL(targetUrl);
                          } catch {
                            showAlert('Link Error', 'Unable to open ' + targetUrl);
                          }
                        }}
                      >
                        <View style={[styles.socialIconCircle, { backgroundColor: `${iconColor}15` }]}>
                          <Ionicons name={iconName as any} size={18} color={iconColor} />
                        </View>
                        <View style={styles.socialLinkTextContainer}>
                          <Text style={styles.socialLinkLabel} numberOfLines={1}>{displayLabel}</Text>
                          <Text style={styles.socialLinkUrl} numberOfLines={1}>{url}</Text>
                        </View>
                        <Ionicons name="open-outline" size={16} color={Colors.textGray} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Channel Details Section */}
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Channel details</Text>
                
                {/* Joined Date */}
                {!!channel?.createdAt && (
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={20} color={Colors.textGray} style={styles.detailIcon} />
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Joined</Text>
                      <Text style={styles.detailValue}>{formatJoinedDate(channel.createdAt)}</Text>
                    </View>
                  </View>
                )}

                {/* Total Views across all videos */}
                <View style={styles.detailRow}>
                  <Ionicons name="eye-outline" size={20} color={Colors.textGray} style={styles.detailIcon} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Views</Text>
                    <Text style={styles.detailValue}>
                      {(channel?.totalViews || 0).toLocaleString()} views
                    </Text>
                  </View>
                </View>

                {/* Verified Badge & Date (date owner-only) */}
                {Boolean(channel?.isVerified) && (
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#2196F3" style={styles.detailIcon} />
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Verified</Text>
                      <Text style={styles.detailValue}>
                        {isOwner && channel?.verifiedAt
                          ? `Verified on ${formatJoinedDate(channel.verifiedAt)}`
                          : 'Verified Channel'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Name Changes (Owner-only) */}
                {isOwner && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={20} color={Colors.textGray} style={styles.detailIcon} />
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Name changes</Text>
                      <View style={styles.nameHistoryRow}>
                        <Text style={styles.detailValue}>
                          {channel?.nameHistory?.length || 0} {(channel?.nameHistory?.length || 0) === 1 ? 'change' : 'changes'}
                        </Text>
                        {Boolean(channel?.nameHistory && channel.nameHistory.length > 0) && (
                          <TouchableOpacity
                            onPress={() => {
                              hapticLight();
                              setNameHistoryModalVisible(true);
                            }}
                            style={styles.nameHistoryLink}
                          >
                            <Text style={styles.nameHistoryLinkText}>View history</Text>
                            <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Name Change History Modal (Owner Only) */}
      <Modal
        visible={nameHistoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNameHistoryModalVisible(false)}
      >
        <Pressable
          style={styles.aboutModalOverlay}
          onPress={() => setNameHistoryModalVisible(false)}
        >
          <Pressable style={styles.historyModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.aboutModalHeader}>
              <View>
                <Text style={styles.aboutModalTitle}>Name change history</Text>
                <Text style={styles.historyModalSub}>All past username & channel name modifications</Text>
              </View>
              <TouchableOpacity onPress={() => setNameHistoryModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
              {(!channel?.nameHistory || channel.nameHistory.length === 0) ? (
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="checkmark-done-circle-outline" size={40} color={Colors.textGray} />
                  <Text style={styles.emptyHistoryText}>No past name changes recorded.</Text>
                </View>
              ) : (
                channel.nameHistory.map((item: any, idx: number) => (
                  <View key={idx} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyBadge}>
                        <Text style={styles.historyBadgeText}>
                          {item.type === 'name' ? 'Username' : 'Channel Name'}
                        </Text>
                      </View>
                      <Text style={styles.historyDate}>
                        {item.changedAt ? formatJoinedDate(item.changedAt) : 'Earlier'}
                      </Text>
                    </View>
                    <View style={styles.historyNamesRow}>
                      <Text style={styles.historyOldName}>{item.previousName || 'Initial'}</Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.textGray} style={{ marginHorizontal: 8 }} />
                      <Text style={styles.historyNewName}>{item.newName}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile Picture (DP) Large Fullscreen Viewer Modal */}
      <Modal
        visible={dpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDpModalVisible(false)}
      >
        <Pressable
          style={styles.dpModalOverlay}
          onPress={() => setDpModalVisible(false)}
        >
          <View style={styles.dpModalContent}>
            <TouchableOpacity 
              style={styles.dpCloseBtn}
              onPress={() => setDpModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.dpImageWrapper}>
              <Image
                source={{ uri: channel?.avatar || FALLBACK_AVATAR }}
                style={styles.dpLargeImage}
                contentFit="cover"
                transition={200}
              />
            </View>

            <View style={styles.dpInfoContainer}>
              <Text style={styles.dpName} numberOfLines={1}>
                {channel?.channelName || channel?.name || 'Channel'}
              </Text>
              <Text style={styles.dpHandle}>@{channel?.name || 'user'}</Text>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // Header / Banner
  header: { backgroundColor: Colors.white, position: 'relative' },
  backBtn: { 
    position: 'absolute', 
    left: 16, 
    top: 40,
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', 
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20 
  },
  coverImage: {
    width: '100%',
    aspectRatio: 20 / 9, // Restored ratio
    backgroundColor: Colors.border,
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 20 / 9,
    backgroundColor: '#E5E7EB',
  },
  
  // Profile Info
  profileSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  avatarWrapper: {
    marginTop: -40, // Perfect overlap
    marginBottom: 9,
    alignSelf: 'flex-start',
    padding: 3,
    backgroundColor: Colors.white,
    borderRadius: 45,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: Colors.border 
  },
  identityContainer: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  name: { 
    fontSize: 20,
    fontWeight: '800', 
    color: Colors.text,
    letterSpacing: -0.5,
  },
  handle: { 
    fontSize: 12,
    color: Colors.text, 
    marginTop: 4,
    fontWeight: '600',
  },
  subscribers: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 4,
    fontWeight: '500',
  },
  aboutContainer: {
    marginTop: 8,
  },
  aboutPreview: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  moreAboutText: {
    fontSize: 13,
    color: Colors.textGray,
    fontWeight: '700',
    marginTop: 4,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  followedBtn: {
    backgroundColor: '#F2F3F5',
    shadowOpacity: 0,
    elevation: 0,
  },
  followBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  followedBtnText: {
    color: Colors.text,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  iconActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Tabs
  tabsSection: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
    marginTop: -10,
  },
  tabsScroll: {
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 13,
    paddingHorizontal: 10,
    marginRight: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textGray,
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Sort Filters
  sortContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sortBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F2F3F5',
    marginRight: 10,
  },
  sortBtnActive: {
    backgroundColor: Colors.primary,
  },
  sortText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sortTextActive: {
    color: Colors.white,
  },

  // Horizontal Card (Videos)
  horizontalCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  thumbnailContainer: {
    width: 160,
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 10,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  videoMeta: {
    fontSize: 12,
    color: Colors.textGray,
  },
  menuDots: {
    position: 'absolute',
    top: -4,
    right: -10,
    padding: 10,
  },

  // Short Grid
  shortsRow: {
    paddingHorizontal: 2,
  },
  shortsListPadding: {
    paddingBottom: 20,
  },
  shortGridItem: {
    flex: 1 / 3,
    aspectRatio: 9 / 16,
    margin: 2,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  shortGridThumbnailContainer: {
    flex: 1,
  },
  shortGridThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  shortViewsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  shortViewsText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  shortGridTitle: {
    position: 'absolute',
    bottom: 25,
    left: 8,
    right: 8,
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Utils
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  empty: { 
    textAlign: 'center', 
    color: Colors.textGray, 
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    color: Colors.text,
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
  cancelItem: {
    marginTop: 10,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
  gridMenuDots: {
    position: 'absolute',
    top: 4,
    right: 0,
    padding: 6,
  },
  leaderboardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 5,
    marginBottom: 2,
    gap: 4,
  },
  goldBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  silverBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  bronzeBadge: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  leaderboardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
    gap: 8,
  },
  connectionText: {
    fontSize: 13,
    color: Colors.textGray,
  },
  connectionCount: {
    fontWeight: '700',
    color: Colors.text,
  },
  connectionDot: {
    color: Colors.border,
    fontSize: 14,
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: Colors.primary + '18',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textGray,
  },
  tabBadgeTextActive: {
    color: Colors.primary,
  },

  // About / Channel Details Modal
  aboutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  aboutModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  aboutModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  aboutModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  aboutModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  aboutSection: {
    marginBottom: 20,
  },
  aboutSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  aboutFullText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  detailIcon: {
    width: 28,
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textGray,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  avatarZoomBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  socialLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  socialIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLinkTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  socialLinkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  socialLinkUrl: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  nameHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  nameHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  nameHistoryLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 2,
  },
  historyModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    width: '100%',
    paddingBottom: 24,
  },
  historyModalSub: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  historyScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  emptyHistoryBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 10,
    fontWeight: '500',
  },
  historyCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textGray,
  },
  historyNamesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyOldName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textGray,
    textDecorationLine: 'line-through',
  },
  historyNewName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  dpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dpModalContent: {
    alignItems: 'center',
    width: '100%',
  },
  dpCloseBtn: {
    position: 'absolute',
    top: -60,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dpImageWrapper: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: (width * 0.85) / 2,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dpLargeImage: {
    width: '100%',
    height: '100%',
  },
  dpInfoContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  dpName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  dpHandle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
});
