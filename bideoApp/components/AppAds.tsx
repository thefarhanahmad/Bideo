import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';

const TEST_BANNER_ID = Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712';
const TEST_NATIVE_ID = Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/3986624511' : 'ca-app-pub-3940256099942544/2247696110';
const TEST_REWARDED_ID = Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917';

const REAL_BANNER_ID = 'ca-app-pub-3108167135160132/3447160062';
const REAL_INTERSTITIAL_ID = 'ca-app-pub-3108167135160132/8016583160';
const REAL_NATIVE_ID = 'ca-app-pub-3108167135160132/7326918063';
const REAL_REWARDED_ID = 'ca-app-pub-3108167135160132/9694061103';

// Use test ads in development OR when EXPO_PUBLIC_USE_TEST_ADS is explicitly true (local test APK builds)
const isTestingAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';

export const ADMOB_IDS = {
  BANNER: isTestingAds
    ? TEST_BANNER_ID
    : (Constants.expoConfig?.extra?.ADMOB_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || REAL_BANNER_ID),

  INTERSTITIAL: isTestingAds
    ? TEST_INTERSTITIAL_ID
    : (Constants.expoConfig?.extra?.ADMOB_INTERSTITIAL_ID || process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || REAL_INTERSTITIAL_ID),

  NATIVE: isTestingAds
    ? TEST_NATIVE_ID
    : (Constants.expoConfig?.extra?.ADMOB_NATIVE_ID || process.env.EXPO_PUBLIC_ADMOB_NATIVE_ID || REAL_NATIVE_ID),

  REWARDED: isTestingAds
    ? TEST_REWARDED_ID
    : (Constants.expoConfig?.extra?.ADMOB_REWARDED_ID || process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || REAL_REWARDED_ID),
};

interface AppAdBannerProps {
  size?: any;
  containerStyle?: any;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error?: any) => void;
}

/**
 * Banner ad that returns null when running in Expo Go (no native module available)
 * or if the ad failed to fill.
 */
export const AppAdBanner: React.FC<AppAdBannerProps> = ({ size, containerStyle, onAdLoaded, onAdFailedToLoad }: AppAdBannerProps) => {
  const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    onAdFailedToLoad?.(new Error('Expo Go'));
    return null;
  }

  const [adFailed, setAdFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh banner ad every 45 seconds while user stays on the page.
  // Also automatically retries if AdMob had a temporary no-fill.
  useEffect(() => {
    const interval = setInterval(() => {
      setAdFailed(false);
      setRefreshKey((prev) => prev + 1);
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  // If live ad failed or no-fill, hide the banner until next refresh cycle
  if (adFailed) return null;

  try {
    const { BannerAd, BannerAdSize, TestIds } = require('react-native-google-mobile-ads');
    if (!BannerAd) {
      onAdFailedToLoad?.(new Error('No BannerAd'));
      return null;
    }

    const unitId = isTestingAds ? (TestIds?.BANNER || TEST_BANNER_ID) : ADMOB_IDS.BANNER;

    return (
      <View style={[styles.container, containerStyle]}>
        <BannerAd
          key={`${unitId}-${refreshKey}`}
          unitId={unitId}
          size={size || BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          onAdLoaded={() => {
            setAdFailed(false);
            onAdLoaded?.();
          }}
          onAdFailedToLoad={(error: any) => {
            console.log(`Banner Ad failed with unit ${unitId}:`, error?.message || error);
            setAdFailed(true);
            onAdFailedToLoad?.(error);
          }}
        />
      </View>
    );
  } catch (e) {
    console.log('AdMob component could not be loaded:', e);
    onAdFailedToLoad?.(e);
    return null;
  }
};
interface AppInterstitialAdProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Fullscreen Interstitial Ad component.
 * Attempts to load and show Google AdMob interstitial.
 * If AdMob fails, has no fill, or in Expo Go, closes immediately without blocking.
 */
export const AppInterstitialAd: React.FC<AppInterstitialAdProps> = ({ visible, onClose }) => {
  useEffect(() => {
    if (!visible) return;

    const isExpoGo =
      Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      onClose();
      return;
    }

    try {
      const { InterstitialAd, AdEventType, TestIds } = require('react-native-google-mobile-ads');
      const unitId = isTestingAds ? (TestIds?.INTERSTITIAL || TEST_INTERSTITIAL_ID) : ADMOB_IDS.INTERSTITIAL;

      let hasResponded = false;

      const finish = () => {
        if (!hasResponded) {
          hasResponded = true;
          onClose();
        }
      };

      const interstitial = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (!hasResponded) {
          interstitial.show().catch((err: any) => {
            console.log('Failed to show interstitial:', err);
            finish();
          });
        }
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        finish();
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log(`Interstitial load error on unit ${unitId}:`, error?.message || error);
        finish();
      });

      interstitial.load();

      // 4-second safety timeout for loading the real ad. Proceed to video if AdMob has no fill.
      const loadTimeout = setTimeout(() => {
        finish();
      }, 4000);

      return () => {
        clearTimeout(loadTimeout);
        try {
          unsubscribeLoaded();
          unsubscribeClosed();
          unsubscribeError();
        } catch {}
      };
    } catch (err) {
      console.log('Error loading AdMob Interstitial:', err);
      onClose();
    }
  }, [visible]);

  return null;
};


const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
    overflow: 'visible',
    alignSelf: 'center',
  },
});

/**
 * Native Ad component that renders a high-eCPM sponsored card.
 * Returns null in Expo Go or if the ad fails to load / fill.
 */
export const AppNativeAd: React.FC<{
  style?: any;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error?: any) => void;
}> = ({ style, onAdLoaded, onAdFailedToLoad }) => {
  const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    onAdFailedToLoad?.(new Error('Expo Go'));
    return null;
  }

  const [nativeAd, setNativeAd] = useState<any>(null);
  const [adFailed, setAdFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchNativeAd = () => {
      try {
        const { NativeAd, TestIds } = require('react-native-google-mobile-ads');
        const unitId = isTestingAds ? (TestIds?.NATIVE || TEST_NATIVE_ID) : ADMOB_IDS.NATIVE;

        NativeAd.createForAdRequest(unitId, {
          requestNonPersonalizedAdsOnly: false,
        })
          .then((ad: any) => {
            if (isMounted && ad) {
              setNativeAd((prevAd: any) => {
                // Destroy previous ad instance to avoid memory accumulation
                try {
                  prevAd?.destroy?.();
                } catch {}
                return ad;
              });
              setAdFailed(false);
              onAdLoaded?.();
            }
          })
          .catch((err: any) => {
            console.log(`Native Ad failed to load (${unitId}):`, err?.message || err);
            if (isMounted) {
              // Only mark failed if we have never loaded an ad before (keep existing ad visible if refresh fails)
              setNativeAd((currentAd: any) => {
                if (!currentAd) setAdFailed(true);
                return currentAd;
              });
              onAdFailedToLoad?.(err);
            }
          });
      } catch (e) {
        if (isMounted) {
          setNativeAd((currentAd: any) => {
            if (!currentAd) setAdFailed(true);
            return currentAd;
          });
          onAdFailedToLoad?.(e);
        }
      }
    };

    // Load initial native ad
    fetchNativeAd();

    // Auto-refresh native ad every 45 seconds while user is on this screen
    const interval = setInterval(() => {
      if (isMounted) {
        fetchNativeAd();
      }
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (adFailed && !nativeAd) return null;
  if (!nativeAd) return null;

  try {
    const {
      NativeAdView,
      NativeAsset,
      NativeAssetType,
      NativeMediaView,
    } = require('react-native-google-mobile-ads');

    return (
      <View style={[nativeCardStyles.container, style]}>
        <NativeAdView nativeAd={nativeAd} style={nativeCardStyles.card}>
          <View style={nativeCardStyles.mediaWrap}>
            <NativeMediaView style={nativeCardStyles.media} resizeMode="cover" />
            <View style={nativeCardStyles.badge}>
              <Text style={nativeCardStyles.badgeText}>SPONSORED</Text>
            </View>
          </View>

          <View style={nativeCardStyles.contentRow}>
            {Boolean(nativeAd.icon?.url) && (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image
                  source={{ uri: nativeAd.icon.url }}
                  style={nativeCardStyles.icon}
                  contentFit="cover"
                />
              </NativeAsset>
            )}

            <View style={nativeCardStyles.textWrap}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={nativeCardStyles.headline} numberOfLines={2}>
                  {nativeAd.headline}
                </Text>
              </NativeAsset>

              {Boolean(nativeAd.advertiser || nativeAd.body) && (
                <NativeAsset assetType={NativeAssetType.BODY}>
                  <Text style={nativeCardStyles.advertiser} numberOfLines={1}>
                    {nativeAd.advertiser || nativeAd.body}
                  </Text>
                </NativeAsset>
              )}
            </View>

            {Boolean(nativeAd.callToAction) && (
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <TouchableOpacity style={nativeCardStyles.ctaBtn} activeOpacity={0.85}>
                  <Text style={nativeCardStyles.ctaText}>{nativeAd.callToAction}</Text>
                </TouchableOpacity>
              </NativeAsset>
            )}
          </View>
        </NativeAdView>
      </View>
    );
  } catch (err) {
    return null;
  }
};

const nativeCardStyles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1E1E1E',
    position: 'relative',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF7A00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  textWrap: {
    flex: 1,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 18,
  },
  advertiser: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  ctaBtn: {
    backgroundColor: '#FF7A00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

/**
 * Loads and shows an AdMob Rewarded Ad.
 * Only triggers onRewardEarned if Google Mobile Ads fires the EARNED_REWARD event.
 * If user skips, cancels, or the ad fails, onRewardEarned is NEVER called.
 */
export const loadAndShowRewardedAd = ({
  onLoaded,
  onRewardEarned,
  onDismiss,
  onError,
}: {
  onLoaded?: () => void;
  onRewardEarned: (reward?: any) => void;
  onDismiss?: () => void;
  onError?: (err: any) => void;
}): (() => void) => {
  const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

  if (isExpoGo) {
    if (onError) onError(new Error('No rewarded ad available right now. Please try again in a few moments.'));
    return () => {};
  }

  try {
    const { RewardedAd, RewardedAdEventType, AdEventType, TestIds } = require('react-native-google-mobile-ads');
    const unitId = isTestingAds ? (TestIds?.REWARDED || TEST_REWARDED_ID) : ADMOB_IDS.REWARDED;

    const rewarded = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubs: Array<() => void> = [];

    unsubs.push(
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        if (onLoaded) onLoaded();
        rewarded.show().catch((err: any) => {
          console.log('Failed to show rewarded ad:', err);
          if (onError) onError(err);
        });
      })
    );

    unsubs.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward: any) => {
        onRewardEarned(reward);
      })
    );

    unsubs.push(
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        if (onDismiss) onDismiss();
      })
    );

    unsubs.push(
      rewarded.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log(`Rewarded ad error on unit ${unitId}:`, error?.message || error);
        if (onError) onError(error);
      })
    );

    rewarded.load();

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  } catch (err) {
    console.log('Error creating rewarded ad:', err);
    if (onError) onError(err);
    return () => {};
  }
};

