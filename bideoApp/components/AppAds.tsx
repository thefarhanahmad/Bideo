import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// Ad unit id: prefer configured extra or env; fall back to test id in dev
const configAdUnit = (Constants.expoConfig?.extra || Constants.manifest?.extra || ({} as any))?.ADMOB_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
const adUnitId = __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : (configAdUnit || (Platform.OS === 'ios' ? 'your-ios-banner-id' : 'your-android-banner-id'));

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
          unitId={adUnitId}
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
