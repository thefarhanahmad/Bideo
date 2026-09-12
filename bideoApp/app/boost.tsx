import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from '../components/AppAlert';
import { formatViews, formatDuration } from '../utils/formatDate';
import { loadAndShowRewardedAd } from '../components/AppAds';

interface BoostTier {
  coins: number;
  hours: number;
  label: string;
  discount?: string;
}

export default function BoostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  // Ad Watching States
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0); // in seconds
  const [rewardModal, setRewardModal] = useState<{ visible: boolean; coins: number }>({
    visible: false,
    coins: 0,
  });

  // Boost Action & Modal States
  const [rateChartModal, setRateChartModal] = useState(false);
  const [boostModalVisible, setBoostModalVisible] = useState(false);
  const [eligibleVideos, setEligibleVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<number>(1); // default 1 hour (100 coins)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [submittingBoost, setSubmittingBoost] = useState(false);

  const cooldownIntervalRef = useRef<any>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/boost/status');
      if (res.data.success && res.data.data) {
        setData(res.data.data);
        const cd = Number(res.data.data.dailyAds?.cooldownSeconds || 0);
        setCooldownLeft(cd);
      }
    } catch (err: any) {
      console.log('Failed to fetch boost status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Live countdown timer for cooldown
  useEffect(() => {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);

    if (cooldownLeft > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownLeft((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownIntervalRef.current);
            fetchStatus(); // refresh once cooldown reaches zero
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, [cooldownLeft, fetchStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWatchAd = () => {
    if (!data?.dailyAds?.canWatch) {
      if (cooldownLeft > 0) {
        showAlert('Cooldown Active', `Please wait ${formatTimer(cooldownLeft)} before watching another ad.`);
      } else if (data?.dailyAds?.remaining <= 0) {
        showAlert('Daily Limit Reached', 'You have watched all 16 ads for today. Limit resets tomorrow!');
      }
      return;
    }

    setIsAdLoading(true);

    let adRewardEarned = false;

    const cancelAd = loadAndShowRewardedAd({
      onLoaded: () => {
        setIsAdLoading(false);
      },
      onRewardEarned: async () => {
        adRewardEarned = true;
        try {
          const res = await api.post('/boost/claim-ad-reward');
          if (res.data.success && res.data.data) {
            setRewardModal({
              visible: true,
              coins: res.data.data.coinsEarned,
            });
            fetchStatus();
          }
        } catch (claimErr: any) {
          showAlert('Claim Error', claimErr?.response?.data?.message || 'Failed to claim ad reward coins.');
        }
      },
      onDismiss: () => {
        setIsAdLoading(false);
        if (!adRewardEarned) {
          showAlert('Ad Incomplete', 'You must watch the full rewarded video ad to receive coins.');
        }
      },
      onError: (err: any) => {
        setIsAdLoading(false);
        showAlert('Ad Unavailable', 'No rewarded ad available right now. Please try again in a few moments.');
      },
    });
  };

  const openBoostModal = async () => {
    if ((data?.coins || 0) < 100) {
      showAlert('Coins Needed', 'You need at least 100 coins to boost a video. Watch ads to collect more coins!');
      return;
    }

    setBoostModalVisible(true);
    setLoadingVideos(true);
    try {
      const res = await api.get('/boost/my-videos');
      if (res.data.success && Array.isArray(res.data.data)) {
        setEligibleVideos(res.data.data);
      }
    } catch (err: any) {
      console.log('Failed to fetch videos for boost:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleSelectVideoForBoost = (video: any) => {
    if (video.isBoosted) {
      showAlert('Already Boosted', 'This video is already currently pinned or in the boost queue.');
      return;
    }
    setSelectedVideo(video);
    setConfirmModalVisible(true);
  };

  const handleConfirmBoost = async () => {
    if (!selectedVideo || !selectedTier) return;
    const tier = data?.boostTiers?.find((t: BoostTier) => t.hours === selectedTier);
    if (!tier) return;

    if ((data?.coins || 0) < tier.coins) {
      showAlert('Insufficient Coins', `You need ${tier.coins} coins for this tier, but you have ${data?.coins || 0}.`);
      return;
    }

    setSubmittingBoost(true);
    try {
      const res = await api.post('/boost/create', {
        videoId: selectedVideo._id,
        durationHours: selectedTier,
      });

      if (res.data.success) {
        setConfirmModalVisible(false);
        setBoostModalVisible(false);
        setSelectedVideo(null);
        showAlert('Video Boosted! 🚀', res.data.message || 'Your video has been added to the boost queue.');
        fetchStatus();
      }
    } catch (err: any) {
      showAlert('Boost Error', err?.response?.data?.message || 'Failed to create video boost.');
    } finally {
      setSubmittingBoost(false);
    }
  };

  const userCoins = Number(data?.coins || 0);
  const dailyAds = data?.dailyAds || { watched: 0, total: 16, remaining: 16, canWatch: false };
  const canBoostNow = userCoins >= 100;
  const activeBoost = data?.activeBoost;
  const queuedBoosts = data?.queuedBoosts || [];

  const filteredVideos = eligibleVideos.filter((v) =>
    (v.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* App Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Channel Boost & Coins</Text>
          <Text style={styles.headerSub}>Get Pinned on the Home Feed</Text>
        </View>
        <TouchableOpacity
          style={styles.rateChartBtn}
          onPress={() => setRateChartModal(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="stats-chart" size={18} color="#8E24AA" />
          <Text style={styles.rateChartBtnText}>Rates</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading boost dashboard...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
          {/* Top Explanatory Info Card */}
          <View style={styles.infoBanner}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="information-circle" size={18} color="#8E24AA" />
            </View>
            <Text style={styles.infoText}>
              Watch rewarded ads to earn coins. Use 100+ coins to pin your video directly to the top of the Home Feed and gain massive real viewers!
            </Text>
          </View>

          {/* Top Action Bar: Boost Video Button & Rate Chart Summary */}
          <View style={styles.topActionBar}>
            <TouchableOpacity
              style={[styles.boostHeaderBtn, !canBoostNow && styles.boostHeaderBtnDisabled]}
              onPress={openBoostModal}
              disabled={!canBoostNow}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={canBoostNow ? ['#8E24AA', '#D81B60'] : ['#BDBDBD', '#9E9E9E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.boostGradient}
              >
                <Ionicons name="rocket" size={18} color={Colors.white} />
                <Text style={styles.boostBtnLabel}>
                  {canBoostNow ? 'Boost Video Now' : `Need ${100 - userCoins} More Coins`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.miniRatesBtn} onPress={() => setRateChartModal(true)}>
              <Text style={styles.miniRatesText}>100🪙 = 1 hr</Text>
              <Ionicons name="chevron-forward" size={14} color="#8E24AA" />
            </TouchableOpacity>
          </View>

          {/* Two Main KPI Cards */}
          <View style={styles.kpiRow}>
            {/* KPI Card 1: Coins Balance */}
            <View style={[styles.kpiCard, styles.coinsCard]}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>Your Coins</Text>
                <View style={styles.coinBadgeIcon}>
                  <Text style={{ fontSize: 14 }}>🪙</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{userCoins.toLocaleString()}</Text>
              <View style={[styles.statusPill, canBoostNow ? styles.statusPillSuccess : styles.statusPillMuted]}>
                <Text style={[styles.statusPillText, canBoostNow ? styles.statusPillTextSuccess : styles.statusPillTextMuted]}>
                  {canBoostNow ? '✓ Boost Unlocked' : `${userCoins}/100 collected`}
                </Text>
              </View>
            </View>

            {/* KPI Card 2: Daily Ads Watched */}
            <View style={[styles.kpiCard, styles.adsCard]}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>Daily Ads</Text>
                <Ionicons name="play-circle" size={18} color="#FF7A00" />
              </View>
              <Text style={styles.kpiValue}>
                {dailyAds.watched} <Text style={styles.kpiTotalText}>/ {dailyAds.total}</Text>
              </Text>
              <View
                style={[
                  styles.statusPill,
                  cooldownLeft > 0
                    ? styles.statusPillWarning
                    : dailyAds.remaining > 0
                    ? styles.statusPillSuccess
                    : styles.statusPillMuted,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    cooldownLeft > 0
                      ? styles.statusPillTextWarning
                      : dailyAds.remaining > 0
                      ? styles.statusPillTextSuccess
                      : styles.statusPillTextMuted,
                  ]}
                >
                  {cooldownLeft > 0
                    ? `Wait ${formatTimer(cooldownLeft)}`
                    : dailyAds.remaining > 0
                    ? 'Ad Ready'
                    : 'Done for Today'}
                </Text>
              </View>
            </View>
          </View>

          {/* Watch Ad Action Section */}
          <View style={styles.adSectionCard}>
            <View style={styles.adSectionHeader}>
              <View style={styles.adRewardIconBox}>
                <Ionicons name="gift" size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.adSectionTitle}>Earn Free Coins</Text>
                <Text style={styles.adSectionDesc}>
                  Watch rewarded video ad to get <Text style={{ fontWeight: '800', color: '#D81B60' }}>2 to 10 coins</Text> per ad.
                </Text>
              </View>
            </View>

            {/* Cooldown / Limit Banner */}
            {cooldownLeft > 0 && (
              <View style={styles.cooldownBanner}>
                <Ionicons name="timer-outline" size={18} color="#E65100" />
                <Text style={styles.cooldownBannerText}>
                  Cooldown active! Next ad available in <Text style={{ fontWeight: '800' }}>{formatTimer(cooldownLeft)}</Text>
                </Text>
              </View>
            )}

            {dailyAds.remaining <= 0 && (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                <Text style={styles.completedBannerText}>All 16 ads watched today! Resets tomorrow.</Text>
              </View>
            )}

            {/* Main Action Button */}
            <TouchableOpacity
              style={[styles.watchAdBtn, (!dailyAds.canWatch || isAdLoading) && styles.watchAdBtnDisabled]}
              onPress={handleWatchAd}
              disabled={!dailyAds.canWatch || isAdLoading}
              activeOpacity={0.85}
            >
              {isAdLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.watchAdBtnText}>Loading Sponsor Ad...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={dailyAds.canWatch ? 'play' : 'lock-closed'} size={18} color="#FFF" />
                  <Text style={styles.watchAdBtnText}>
                    {cooldownLeft > 0
                      ? `Watch Ad in ${formatTimer(cooldownLeft)}`
                      : dailyAds.remaining <= 0
                      ? 'Daily Limit Reached (16/16)'
                      : 'Watch Ad (+2-10 Coins)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.sessionDotsRow}>
              <Text style={styles.sessionDotsLabel}>Batch session:</Text>
              <View style={[styles.sessionDot, dailyAds.sessionCount >= 1 && styles.sessionDotFilled]} />
              <Text style={{ fontSize: 10, color: '#888' }}>Ad 1</Text>
              <View style={[styles.sessionDot, dailyAds.sessionCount >= 2 && styles.sessionDotFilled]} />
              <Text style={{ fontSize: 10, color: '#888' }}>Ad 2</Text>
              <Text style={styles.sessionNote}>• 10m pause after 2 ads</Text>
            </View>
          </View>

          {/* Active Live Pinned Video (if any) */}
          {activeBoost && (
            <View style={styles.activeBoostCard}>
              <View style={styles.activeBadgeRow}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE ON HOME FEED TOP</Text>
                </View>
                <Text style={styles.remainingTimeText}>
                  {formatTimer(activeBoost.remainingSeconds)} left
                </Text>
              </View>

              <View style={styles.boostVideoRow}>
                {activeBoost.video?.thumbnail && (
                  <Image source={{ uri: activeBoost.video.thumbnail }} style={styles.boostThumb} contentFit="cover" />
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.boostVidTitle} numberOfLines={2}>
                    {activeBoost.video?.title || 'Boosted Video'}
                  </Text>
                  <Text style={styles.boostVidMeta}>
                    {formatViews(activeBoost.video?.views || 0)} views • {activeBoost.durationHours}h Tier
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBarWrap}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.max(
                        5,
                        Math.min(100, (activeBoost.remainingSeconds / (activeBoost.durationHours * 3600)) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Queued Boosts (if any) */}
          {queuedBoosts.length > 0 && (
            <View style={styles.queuedSection}>
              <Text style={styles.sectionTitle}>Your Queued Highlights ({queuedBoosts.length})</Text>
              {queuedBoosts.map((qb: any) => (
                <View key={qb._id} style={styles.queuedCard}>
                  <View style={styles.queuedBadgeRow}>
                    <View style={styles.queuedBadge}>
                      <Ionicons name="time-outline" size={12} color="#5E35B1" />
                      <Text style={styles.queuedBadgeText}>Queue Position #{qb.queuePosition}</Text>
                    </View>
                    <Text style={styles.queuedEstText}>
                      Starts {new Date(qb.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={styles.boostVideoRow}>
                    {qb.video?.thumbnail && (
                      <Image source={{ uri: qb.video.thumbnail }} style={styles.boostThumb} contentFit="cover" />
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.boostVidTitle} numberOfLines={1}>
                        {qb.video?.title}
                      </Text>
                      <Text style={styles.boostVidMeta}>{qb.durationHours} Hours Duration</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Global Queue Info */}
          <View style={styles.globalQueueBox}>
            <Ionicons name="people-outline" size={16} color="#8E24AA" />
            <Text style={styles.globalQueueText}>
              Total videos in boost queue: <Text style={{ fontWeight: '800' }}>{data?.globalQueue?.totalQueued || 0}</Text>
              {data?.globalQueue?.currentActive
                ? ` • Current active: "${data.globalQueue.currentActive.videoTitle}"`
                : ' • Slot open! Next boosted video goes live immediately!'}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Rate Chart Modal */}
      <Modal visible={rateChartModal} transparent animationType="fade" onRequestClose={() => setRateChartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.rateChartBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coins vs Duration Rates</Text>
              <TouchableOpacity onPress={() => setRateChartModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.rateChartSub}>
              Earn coins by watching ads and use them to highlight your video at the top of the Home Feed:
            </Text>

            <View style={styles.tiersList}>
              <View style={styles.tierRow}>
                <View style={styles.tierLeft}>
                  <Text style={styles.tierCoin}>🪙 100 Coins</Text>
                </View>
                <View style={styles.tierArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#888" />
                </View>
                <View style={styles.tierRight}>
                  <Text style={styles.tierHours}>1 Hour Pin</Text>
                </View>
              </View>

              <View style={styles.tierRow}>
                <View style={styles.tierLeft}>
                  <Text style={styles.tierCoin}>🪙 250 Coins</Text>
                </View>
                <View style={styles.tierArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#888" />
                </View>
                <View style={styles.tierRight}>
                  <Text style={styles.tierHours}>3 Hours Pin</Text>
                  <Text style={styles.discountBadge}>Save 50 coins</Text>
                </View>
              </View>

              <View style={styles.tierRow}>
                <View style={styles.tierLeft}>
                  <Text style={styles.tierCoin}>🪙 500 Coins</Text>
                </View>
                <View style={styles.tierArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#888" />
                </View>
                <View style={styles.tierRight}>
                  <Text style={styles.tierHours}>6 Hours Pin</Text>
                  <Text style={styles.discountBadge}>Save 100 coins</Text>
                </View>
              </View>

              <View style={[styles.tierRow, { backgroundColor: '#F3E5F5', borderColor: '#8E24AA' }]}>
                <View style={styles.tierLeft}>
                  <Text style={[styles.tierCoin, { color: '#8E24AA' }]}>🪙 1,000 Coins</Text>
                </View>
                <View style={styles.tierArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#8E24AA" />
                </View>
                <View style={styles.tierRight}>
                  <Text style={[styles.tierHours, { color: '#8E24AA' }]}>24 Hours Pin</Text>
                  <Text style={[styles.discountBadge, { backgroundColor: '#8E24AA', color: '#FFF' }]}>
                    Best Value!
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.gotItBtn} onPress={() => setRateChartModal(false)}>
              <Text style={styles.gotItText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reward Earned Celebration Modal */}
      <Modal visible={rewardModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.celebrationBox}>
            <Text style={{ fontSize: 50, textAlign: 'center' }}>🎉</Text>
            <Text style={styles.celebrationTitle}>Coins Earned!</Text>
            <Text style={styles.celebrationCoins}>+{rewardModal.coins} Coins</Text>
            <Text style={styles.celebrationSub}>
              Great job! Your coins have been added to your balance. Use them to boost your video to the top of the Home Feed!
            </Text>
            <TouchableOpacity
              style={styles.claimDoneBtn}
              onPress={() => setRewardModal({ visible: false, coins: 0 })}
            >
              <Text style={styles.claimDoneBtnText}>Collect & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select Video Modal for Boost */}
      <Modal visible={boostModalVisible} animationType="slide" onRequestClose={() => setBoostModalVisible(false)}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setBoostModalVisible(false)} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Video to Boost</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your videos..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          {loadingVideos ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {filteredVideos.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Ionicons name="videocam-off-outline" size={48} color="#AAA" />
                  <Text style={{ color: '#666', marginTop: 12, fontSize: 15 }}>No eligible videos found.</Text>
                </View>
              ) : (
                filteredVideos.map((vid) => (
                  <TouchableOpacity
                    key={vid._id}
                    style={[styles.videoSelectCard, vid.isBoosted && styles.videoSelectCardDisabled]}
                    onPress={() => handleSelectVideoForBoost(vid)}
                    disabled={vid.isBoosted}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: vid.thumbnail }} style={styles.videoSelectThumb} contentFit="cover" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.videoSelectTitle} numberOfLines={2}>
                        {vid.title}
                      </Text>
                      <Text style={styles.videoSelectMeta}>
                        {formatViews(vid.views || 0)} views • {formatDuration(vid.duration || 0)}
                      </Text>
                      {vid.isBoosted && (
                        <View style={styles.alreadyBoostedBadge}>
                          <Text style={styles.alreadyBoostedText}>Already in Highlight Queue</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={vid.isBoosted ? 'lock-closed' : 'chevron-forward'}
                      size={20}
                      color={vid.isBoosted ? '#AAA' : Colors.primary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Confirmation & Tier Selection Modal */}
      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Duration & Confirm</Text>
              <TouchableOpacity onPress={() => setConfirmModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedVideo && (
              <View style={styles.confirmVidPreview}>
                <Image source={{ uri: selectedVideo.thumbnail }} style={styles.confirmThumb} contentFit="cover" />
                <Text style={styles.confirmVidTitle} numberOfLines={1}>
                  {selectedVideo.title}
                </Text>
              </View>
            )}

            <Text style={styles.selectTierLabel}>Select Pinning Duration Tier:</Text>
            <View style={styles.tierSelector}>
              {[
                { hours: 1, coins: 100 },
                { hours: 3, coins: 250 },
                { hours: 6, coins: 500 },
                { hours: 24, coins: 1000 },
              ].map((t) => {
                const selected = selectedTier === t.hours;
                const canAfford = userCoins >= t.coins;
                return (
                  <TouchableOpacity
                    key={t.hours}
                    style={[
                      styles.tierOption,
                      selected && styles.tierOptionSelected,
                      !canAfford && styles.tierOptionDisabled,
                    ]}
                    onPress={() => setSelectedTier(t.hours)}
                    disabled={!canAfford}
                  >
                    <Text style={[styles.tierOptionHours, selected && styles.tierOptionTextSelected]}>
                      {t.hours} hr{t.hours > 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.tierOptionCoins, selected && styles.tierOptionTextSelected]}>
                      🪙 {t.coins}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.queueNoteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={styles.queueNoteText}>
                {data?.globalQueue?.totalQueued === 0 && !data?.globalQueue?.currentActive
                  ? 'Your video will be pinned at the top of the Home Feed immediately!'
                  : 'A video is currently active. Your video will be queued and pinned automatically when its turn arrives.'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmFinalBtn, submittingBoost && styles.watchAdBtnDisabled]}
              onPress={handleConfirmBoost}
              disabled={submittingBoost}
            >
              {submittingBoost ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.confirmFinalBtnText}>
                  Confirm Pin (🪙 {selectedTier === 1 ? 100 : selectedTier === 3 ? 250 : selectedTier === 6 ? 500 : 1000} Coins)
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: { padding: 4 },
  headerTitleWrap: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 11, color: '#888', fontWeight: '500', marginTop: 1 },
  rateChartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  rateChartBtnText: { fontSize: 12, fontWeight: '700', color: '#8E24AA' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  scrollContent: { padding: 16 },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE7F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  infoIconWrap: { width: 22, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 12, color: '#4A148C', lineHeight: 17, fontWeight: '500' },

  // Top action bar
  topActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  boostHeaderBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8E24AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  boostHeaderBtnDisabled: { opacity: 0.65, shadowOpacity: 0, elevation: 0 },
  boostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  boostBtnLabel: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  miniRatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    gap: 2,
  },
  miniRatesText: { fontSize: 12, fontWeight: '700', color: '#8E24AA' },

  // KPI row
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  coinsCard: { borderLeftWidth: 4, borderLeftColor: '#8E24AA' },
  adsCard: { borderLeftWidth: 4, borderLeftColor: '#FF7A00' },
  kpiTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: '#777' },
  coinBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 24, fontWeight: '800', color: Colors.text, marginTop: 4 },
  kpiTotalText: { fontSize: 14, fontWeight: '600', color: '#888' },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  statusPillSuccess: { backgroundColor: '#E8F5E9' },
  statusPillWarning: { backgroundColor: '#FFF3E0' },
  statusPillMuted: { backgroundColor: '#F5F5F5' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  statusPillTextSuccess: { color: '#2E7D32' },
  statusPillTextWarning: { color: '#E65100' },
  statusPillTextMuted: { color: '#777' },

  // Ad section card
  adSectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  adSectionHeader: { flexDirection: 'row', alignItems: 'center' },
  adRewardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D81B60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adSectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  adSectionDesc: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 17 },
  cooldownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  cooldownBannerText: { fontSize: 12, color: '#E65100', flex: 1 },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  completedBannerText: { fontSize: 12, color: '#2E7D32', flex: 1, fontWeight: '600' },
  watchAdBtn: {
    backgroundColor: '#D81B60',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  watchAdBtnDisabled: { backgroundColor: '#CCC', opacity: 0.8 },
  watchAdBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  sessionDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  sessionDotsLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0E0E0' },
  sessionDotFilled: { backgroundColor: '#D81B60' },
  sessionNote: { fontSize: 11, color: '#888', marginLeft: 4 },

  // Active boost card
  activeBoostCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  activeBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 99, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E91E63' },
  liveBadgeText: { color: '#FF4081', fontSize: 10, fontWeight: '800' },
  remainingTimeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  boostVideoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  boostThumb: { width: 70, height: 45, borderRadius: 8, backgroundColor: '#333' },
  boostVidTitle: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  boostVidMeta: { fontSize: 11, color: '#AAA', marginTop: 2 },
  progressBarWrap: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#E91E63', borderRadius: 2 },

  // Queued section
  queuedSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  queuedCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 10,
  },
  queuedBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  queuedBadgeText: { fontSize: 11, fontWeight: '700', color: '#5E35B1' },
  queuedEstText: { fontSize: 11, color: '#888', fontWeight: '500' },

  // Global queue info
  globalQueueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  globalQueueText: { fontSize: 11, color: '#6A1B9A', flex: 1, lineHeight: 16 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  rateChartBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  rateChartSub: { fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 18 },
  tiersList: { gap: 10, marginBottom: 16 },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  tierLeft: { width: 100 },
  tierCoin: { fontSize: 13, fontWeight: '800', color: Colors.text },
  tierArrow: { paddingHorizontal: 6 },
  tierRight: { flex: 1, alignItems: 'flex-end' },
  tierHours: { fontSize: 13, fontWeight: '700', color: Colors.text },
  discountBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  gotItBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  gotItText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  // Celebration
  celebrationBox: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  celebrationTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 10 },
  celebrationCoins: { fontSize: 32, fontWeight: '900', color: '#D81B60', marginVertical: 6 },
  celebrationSub: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  claimDoneBtn: {
    backgroundColor: '#D81B60',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  claimDoneBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },

  // Video Select
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  videoSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  videoSelectCardDisabled: { opacity: 0.5 },
  videoSelectThumb: { width: 80, height: 48, borderRadius: 6, backgroundColor: '#E0E0E0' },
  videoSelectTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  videoSelectMeta: { fontSize: 11, color: '#888', marginTop: 3 },
  alreadyBoostedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  alreadyBoostedText: { fontSize: 10, color: '#E65100', fontWeight: '700' },

  // Confirm box
  confirmBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
  },
  confirmVidPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 10,
  },
  confirmThumb: { width: 60, height: 36, borderRadius: 6 },
  confirmVidTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.text },
  selectTierLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  tierSelector: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tierOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  tierOptionSelected: { borderColor: '#8E24AA', backgroundColor: '#F3E5F5' },
  tierOptionDisabled: { opacity: 0.4 },
  tierOptionHours: { fontSize: 13, fontWeight: '700', color: Colors.text },
  tierOptionCoins: { fontSize: 11, color: '#666', marginTop: 2, fontWeight: '600' },
  tierOptionTextSelected: { color: '#8E24AA' },
  queueNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  queueNoteText: { flex: 1, fontSize: 11, color: '#666', lineHeight: 15 },
  confirmFinalBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmFinalBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});
