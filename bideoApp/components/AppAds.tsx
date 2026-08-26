import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Modal, Text, TouchableOpacity, ActivityIndicator, Dimensions, Linking, Image as RNImage } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import api from '../services/api';
import Colors from '../constants/Colors';

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

const TEST_BANNER_ID = Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712';

const REAL_BANNER_ID = 'ca-app-pub-6331792031097303/7103600940';
const REAL_INTERSTITIAL_ID = 'ca-app-pub-6331792031097303/8580334145';

// Use test ads in development OR when EXPO_PUBLIC_USE_TEST_ADS is explicitly true (local test APK builds)
const isTestingAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';

export const ADMOB_IDS = {
  BANNER: isTestingAds
    ? TEST_BANNER_ID
    : (Constants.expoConfig?.extra?.ADMOB_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || REAL_BANNER_ID),

  INTERSTITIAL: isTestingAds
    ? TEST_INTERSTITIAL_ID
    : (Constants.expoConfig?.extra?.ADMOB_INTERSTITIAL_ID || process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || REAL_INTERSTITIAL_ID),
};

interface AppAdBannerProps {
  size?: any;
}

/**
 * Banner ad that returns null when running in Expo Go (no native module available)
 * or if the native module failed to link correctly.
 */
export const AppAdBanner: React.FC<AppAdBannerProps> = ({ size }: AppAdBannerProps) => {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) return null;

  try {
    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
    if (!BannerAd) return null;

    return (
      <View style={styles.container}>
        <BannerAd
          unitId={ADMOB_IDS.BANNER}
          size={size || BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(error: any) => console.log('Ad failed to load: ', error)}
        />
      </View>
    );
  } catch (e) {
    console.log('AdMob component could not be loaded:', e);
    return null;
  }
};

let globalAdIndex = 0;

interface AppInterstitialAdProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Fullscreen Interstitial Ad component.
 * Attempts to load and show a real AdMob interstitial. If loading fails or is running in Expo Go,
 * it displays a beautiful fullscreen mock ad with a countdown.
 */
export const AppInterstitialAd: React.FC<AppInterstitialAdProps> = ({ visible, onClose }) => {
  const [adTimeRemaining, setAdTimeRemaining] = useState(5);
  const [canClose, setCanClose] = useState(false);
  const [showingRealAd, setShowingRealAd] = useState(false);
  const [realAdFailed, setRealAdFailed] = useState(false);
  const [uploadedAd, setUploadedAd] = useState<any>(null);
  const [adAspectRatio, setAdAspectRatio] = useState(16 / 9);

  useEffect(() => {
    if (!visible) return;

    setAdTimeRemaining(5);
    setCanClose(false);
    setShowingRealAd(false);
    setRealAdFailed(false);

    const fetchAd = async () => {
      try {
        const res = await api.get('/ads/active');
        if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const activeAds = res.data.data.filter((ad: any) => ad && ad.activeStatus !== false);
          if (activeAds.length > 0) {
            let fullAds = activeAds.filter((ad: any) => ad.type === 'full');
            const pool = fullAds.length > 0 ? fullAds : activeAds;
            const selectedAd = pool[globalAdIndex % pool.length];
            globalAdIndex = (globalAdIndex + 1) % pool.length;

            if (selectedAd && selectedAd.image) {
              const resolvedUrl = resolveMediaUrl(selectedAd.image);
              RNImage.getSize(resolvedUrl, (w, h) => {
                if (w && h) {
                  setAdAspectRatio(w / h);
                }
              }, (err) => {
                console.log('Failed to fetch ad image size:', err);
              });
              setUploadedAd(selectedAd);
            } else {
              setUploadedAd(null);
            }
          } else {
            setUploadedAd(null);
          }
        } else {
          setUploadedAd(null);
        }
      } catch (err) {
        console.log('Failed to fetch active ads:', err);
      }
    };
    fetchAd();

    const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      setRealAdFailed(true);
      return;
    }

    try {
      const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
      const adUnitId = ADMOB_IDS.INTERSTITIAL;

      const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      let hasResponded = false;
      const triggerFallback = () => {
        if (!hasResponded) {
          hasResponded = true;
          setRealAdFailed(true);
        }
      };

      const triggerSuccess = () => {
        if (!hasResponded) {
          hasResponded = true;
          setShowingRealAd(true);
        }
      };

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (!hasResponded) {
          triggerSuccess();
          interstitial.show().catch((err: any) => {
            console.log('Failed to show interstitial:', err);
            triggerFallback();
          });
        }
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        onClose();
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log('Interstitial load error:', error);
        triggerFallback();
      });

      interstitial.load();

      // 7-second safety timeout for loading the real ad. Fallback to sponsor/mock ad if network is slow.
      const loadTimeout = setTimeout(() => {
        triggerFallback();
      }, 7000);

      return () => {
        clearTimeout(loadTimeout);
        try {
          unsubscribeLoaded();
          unsubscribeClosed();
          unsubscribeError();
        } catch { }
      };
    } catch (err) {
      console.log('Error loading AdMob Interstitial:', err);
      setRealAdFailed(true);
    }
  }, [visible]);

  // Simulated ad countdown timer
  useEffect(() => {
    if (!visible || !realAdFailed) return;

    const interval = setInterval(() => {
      setAdTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [visible, realAdFailed]);

  const handleAdPress = async () => {
    if (!uploadedAd || !uploadedAd.link) return;
    let url = uploadedAd.link.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/^[a-zA-Z]+:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.log('Failed to open ad link:', url, err);
    }
  };

  if (!visible) return null;
  if (showingRealAd) return null; // Real ad is presented on top by the native SDK

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={adStyles.adModalContainer}>
        <View style={[adStyles.adModalContent, uploadedAd && adStyles.uploadedModalContent]}>
          {/* Header */}
          <View style={adStyles.adHeader}>
            <View style={adStyles.adBadge}>
              <Text style={adStyles.adBadgeText}>SPONSORED AD</Text>
            </View>
            {canClose ? (
              <TouchableOpacity style={adStyles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={adStyles.countdownBadge}>
                <Text style={adStyles.countdownText}>Skip in {adTimeRemaining}s</Text>
              </View>
            )}
          </View>

          {/* Ad Body */}
          {uploadedAd ? (
            <TouchableOpacity
              style={adStyles.uploadedBodyContainer}
              onPress={handleAdPress}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: resolveMediaUrl(uploadedAd.image) }}
                style={[adStyles.adFullImage, { aspectRatio: adAspectRatio }]}
                contentFit="contain"
              />
              <Text style={adStyles.uploadedAdTitle} numberOfLines={1}>{uploadedAd.title}</Text>
              {!!uploadedAd.link && (
                <TouchableOpacity
                  style={[adStyles.ctaButton, { marginTop: 12 }]}
                  onPress={handleAdPress}
                  activeOpacity={0.8}
                >
                  <Text style={adStyles.ctaText}>VISIT SPONSOR SITE</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ) : (
            <View style={adStyles.adBody}>
              <Ionicons name="play-circle-outline" size={70} color="#FFD700" style={adStyles.adIcon} />
              <Text style={adStyles.adTitle}>Enjoying Bideo?</Text>
              <Text style={adStyles.adDescription}>
                Discover trending videos, shorts, and connect with your favorite creators anytime.
              </Text>
            </View>
          )}

          {/* Footer Call to Action */}
          {!uploadedAd && (
            <TouchableOpacity
              style={adStyles.ctaButton}
              onPress={onClose}
            >
              <Text style={adStyles.ctaText}>CONTINUE WATCHING</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const adStyles = StyleSheet.create({
  adModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adModalContent: {
    width: WINDOW_WIDTH - 40,
    height: WINDOW_HEIGHT * 0.6,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadedModalContent: {
    height: 'auto',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  uploadedBodyContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 0,
  },
  adHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 1,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  adBody: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  adBodyContainer: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  adFullImage: {
    width: '100%',
    maxHeight: 280,
    borderRadius: 10,
    marginBottom: 8,
  },
  adIcon: {
    marginBottom: 16,
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  uploadedAdTitle: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 0,
  },
  adDescription: {
    color: '#B3B3B3',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
  },
  ctaText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  bannerAdWrapper: {
    width: '92%',
    aspectRatio: 320 / 50,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  bannerAdImage: {
    width: '100%',
    height: '100%',
  },
  bannerAdLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  bannerAdLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  fallbackBanner: {
    width: '92%',
    backgroundColor: '#FFF4E5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    alignSelf: 'center',
    marginVertical: 10,
  },
  fallbackBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fallbackBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  giftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D35400',
  },
  fallbackBannerText: {
    fontSize: 11,
    color: '#E67E22',
    marginTop: 2,
    fontWeight: '500',
  },
});
