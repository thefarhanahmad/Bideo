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
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Colors from '../constants/Colors';
import api from '../services/api';
import { showAlert } from '../components/AppAlert';
import { formatViews, formatDuration } from '../utils/formatDate';
import { loadAndShowRewardedAd, AppAdBanner } from '../components/AppAds';
import { RootState } from '../redux/store';
import { updateUser } from '../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VerifiedBadge from '../components/VerifiedBadge';

interface BoostTier {
  coins: number;
  hours: number;
  label: string;
  discount?: string;
}

export default function BoostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);

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

  // Verified Badge Modal States
  const [verifiedModalVisible, setVerifiedModalVisible] = useState(false);
  const [confirmBadgeModalVisible, setConfirmBadgeModalVisible] = useState(false);
  const [submittingBadge, setSubmittingBadge] = useState(false);
  const [badgeSuccessModal, setBadgeSuccessModal] = useState<{ visible: boolean; expiryDate: string }>({
    visible: false,
    expiryDate: '',
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

  const [activeRemainingSecs, setActiveRemainingSecs] = useState<number>(0);

  const cooldownIntervalRef = useRef<any>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/boost/status');
      if (res.data.success && res.data.data) {
        setData(res.data.data);
        if (res.data.data.verifiedBadge) {
          const { isVerified, verifiedUntil, verifiedSource } = res.data.data.verifiedBadge;
          dispatch(updateUser({ isVerified, verifiedUntil, verifiedSource }));
          if (currentUser) {
            AsyncStorage.setItem('cached_user', JSON.stringify({ ...currentUser, isVerified, verifiedUntil, verifiedSource })).catch(() => {});
          }
        }
        const cd = Number(res.data.data.dailyAds?.cooldownSeconds || 0);
        setCooldownLeft(cd);
        if (res.data.data.activeBoost?.remainingSeconds) {
          setActiveRemainingSecs(Number(res.data.data.activeBoost.remainingSeconds));
        } else {
          setActiveRemainingSecs(0);
        }
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

  // Live countdown timer for active highlight remaining time
  useEffect(() => {
    if (activeRemainingSecs <= 0) return;
    const interval = setInterval(() => {
      setActiveRemainingSecs((prev) => {
        if (prev <= 1) {
          fetchStatus(); // refresh and promote next in queue when active ends!
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRemainingSecs, fetchStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const formatTimer = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCountdown = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWatchAd = () => {
    if (!data?.dailyAds?.canWatch) {
      if (cooldownLeft > 0) {
        if (data?.dailyAds?.isCycleReset) {
          showAlert('Cycle Limit Reached', `All 16 ads watched! Limit resets in ${formatTimer(cooldownLeft)} (1-hour cooldown).`);
        } else {
          showAlert('Cooldown Active', `Please wait ${formatTimer(cooldownLeft)} before watching another ad.`);
        }
      } else if (data?.dailyAds?.remaining <= 0) {
        showAlert('Cycle Limit Reached', 'You have watched all 16 ads. Limit resets in 1 hour!');
      }
      return;
    }

    setIsAdLoading(true);

    let adRewardEarned = false;

    loadAndShowRewardedAd({
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

  const onInitiateBuyBadge = () => {
    if (userCoins < badgePrice) {
      showAlert('Coins Needed', `You need ${badgePrice.toLocaleString()} coins to get the Verified Badge. You currently have ${userCoins.toLocaleString()} coins. Watch ads to collect more coins!`);
      return;
    }
    setVerifiedModalVisible(false);
    setTimeout(() => {
      setConfirmBadgeModalVisible(true);
    }, 200);
  };

  const handleCancelConfirmBadge = () => {
    setConfirmBadgeModalVisible(false);
    setTimeout(() => {
      setVerifiedModalVisible(true);
    }, 200);
  };

  const handleConfirmBuyBadge = async () => {
    setSubmittingBadge(true);
    try {
      const res = await api.post('/boost/buy-verified-badge');
      if (res.data.success && res.data.data) {
        const { isVerified, verifiedUntil, verifiedSource } = res.data.data;
        const updatedUserData = { ...currentUser, isVerified, verifiedUntil, verifiedSource };
        dispatch(updateUser({ isVerified, verifiedUntil, verifiedSource }));
        AsyncStorage.setItem('cached_user', JSON.stringify(updatedUserData)).catch(() => {});
        setConfirmBadgeModalVisible(false);
        setVerifiedModalVisible(false);
        const formattedDate = new Date(verifiedUntil).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        setTimeout(() => {
          setBadgeSuccessModal({
            visible: true,
            expiryDate: formattedDate,
          });
        }, 200);
        fetchStatus();
      }
    } catch (err: any) {
      showAlert('Purchase Failed', err?.response?.data?.message || 'Failed to purchase verified badge.');
    } finally {
      setSubmittingBadge(false);
    }
  };

  const openBoostModal = async () => {
    if ((data?.coins || 0) < 100) {
      showAlert('Coins Needed', 'You need at least 100 coins to highlight a video. Watch ads to collect more coins!');
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
      showAlert('Already Highlighted', 'This video is already currently highlighted or in the boost queue.');
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
        showAlert('Video Highlighted! 🚀', res.data.message || 'Your video has been added to the highlight queue.');
        fetchStatus();
      }
    } catch (err: any) {
      showAlert('Boost Error', err?.response?.data?.message || 'Failed to create video highlight.');
    } finally {
      setSubmittingBoost(false);
    }
  };

  const userCoins = Number(data?.coins || 0);
  const dailyAds = data?.dailyAds || { watched: 0, total: 16, remaining: 16, canWatch: false, sessionCount: 0 };
  const canBoostNow = userCoins >= 100;
  const activeBoost = data?.activeBoost;
  const queuedBoosts = data?.queuedBoosts || [];

  const filteredVideos = eligibleVideos.filter((v) =>
    (v.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ad slot states
  const isDailyDone = dailyAds.remaining <= 0;
  const isCooldown = cooldownLeft > 0;
  const isCycleReset = Boolean(dailyAds.isCycleReset) || (isDailyDone && isCooldown);
  const sessionCount = Number(dailyAds.sessionCount || 0);

  const ad1Watched = isDailyDone || isCooldown || sessionCount >= 1;
  const ad1Active = !isDailyDone && !isCooldown && sessionCount === 0;

  const ad2Watched = isDailyDone || isCooldown || sessionCount >= 2;
  const ad2Active = !isDailyDone && !isCooldown && sessionCount === 1;

  const ad3Watched = isDailyDone || isCooldown || sessionCount >= 3;
  const ad3Active = !isDailyDone && !isCooldown && sessionCount === 2;

  // Verified Badge states
  const isUserVerified = Boolean(currentUser?.isVerified || data?.verifiedBadge?.isVerified);
  const verifiedUntil = data?.verifiedBadge?.verifiedUntil || currentUser?.verifiedUntil;
  const isCoinVerified = (data?.verifiedBadge?.verifiedSource || currentUser?.verifiedSource) === 'coin_purchase';
  const badgePrice = Number(data?.verifiedBadge?.priceCoins || 1500);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* App Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Boost</Text>
        </View>

        <View style={styles.headerRightGroup}>
          {/* Get Verified Blue Tick Button (Left of Boost Button) */}
          <TouchableOpacity
            style={styles.headerVerifiedBtn}
            onPress={() => setVerifiedModalVisible(true)}
            activeOpacity={0.85}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.headerVerifiedBtnText}>Get </Text>
            <Ionicons name="checkmark-circle" size={16} color="#0095F6" />
          </TouchableOpacity>

          {/* Boost Button */}
          <TouchableOpacity
            style={[styles.headerBoostBtn, !canBoostNow && styles.headerBoostBtnDisabled]}
            onPress={openBoostModal}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canBoostNow ? ['#8E24AA', '#D81B60'] : ['#E0E0E0', '#BDBDBD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerBoostGradient}
            >
              <Ionicons name="rocket" size={13} color={canBoostNow ? Colors.white : '#757575'} />
              <Text style={[styles.headerBoostBtnText, !canBoostNow && { color: '#757575' }]}>
                Boost
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
          {/* Top Explanatory Info Card (2 lines only with Rates button on bottom-right) */}
          <View style={styles.infoBanner}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="information-circle" size={18} color="#8E24AA" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoText} numberOfLines={2}>
                Watch ads to earn coins. Spend 100+ coins to highlight your video directly at the top of the Home Feed!
              </Text>
              <TouchableOpacity
                style={styles.infoRatesBtn}
                onPress={() => setRateChartModal(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="stats-chart" size={12} color="#8E24AA" />
                <Text style={styles.infoRatesBtnText}>Rates</Text>
                <Ionicons name="chevron-forward" size={11} color="#8E24AA" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Two Main KPI Cards without 0/100 or Ad Ready pills */}
          <View style={styles.kpiRow}>
            {/* KPI Card 1: Coins Balance */}
            <View style={[styles.kpiCard, styles.coinsCard]}>
              <View style={styles.kpiTopRow}>
                <Text style={styles.kpiLabel}>Coins Balance</Text>
                <View style={styles.coinBadgeIcon}>
                  <Text style={{ fontSize: 13 }}>🪙</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{userCoins.toLocaleString()}</Text>
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
            </View>
          </View>

          {/* Banner Ad between Coins Stats and Earn Coins section */}
          <View style={styles.bannerAdContainer}>
            <AppAdBanner />
          </View>

          {/* Watch Ad Action Section - 3 Ads Instant Burst */}
          <View style={styles.adSectionCard}>
            <View style={styles.adSectionHeader}>
              <View style={styles.adRewardIconBox}>
                <Ionicons name="gift" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.adSectionTitle}>Earn Coins</Text>
                <Text style={styles.adSectionDesc}>
                  Watch sponsored video ads to earn free coins
                </Text>
              </View>
            </View>

            {/* All 3 Ads in a Single Vertical Column */}
            <View style={styles.adsListColumn}>
              {/* Ad Card 1 */}
              <View style={[
                styles.adItemCard,
                ad1Watched && styles.adItemCardWatched,
                ad1Active && styles.adItemCardActive,
                (isCooldown || isDailyDone) && styles.adItemCardDisabled,
              ]}>
                <View style={styles.adItemLeft}>
                  <View style={[
                    styles.adItemIconWrap,
                    ad1Watched ? styles.adItemIconWrapWatched : ad1Active ? styles.adItemIconWrapActive : styles.adItemIconWrapMuted,
                  ]}>
                    <Ionicons
                      name={ad1Watched ? 'checkmark-circle' : ad1Active ? 'play' : 'lock-closed'}
                      size={15}
                      color={ad1Watched ? '#2E7D32' : ad1Active ? '#8E24AA' : '#9E9E9E'}
                    />
                  </View>
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.adItemTitle}>Reward 1</Text>
                    <Text style={styles.adItemStatus}>
                      {ad1Watched ? 'Claimed' : ad1Active ? 'Available' : isCooldown ? 'In cooldown' : 'Available'}
                    </Text>
                  </View>
                </View>

                {ad1Watched ? (
                  <View style={styles.watchedBadge}>
                    <Ionicons name="checkmark" size={12} color="#2E7D32" />
                    <Text style={styles.watchedBadgeText}>Watched</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.watchActionBtn,
                      (!ad1Active || isAdLoading) && styles.watchActionBtnDisabled,
                    ]}
                    onPress={handleWatchAd}
                    disabled={!ad1Active || isAdLoading}
                    activeOpacity={0.8}
                  >
                    {isAdLoading && ad1Active ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={ad1Active ? 'play' : 'lock-closed'} size={11} color="#FFF" />
                        <Text style={styles.watchActionBtnText}>
                          {ad1Active ? 'Watch' : 'Locked'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Ad Card 2 */}
              <View style={[
                styles.adItemCard,
                ad2Watched && styles.adItemCardWatched,
                ad2Active && styles.adItemCardActive,
                (isCooldown || isDailyDone) && styles.adItemCardDisabled,
              ]}>
                <View style={styles.adItemLeft}>
                  <View style={[
                    styles.adItemIconWrap,
                    ad2Watched ? styles.adItemIconWrapWatched : ad2Active ? styles.adItemIconWrapActive : styles.adItemIconWrapMuted,
                  ]}>
                    <Ionicons
                      name={ad2Watched ? 'checkmark-circle' : ad2Active ? 'play' : 'lock-closed'}
                      size={15}
                      color={ad2Watched ? '#2E7D32' : ad2Active ? '#8E24AA' : '#9E9E9E'}
                    />
                  </View>
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.adItemTitle}>Reward 2</Text>
                    <Text style={styles.adItemStatus}>
                      {ad2Watched
                        ? 'Claimed'
                        : ad2Active
                        ? 'Available'
                        : isCooldown
                        ? 'In cooldown'
                        : 'Locked'}
                    </Text>
                  </View>
                </View>

                {ad2Watched ? (
                  <View style={styles.watchedBadge}>
                    <Ionicons name="checkmark" size={12} color="#2E7D32" />
                    <Text style={styles.watchedBadgeText}>Watched</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.watchActionBtn,
                      (!ad2Active || isAdLoading) && styles.watchActionBtnDisabled,
                    ]}
                    onPress={handleWatchAd}
                    disabled={!ad2Active || isAdLoading}
                    activeOpacity={0.8}
                  >
                    {isAdLoading && ad2Active ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={ad2Active ? 'play' : 'lock-closed'} size={11} color="#FFF" />
                        <Text style={styles.watchActionBtnText}>
                          {ad2Active ? 'Watch' : 'Locked'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Ad Card 3 */}
              <View style={[
                styles.adItemCard,
                ad3Watched && styles.adItemCardWatched,
                ad3Active && styles.adItemCardActive,
                (isCooldown || isDailyDone) && styles.adItemCardDisabled,
              ]}>
                <View style={styles.adItemLeft}>
                  <View style={[
                    styles.adItemIconWrap,
                    ad3Watched ? styles.adItemIconWrapWatched : ad3Active ? styles.adItemIconWrapActive : styles.adItemIconWrapMuted,
                  ]}>
                    <Ionicons
                      name={ad3Watched ? 'checkmark-circle' : ad3Active ? 'play' : 'lock-closed'}
                      size={15}
                      color={ad3Watched ? '#2E7D32' : ad3Active ? '#8E24AA' : '#9E9E9E'}
                    />
                  </View>
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.adItemTitle}>Reward 3</Text>
                    <Text style={styles.adItemStatus}>
                      {ad3Watched
                        ? 'Claimed'
                        : ad3Active
                        ? 'Available'
                        : isCooldown
                        ? 'In cooldown'
                        : 'Locked'}
                    </Text>
                  </View>
                </View>

                {ad3Watched ? (
                  <View style={styles.watchedBadge}>
                    <Ionicons name="checkmark" size={12} color="#2E7D32" />
                    <Text style={styles.watchedBadgeText}>Watched</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.watchActionBtn,
                      (!ad3Active || isAdLoading) && styles.watchActionBtnDisabled,
                    ]}
                    onPress={handleWatchAd}
                    disabled={!ad3Active || isAdLoading}
                    activeOpacity={0.8}
                  >
                    {isAdLoading && ad3Active ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={ad3Active ? 'play' : 'lock-closed'} size={11} color="#FFF" />
                        <Text style={styles.watchActionBtnText}>
                          {ad3Active ? 'Watch' : 'Locked'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Cooldown or Completion Banner */}
            {isCycleReset && cooldownLeft > 0 ? (
              <View style={[styles.cooldownBanner, { backgroundColor: '#EDE7F6', borderColor: '#D1C4E9', borderWidth: 1 }]}>
                <Ionicons name="hourglass-outline" size={16} color="#6A1B9A" />
                <Text style={[styles.cooldownBannerText, { color: '#4A148C' }]}>
                  All 16 ads watched! Limit resets in <Text style={{ fontWeight: '800' }}>{formatTimer(cooldownLeft)}</Text> (1-hour cooldown)
                </Text>
              </View>
            ) : cooldownLeft > 0 ? (
              <View style={styles.cooldownBanner}>
                <Ionicons name="timer-outline" size={16} color="#E65100" />
                <Text style={styles.cooldownBannerText}>
                  Cooldown active! Next 3 ads unlock in <Text style={{ fontWeight: '800' }}>{formatTimer(cooldownLeft)}</Text>
                </Text>
              </View>
            ) : dailyAds.remaining <= 0 ? (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                <Text style={styles.completedBannerText}>All 16 ads watched! Limit resets in 1 hour.</Text>
              </View>
            ) : (
              <View style={styles.sessionHintRow}>
                <Ionicons name="time-outline" size={13} color="#757575" />
                <Text style={styles.sessionHintText}>3 ads per session • 10-minute pause • 16-ad limit resets in 1 hour</Text>
              </View>
            )}
          </View>

          {/* Active Live Highlighted Video (if any) */}
          {activeBoost && (
            <View style={styles.activeBoostCard}>
              <View style={styles.activeBadgeRow}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE ON FEED</Text>
                </View>
                <Text style={styles.remainingTimeText}>
                  Ends in {formatCountdown(activeRemainingSecs || activeBoost.remainingSeconds)}
                </Text>
              </View>

              <View style={styles.boostVideoRow}>
                {activeBoost.video?.thumbnail && (
                  <Image source={{ uri: activeBoost.video.thumbnail }} style={styles.boostThumb} contentFit="cover" />
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.boostVidTitle} numberOfLines={2}>
                    {activeBoost.video?.title || 'Highlighted Video'}
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
                        Math.min(100, ((activeRemainingSecs || activeBoost.remainingSeconds) / (activeBoost.durationHours * 3600)) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Up Next Highlights (if any) */}
          {queuedBoosts.length > 0 && (
            <View style={styles.queuedSection}>
              <Text style={styles.sectionTitle}>Up Next on Feed ({queuedBoosts.length})</Text>
              {queuedBoosts.map((qb: any) => {
                const estTime = qb.estimatedStartTime ? new Date(qb.estimatedStartTime).getTime() : Date.now();
                const diffFromNow = Math.max(0, Math.ceil((estTime - Date.now()) / 1000));
                const startsInSecs = qb.queuePosition === 1
                  ? (activeRemainingSecs > 0 ? activeRemainingSecs : diffFromNow)
                  : diffFromNow;

                const activeTotalSecs = activeBoost && activeBoost.durationHours ? activeBoost.durationHours * 3600 : 3600;
                const waitProgress = Math.max(
                  5,
                  Math.min(100, Math.round(((activeTotalSecs - startsInSecs) / activeTotalSecs) * 100))
                );

                return (
                  <View key={qb._id} style={styles.queuedCard}>
                    <View style={styles.queuedBadgeRow}>
                      <View style={styles.queuedBadge}>
                        <Ionicons name="sparkles" size={11} color="#5E35B1" />
                        <Text style={styles.queuedBadgeText}>#{qb.queuePosition} Up Next</Text>
                      </View>
                      <Text style={styles.queuedEstText}>
                        Starts in {formatCountdown(startsInSecs)}
                      </Text>
                    </View>

                    <View style={styles.boostVideoRow}>
                      {qb.video?.thumbnail && (
                        <Image source={{ uri: qb.video.thumbnail }} style={styles.boostThumb} contentFit="cover" />
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.boostVidTitle} numberOfLines={1}>
                          {qb.video?.title || 'Video in line'}
                        </Text>
                        <Text style={styles.boostVidMeta}>{qb.durationHours}h Tier • Ready to go live next</Text>
                      </View>
                    </View>

                    {/* Progress bar for queue wait */}
                    <View style={styles.queueProgressWrap}>
                      <View style={[styles.queueProgressFill, { width: `${waitProgress}%` }]} />
                    </View>
                    <View style={styles.queueProgressMetaRow}>
                      <Text style={styles.queueProgressLabel}>Going live next</Text>
                      <Text style={styles.queueProgressPercent}>{waitProgress}% ready</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Global Queue Info */}
          <View style={styles.globalQueueBox}>
            {/* Line 1: Videos waiting in line */}
            <View style={styles.globalQueueItem}>
              <View style={styles.globalQueueIconWrap}>
                <Ionicons name="people" size={14} color="#8E24AA" />
              </View>
              <Text style={styles.globalQueueLabel}>Videos waiting in line:</Text>
              <View style={styles.globalQueueBadge}>
                <Text style={styles.globalQueueBadgeText}>{data?.globalQueue?.totalQueued || 0}</Text>
              </View>
            </View>

            {/* Line 2: Live video */}
            <View style={styles.globalQueueItem}>
              {data?.globalQueue?.currentActive ? (
                <>
                  <View style={[styles.globalQueueIconWrap, styles.globalQueueLiveIconWrap]}>
                    <View style={styles.globalQueueLiveDot} />
                  </View>
                  <Text style={styles.globalQueueLiveLabel}>Live video:</Text>
                  <View style={styles.globalQueueLiveBadge}>
                    <Text style={styles.globalQueueLiveBadgeText}>LIVE</Text>
                  </View>
                  <Text style={styles.globalQueueLiveTitle} numberOfLines={1}>
                    "{data.globalQueue.currentActive.videoTitle || 'Active Video'}"
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.globalQueueIconWrap, styles.globalQueueOpenIconWrap]}>
                    <Ionicons name="flash" size={13} color="#2E7D32" />
                  </View>
                  <Text style={styles.globalQueueLiveLabel}>Live video:</Text>
                  <View style={styles.globalQueueOpenBadge}>
                    <Text style={styles.globalQueueOpenBadgeText}>OPEN</Text>
                  </View>
                  <Text style={styles.globalQueueOpenText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    Slot open! Highlight goes live immediately
                  </Text>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Rate Chart Modal */}
      <Modal visible={rateChartModal} transparent animationType="fade" onRequestClose={() => setRateChartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.rateChartBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coins vs Highlight Rates</Text>
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
                  <Text style={styles.tierHours}>1 Hour Highlight</Text>
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
                  <Text style={styles.tierHours}>3 Hours Highlight</Text>
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
                  <Text style={styles.tierHours}>6 Hours Highlight</Text>
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
                  <Text style={[styles.tierHours, { color: '#8E24AA' }]}>24 Hours Highlight</Text>
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
              Great job! Your coins have been added to your balance. Use them to highlight your video at the top of the Home Feed!
            </Text>
            <TouchableOpacity
              style={styles.claimDoneBtn}
              onPress={() => setRewardModal({ visible: false, coins: 0 })}
              activeOpacity={0.85}
            >
              <Text
                style={styles.claimDoneBtnText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                Collect & Continue
              </Text>
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
            <Text style={styles.headerTitle}>Select Video to Highlight</Text>
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
                          <Text style={styles.alreadyBoostedText}>Scheduled Up Next</Text>
                        </View>
                      )}
                    </View>
                    {vid.isBoosted ? (
                      <View style={styles.videoBoostedBadge}>
                        <Ionicons name="sparkles" size={11} color="#5E35B1" />
                        <Text style={styles.videoBoostedBadgeText}>Up Next</Text>
                      </View>
                    ) : (
                      <View style={styles.videoCardBoostBtn}>
                        <Ionicons name="rocket" size={12} color={Colors.white} />
                        <Text style={styles.videoCardBoostBtnText}>Boost</Text>
                      </View>
                    )}
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

            <Text style={styles.selectTierLabel}>Select Highlight Duration:</Text>
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
                  ? 'Your video will be highlighted at the top of the Home Feed immediately!'
                  : 'A video is currently live. Your video is scheduled Up Next and will go live automatically right after!'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmFinalBtn, submittingBoost && styles.confirmFinalBtnDisabled]}
              onPress={handleConfirmBoost}
              disabled={submittingBoost}
            >
              {submittingBoost ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.confirmFinalBtnText}>
                  Boost ({selectedTier === 1 ? 100 : selectedTier === 3 ? 250 : selectedTier === 6 ? 500 : 1000} coins)
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Verified Badge Purchase Modal */}
      <Modal visible={verifiedModalVisible} transparent animationType="fade" onRequestClose={() => setVerifiedModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.verifiedModalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#0095F6" />
                <Text style={styles.verifiedModalTitle}>Official Verified Badge</Text>
              </View>
              <TouchableOpacity onPress={() => setVerifiedModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Profile Preview with Blue Tick */}
            <View style={styles.verifiedPreviewBox}>
              {currentUser?.avatar ? (
                <Image source={{ uri: currentUser.avatar }} style={styles.verifiedPreviewAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.verifiedPreviewAvatar, { backgroundColor: '#0095F6', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>
                    {(currentUser?.name || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.verifiedPreviewName} numberOfLines={1}>
                    {currentUser?.channelName || currentUser?.name || 'Your Channel'}
                  </Text>
                  <VerifiedBadge size={15} style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.verifiedPreviewSub}>Verified Channel Preview</Text>
              </View>
            </View>

            {/* Benefits List */}
            <View style={styles.verifiedBenefitsList}>
              <View style={styles.verifiedBenefitRow}>
                <Ionicons name="checkmark-circle" size={15} color="#0095F6" />
                <Text style={styles.verifiedBenefitText}>Blue tick checkmark beside your channel name</Text>
              </View>
              <View style={styles.verifiedBenefitRow}>
                <Ionicons name="checkmark-circle" size={15} color="#0095F6" />
                <Text style={styles.verifiedBenefitText}>Displays on all your videos, comments, shorts & posts</Text>
              </View>
              <View style={styles.verifiedBenefitRow}>
                <Ionicons name="checkmark-circle" size={15} color="#0095F6" />
                <Text style={styles.verifiedBenefitText}>Build creator authority & trust across the community</Text>
              </View>
              <View style={styles.verifiedBenefitRow}>
                <Ionicons name="time-outline" size={15} color="#0095F6" />
                <Text style={styles.verifiedBenefitText}>Valid for 1 month</Text>
              </View>
            </View>

            {/* Cost & Balance */}
            <View style={styles.verifiedCostCard}>
              <View style={styles.verifiedCostRow}>
                <Text style={styles.verifiedCostLabel}>Badge Cost (1 Month)</Text>
                <Text style={styles.verifiedCostValue}>🪙 {badgePrice.toLocaleString()} Coins</Text>
              </View>
              <View style={[styles.verifiedCostRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#EEEEEE' }]}>
                <Text style={styles.verifiedCostLabel}>Your Balance</Text>
                <Text style={[styles.verifiedCostValue, { color: userCoins >= badgePrice ? '#2E7D32' : '#C62828' }]}>
                  🪙 {userCoins.toLocaleString()} Coins
                </Text>
              </View>
            </View>

            {userCoins < badgePrice && (
              <View style={styles.verifiedCoinsShortage}>
                <Ionicons name="alert-circle-outline" size={14} color="#C62828" />
                <Text style={styles.verifiedCoinsShortageText}>
                  You need {(badgePrice - userCoins).toLocaleString()} more coins. Watch ads to collect coins!
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.verifiedBuyBtn,
                (userCoins < badgePrice || submittingBadge) && styles.verifiedBuyBtnDisabled,
              ]}
              onPress={onInitiateBuyBadge}
              disabled={userCoins < badgePrice || submittingBadge}
              activeOpacity={0.85}
            >
              {submittingBadge ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.verifiedBuyBtnText}>
                    {userCoins >= badgePrice
                      ? isUserVerified
                        ? `Extend Badge (🪙 ${badgePrice.toLocaleString()} Coins)`
                        : `Get Verified Badge (🪙 ${badgePrice.toLocaleString()} Coins)`
                      : `Need ${(badgePrice - userCoins).toLocaleString()} More Coins`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Verified Badge Confirmation Modal */}
      <Modal
        visible={confirmBadgeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirmBadge}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.badgeConfirmBox}>
            <View style={styles.badgeConfirmIconWrap}>
              <Ionicons name="shield-checkmark" size={32} color="#0095F6" />
            </View>

            <Text style={styles.badgeConfirmTitle}>
              {isUserVerified ? 'Extend Verified Badge?' : 'Get Verified Badge?'}
            </Text>
            <Text style={styles.badgeConfirmDesc}>
              {isUserVerified
                ? 'Confirm extending your official blue tick verification for an additional 1 month.'
                : 'Confirm getting the official blue tick badge on your channel profile and videos for 1 month.'}
            </Text>

            <View style={styles.badgeConfirmSummaryBox}>
              <View style={styles.badgeConfirmSummaryRow}>
                <Text style={styles.badgeConfirmSummaryLabel}>Validity Duration</Text>
                <Text style={styles.badgeConfirmSummaryValue}>1 Month</Text>
              </View>
              <View style={styles.badgeConfirmSummaryRow}>
                <Text style={styles.badgeConfirmSummaryLabel}>Cost</Text>
                <Text style={[styles.badgeConfirmSummaryValue, { color: '#0095F6' }]}>
                  🪙 {badgePrice.toLocaleString()} Coins
                </Text>
              </View>
            </View>

            <View style={styles.badgeConfirmBtnRow}>
              <TouchableOpacity
                style={styles.badgeConfirmCancelBtn}
                onPress={handleCancelConfirmBadge}
                disabled={submittingBadge}
                activeOpacity={0.7}
              >
                <Text style={styles.badgeConfirmCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.badgeConfirmSubmitBtn, submittingBadge && { opacity: 0.7 }]}
                onPress={handleConfirmBuyBadge}
                disabled={submittingBadge}
                activeOpacity={0.85}
              >
                {submittingBadge ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.badgeConfirmSubmitBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verified Badge Success Modal */}
      <Modal
        visible={badgeSuccessModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setBadgeSuccessModal({ visible: false, expiryDate: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.verifiedSuccessBox}>
            <View style={styles.verifiedSuccessIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#0095F6" />
            </View>

            <Text style={styles.verifiedSuccessTitle}>Verified Badge Active!</Text>

            <View style={styles.verifiedSuccessPill}>
              <Ionicons name="checkmark-circle" size={13} color="#0284C7" />
              <Text style={styles.verifiedSuccessPillText}>Official Blue Tick Granted</Text>
            </View>

            <Text style={styles.verifiedSuccessDesc}>
              Congratulations! Your channel is now verified with the official blue tick badge on your profile and videos until{' '}
              <Text style={{ fontWeight: '700', color: Colors.text }}>{badgeSuccessModal.expiryDate}</Text> (1 Month).
            </Text>

            <TouchableOpacity
              style={styles.verifiedSuccessDoneBtn}
              onPress={() => setBadgeSuccessModal({ visible: false, expiryDate: '' })}
              activeOpacity={0.85}
            >
              <Text style={styles.verifiedSuccessDoneBtnText}>Great, Thanks!</Text>
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
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerVerifiedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#BAE3FF',
  },
  headerVerifiedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0095F6',
  },
  headerBoostBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#8E24AA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBoostBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  headerBoostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 5,
  },
  headerBoostBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  scrollContent: { padding: 16 },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  infoIconWrap: { paddingTop: 2 },
  infoTextContainer: { flex: 1 },
  infoText: { fontSize: 12, color: '#4A148C', lineHeight: 17, fontWeight: '500' },
  infoRatesBtn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E1BEE7',
  },
  infoRatesBtnText: { fontSize: 11, fontWeight: '700', color: '#8E24AA' },

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
  bannerAdContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },

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
  adSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  adRewardIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#8E24AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adSectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  adSectionDesc: { fontSize: 12, color: '#666', marginTop: 2 },

  // Ads list column
  adsListColumn: {
    gap: 10,
    marginBottom: 12,
  },
  adItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  adItemCardActive: {
    backgroundColor: '#FAF5FC',
    borderColor: '#CE93D8',
  },
  adItemCardWatched: {
    backgroundColor: '#F1F8E9',
    borderColor: '#C8E6C9',
  },
  adItemCardDisabled: {
    opacity: 0.85,
  },
  adItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  adItemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adItemIconWrapActive: {
    backgroundColor: '#F3E5F5',
  },
  adItemIconWrapWatched: {
    backgroundColor: '#E8F5E9',
  },
  adItemIconWrapMuted: {
    backgroundColor: '#EEEEEE',
  },
  adItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  adItemStatus: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  watchActionBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchActionBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
  watchActionBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  watchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 10,
  },
  watchedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
  },

  cooldownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  cooldownBannerText: { fontSize: 12, color: '#E65100', fontWeight: '500' },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  completedBannerText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  sessionHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 4,
  },
  sessionHintText: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '500',
  },

  // Active live card
  activeBoostCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    marginBottom: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activeBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E7D32' },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#2E7D32', letterSpacing: 0.3 },
  remainingTimeText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  boostVideoRow: { flexDirection: 'row', alignItems: 'center' },
  boostThumb: { width: 72, height: 48, borderRadius: 6, backgroundColor: '#DDD' },
  boostVidTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  boostVidMeta: { fontSize: 11, color: '#777', marginTop: 3 },
  progressBarWrap: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },

  // Queued section
  queuedSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  queuedCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 8,
  },
  queuedBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queuedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  queuedBadgeText: { fontSize: 11, fontWeight: '700', color: '#5E35B1' },
  queuedEstText: { fontSize: 11, color: '#5E35B1', fontWeight: '700' },
  queueProgressWrap: {
    height: 6,
    backgroundColor: '#EDE7F6',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  queueProgressFill: {
    height: '100%',
    backgroundColor: '#8E24AA',
    borderRadius: 3,
  },
  queueProgressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  queueProgressLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  queueProgressPercent: {
    fontSize: 10,
    color: '#8E24AA',
    fontWeight: '700',
  },

  // Global queue info
  globalQueueBox: {
    backgroundColor: '#FAF5FC',
    borderRadius: 14,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EBD8F5',
    gap: 8,
  },
  globalQueueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0E5F7',
  },
  globalQueueIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3E5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  globalQueueLiveIconWrap: {
    backgroundColor: '#E8F5E9',
  },
  globalQueueOpenIconWrap: {
    backgroundColor: '#E8F5E9',
  },
  globalQueueLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  globalQueueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A148C',
    marginRight: 8,
  },
  globalQueueBadge: {
    backgroundColor: '#8E24AA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  globalQueueBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  globalQueueLiveLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A148C',
    marginRight: 6,
  },
  globalQueueLiveBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  globalQueueLiveBadgeText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  globalQueueLiveTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222222',
    flex: 1,
  },
  globalQueueOpenBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  globalQueueOpenBadgeText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  globalQueueOpenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    flex: 1,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  rateChartBox: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  rateChartSub: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 16 },
  tiersList: { gap: 10, marginBottom: 18 },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  tierLeft: { flex: 1 },
  tierCoin: { fontSize: 14, fontWeight: '700', color: Colors.text },
  tierArrow: { paddingHorizontal: 8 },
  tierRight: { flex: 1.2, alignItems: 'flex-end' },
  tierHours: { fontSize: 14, fontWeight: '700', color: Colors.text },
  discountBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E65100',
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  gotItBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  gotItText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  // Celebration modal
  celebrationBox: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  celebrationTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 12 },
  celebrationCoins: { fontSize: 28, fontWeight: '900', color: '#8E24AA', marginVertical: 6 },
  celebrationSub: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  claimDoneBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimDoneBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Select video modal
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  videoSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  videoSelectCardDisabled: { opacity: 0.5 },
  videoSelectThumb: { width: 80, height: 50, borderRadius: 6, backgroundColor: '#DDD' },
  videoSelectTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  videoSelectMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  alreadyBoostedBadge: {
    backgroundColor: '#EDE7F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  alreadyBoostedText: { fontSize: 10, fontWeight: '600', color: '#5E35B1' },
  videoCardBoostBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoCardBoostBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  videoBoostedBadge: {
    backgroundColor: '#EDE7F6',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoBoostedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5E35B1',
  },

  // Confirm modal
  confirmBox: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
  },
  confirmVidPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  confirmThumb: { width: 50, height: 35, borderRadius: 4, backgroundColor: '#DDD', marginRight: 10 },
  confirmVidTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.text },
  selectTierLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  tierSelector: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tierOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  tierOptionSelected: { borderColor: '#8E24AA', backgroundColor: '#F3E5F5' },
  tierOptionDisabled: { opacity: 0.4 },
  tierOptionHours: { fontSize: 12, fontWeight: '700', color: '#555' },
  tierOptionCoins: { fontSize: 11, fontWeight: '600', color: '#777', marginTop: 2 },
  tierOptionTextSelected: { color: '#8E24AA' },
  queueNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  queueNoteText: { flex: 1, fontSize: 11, color: '#E65100', lineHeight: 15 },
  confirmFinalBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmFinalBtnDisabled: { opacity: 0.6 },
  confirmFinalBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },

  // Verified Badge Purchase Modal
  verifiedModalBox: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  verifiedModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  verifiedPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#BAE3FF',
  },
  verifiedPreviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DDD',
  },
  verifiedPreviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  verifiedPreviewSub: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '500',
    marginTop: 2,
  },
  verifiedBenefitsList: {
    gap: 7,
    marginBottom: 12,
  },
  verifiedBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  verifiedBenefitText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  verifiedCostCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 12,
  },
  verifiedCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  verifiedCostLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    flexShrink: 1,
  },
  verifiedCostValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 0,
    textAlign: 'right',
  },
  verifiedCoinsShortage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFEBEE',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  verifiedCoinsShortageText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  verifiedBuyBtn: {
    backgroundColor: '#0095F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0095F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  verifiedBuyBtnDisabled: {
    backgroundColor: '#BDBDBD',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifiedBuyBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  // Verified Badge Confirmation Modal
  badgeConfirmBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    width: '88%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeConfirmIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeConfirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  badgeConfirmDesc: {
    fontSize: 12.5,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  badgeConfirmSummaryBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 16,
    gap: 6,
  },
  badgeConfirmSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeConfirmSummaryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  badgeConfirmSummaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  badgeConfirmDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 2,
  },
  badgeConfirmBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  badgeConfirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeConfirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
  },
  badgeConfirmSubmitBtn: {
    flex: 1.3,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0095F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeConfirmSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },

  // Verified Badge Success Modal
  verifiedSuccessBox: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: '88%',
    maxWidth: 340,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  verifiedSuccessIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  verifiedSuccessTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    marginBottom: 8,
  },
  verifiedSuccessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  verifiedSuccessPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    textAlign: 'center',
    alignSelf: 'center',
  },
  verifiedSuccessDesc: {
    fontSize: 12.5,
    color: '#666',
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  verifiedSuccessDoneBtn: {
    backgroundColor: '#0095F6',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#0095F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  verifiedSuccessDoneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    alignSelf: 'center',
  },
});
