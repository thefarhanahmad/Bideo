import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

/** Branded empty state: soft icon circle + title + optional subtitle. */
export const EmptyState = ({
  icon = 'sad-outline',
  title,
  subtitle,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
}) => (
  <View style={styles.emptyWrap}>
    <View style={styles.iconCircle}>
      <Ionicons name={icon} size={38} color={Colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {!!subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

/** A single pulsing grey box. */
export const Shimmer = ({ style }: { style?: any }) => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.shimmer, style, { opacity }]} />;
};

/** Skeleton placeholder matching the VideoCard layout. */
export const VideoListSkeleton = ({ count = 4 }: { count?: number }) => (
  <View style={{ paddingTop: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.card}>
        <Shimmer style={styles.thumb} />
        <View style={styles.row}>
          <Shimmer style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Shimmer style={styles.lineLg} />
            <Shimmer style={styles.lineSm} />
          </View>
        </View>
      </View>
    ))}
  </View>
);

/** Skeleton placeholder for Video Details screen below the player. */
export const VideoDetailSkeleton = () => (
  <View style={styles.detailSkeletonWrap}>
    <Shimmer style={{ width: '92%', height: 20, marginBottom: 8, borderRadius: 6 }} />
    <Shimmer style={{ width: '60%', height: 16, marginBottom: 14, borderRadius: 6 }} />
    <Shimmer style={{ width: '40%', height: 12, marginBottom: 16, borderRadius: 4 }} />

    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
      <Shimmer style={{ width: 75, height: 36, borderRadius: 999 }} />
      <Shimmer style={{ width: 55, height: 36, borderRadius: 999 }} />
      <Shimmer style={{ width: 75, height: 36, borderRadius: 999 }} />
      <Shimmer style={{ width: 70, height: 36, borderRadius: 999 }} />
    </View>

    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0F0', marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Shimmer style={{ width: 42, height: 42, borderRadius: 21 }} />
        <View>
          <Shimmer style={{ width: 110, height: 14, marginBottom: 6, borderRadius: 4 }} />
          <Shimmer style={{ width: 70, height: 10, borderRadius: 4 }} />
        </View>
      </View>
      <Shimmer style={{ width: 85, height: 32, borderRadius: 20 }} />
    </View>

    <Shimmer style={{ width: '100%', height: 68, borderRadius: 12, marginBottom: 18 }} />
    <Shimmer style={{ width: 130, height: 18, marginBottom: 14, borderRadius: 4 }} />

    {Array.from({ length: 3 }).map((_, i) => (
      <View key={i} style={{ marginBottom: 16 }}>
        <Shimmer style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Shimmer style={{ width: 36, height: 36, borderRadius: 18 }} />
          <View style={{ flex: 1 }}>
            <Shimmer style={{ width: '85%', height: 14, marginBottom: 6, borderRadius: 4 }} />
            <Shimmer style={{ width: '50%', height: 11, borderRadius: 4 }} />
          </View>
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 70,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  shimmer: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 16,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: 200,
    borderRadius: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  lineLg: {
    height: 12,
    width: '85%',
    marginBottom: 8,
  },
  lineSm: {
    height: 10,
    width: '55%',
  },
  detailSkeletonWrap: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: Colors.white,
  },
});
