import React from 'react';
import { View, ScrollView, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAdBanner } from './AppAds';

interface BannerAdModalFrameProps {
  children: React.ReactNode;
  /** Backdrop style of the modal (colour, horizontal padding). Layout is handled here. */
  overlayStyle?: StyleProp<ViewStyle>;
}

/**
 * Modal backdrop with a banner ad pinned to the top and bottom edges of the screen and the
 * modal box centred between them. If the box is taller than the space left, it scrolls.
 */
export default function BannerAdModalFrame({ children, overlayStyle }: BannerAdModalFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[overlayStyle, styles.frame]}>
      <View style={[styles.edge, { paddingTop: insets.top }]}>
        <AppAdBanner containerStyle={styles.banner} />
      </View>

      <ScrollView
        style={styles.middle}
        contentContainerStyle={styles.middleContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <View style={[styles.edge, { paddingBottom: insets.bottom }]}>
        <AppAdBanner containerStyle={styles.banner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Banners use the full screen width; only the modal box keeps the side padding
  frame: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  edge: {
    width: '100%',
    alignItems: 'center',
  },
  banner: {
    paddingVertical: 4,
  },
  middle: {
    flex: 1,
  },
  middleContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
