import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure AdMob IDs here. Replace with your actual IDs in production.
export const ADMOB_IDS = {
  BANNER: __DEV__ 
    ? (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/6300978111')
    : (Constants.expoConfig?.extra?.ADMOB_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || 'your-production-banner-id'),
    
  INTERSTITIAL: __DEV__
    ? (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-3940256099942544/1033173712')
    : (Constants.expoConfig?.extra?.ADMOB_INTERSTITIAL_ID || process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'your-production-interstitial-id'),
    
  REWARDED: __DEV__
    ? (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917')
    : (Constants.expoConfig?.extra?.ADMOB_REWARDED_ID || process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || 'your-production-rewarded-id'),
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

/**
 * Show an Interstitial ad safely (falls back automatically in Expo Go or if it fails to load).
 * @param onAdClosed Callback when ad is closed or finished, so app flow can continue.
 */
export const showAppInterstitialAd = (onAdClosed: () => void) => {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    console.log('Expo Go — bypassing Interstitial Ad');
    onAdClosed();
    return;
  }

  try {
    const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
    const adUnitId = ADMOB_IDS.INTERSTITIAL;
    
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    let hasResponded = false;
    const triggerClose = () => {
      if (!hasResponded) {
        hasResponded = true;
        onAdClosed();
      }
    };

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitial.show().catch((err: any) => {
        console.log('Failed to show interstitial:', err);
        triggerClose();
      });
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      triggerClose();
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.log('Interstitial load error:', error);
      triggerClose();
    });

    interstitial.load();

    // Set a safety timeout of 6 seconds. If ad fails to load, bypass it.
    const safetyTimeout = setTimeout(() => {
      triggerClose();
    }, 6000);

    return () => {
      clearTimeout(safetyTimeout);
      try {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      } catch {}
    };
  } catch (err) {
    console.log('Error showing Interstitial ad:', err);
    onAdClosed();
  }
};

/**
 * Show a Rewarded ad safely.
 */
export const showAppRewardedAd = (onAdClosed: () => void) => {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    console.log('Expo Go — bypassing Rewarded Ad');
    onAdClosed();
    return;
  }

  try {
    const { RewardedAd, AdEventType } = require('react-native-google-mobile-ads');
    const adUnitId = ADMOB_IDS.REWARDED;
    
    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    let hasResponded = false;
    const triggerClose = () => {
      if (!hasResponded) {
        hasResponded = true;
        onAdClosed();
      }
    };

    const unsubscribeLoaded = rewarded.addAdEventListener(AdEventType.LOADED, () => {
      rewarded.show().catch((err: any) => {
        console.log('Failed to show rewarded ad:', err);
        triggerClose();
      });
    });

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      triggerClose();
    });

    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.log('Rewarded load error:', error);
      triggerClose();
    });

    rewarded.load();

    // Set a safety timeout of 6 seconds.
    const safetyTimeout = setTimeout(() => {
      triggerClose();
    }, 6000);

    return () => {
      clearTimeout(safetyTimeout);
      try {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      } catch {}
    };
  } catch (err) {
    console.log('Error showing Rewarded ad:', err);
    onAdClosed();
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
