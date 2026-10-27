import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { AppAdBanner } from './AppAds';

/**
 * Banner ad that stays put while the screen's content scrolls. Same look as the Notifications
 * screen's bottom banner.
 * - 'bottom' (default): last child of the screen's full-height container; leaves room for the
 *   phone's navigation bar (the app is edge-to-edge).
 * - 'top': place it right under a fixed header, for screens where the bottom is busy
 *   (forms with a keyboard, a submit button at the end).
 */
export default function StickyBannerAd({ position = 'bottom' }: { position?: 'top' | 'bottom' }) {
  const insets = useSafeAreaInsets();
  const isTop = position === 'top';
  return (
    <View style={[styles.wrapper, isTop ? styles.top : [styles.bottom, { paddingBottom: insets.bottom }]]}>
      <AppAdBanner containerStyle={styles.banner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  top: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  banner: {
    paddingVertical: 4,
    marginVertical: 0,
  },
});
