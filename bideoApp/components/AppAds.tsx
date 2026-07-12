import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Modal, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

// Configure AdMob IDs here. Replace with your actual IDs in production.
export const ADMOB_IDS = {
  BANNER: __DEV__ 
    ? (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111')
    : (Constants.expoConfig?.extra?.ADMOB_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || 'your-production-banner-id'),
    
  INTERSTITIAL: __DEV__
    ? (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712')
    : (Constants.expoConfig?.extra?.ADMOB_INTERSTITIAL_ID || process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'your-production-interstitial-id'),
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

  useEffect(() => {
    if (!visible) return;

    setAdTimeRemaining(5);
    setCanClose(false);
    setShowingRealAd(false);
    setRealAdFailed(false);

    const isExpoGo = Constants.appOwnership === 'expo';
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
        triggerSuccess();
        interstitial.show().catch((err: any) => {
          console.log('Failed to show interstitial:', err);
          triggerFallback();
        });
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        onClose();
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log('Interstitial load error:', error);
        triggerFallback();
      });

      interstitial.load();

      // 4-second safety timeout for loading the real ad. Fallback to mock ad if it takes too long.
      const loadTimeout = setTimeout(() => {
        triggerFallback();
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

  if (!visible) return null;
  if (showingRealAd) return null; // Real ad is presented on top by the native SDK

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={adStyles.adModalContainer}>
        <View style={adStyles.adModalContent}>
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
          <View style={adStyles.adBody}>
            <Ionicons name="gift-outline" size={70} color="#FFD700" style={adStyles.adIcon} />
            <Text style={adStyles.adTitle}>Tube India Premium</Text>
            <Text style={adStyles.adDescription}>
              Enjoy background video playback, offline downloads, and an completely ad-free experience. Support Tube India today!
            </Text>
          </View>

          {/* Footer Call to Action */}
          <TouchableOpacity style={adStyles.ctaButton} onPress={onClose}>
            <Text style={adStyles.ctaText}>TRY 1 MONTH FREE</Text>
          </TouchableOpacity>
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
  adIcon: {
    marginBottom: 16,
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
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
});
