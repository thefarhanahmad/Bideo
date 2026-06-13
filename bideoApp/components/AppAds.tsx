import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { BannerAdSize } from 'react-native-google-mobile-ads';

// Ad unit id: prefer configured extra or env; fall back to test id in dev
const configAdUnit = (Constants.expoConfig?.extra || Constants.manifest?.extra || ({} as any))?.ADMOB_BANNER_ID || process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
const adUnitId = __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : (configAdUnit || (Platform.OS === 'ios' ? 'your-ios-banner-id' : 'your-android-banner-id'));

interface AppAdBannerProps {
  size?: BannerAdSize;
}

/**
 * Banner ad that dynamically imports the native AdMob module and
 * returns null when running in Expo Go (no native module available).
 */
export const AppAdBanner: React.FC<AppAdBannerProps> = ({ size }: AppAdBannerProps) => {
  const [AdComponent, setAdComponent] = useState<any>(null);

  useEffect(() => {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return; // Expo Go can't load native AdMob

    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-google-mobile-ads');
        const Banner = mod?.BannerAd || (mod?.default && mod.default.BannerAd) || null;
        if (mounted && Banner) setAdComponent(() => Banner);
      } catch (e) {
        console.log('Ad module not available:', e);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (!AdComponent) return null;

  return (
    <View style={styles.container}>
      <AdComponent
        unitId={adUnitId}
        size={size || ("ANCHORED_ADAPTIVE_BANNER" as any)}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={(error: any) => console.log('Ad failed to load: ', error)}
      />
    </View>
  );
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
