import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';

// Small "+1 🪙" pill shown when coins are credited while watching. Mount <CoinRewardHost /> once
// (root layout) and call showCoinReward(amount) from anywhere. Rewards arriving while it is on
// screen add up into one pill. It never blocks touches.
const HOLD_MS = 1500;

let emit: ((amount: number) => void) | null = null;

export function showCoinReward(amount?: number) {
  const value = Number(amount) || 0;
  if (value > 0 && emit) emit(value);
}

const formatAmount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function CoinRewardHost() {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(0);
  const enter = useRef(new Animated.Value(0)).current; // 0 hidden -> 1 shown
  const leave = useRef(new Animated.Value(0)).current; // 0 in place -> 1 floated away
  const coinPop = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);

  const hide = useCallback(() => {
    Animated.timing(leave, { toValue: 1, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished) return;
        visibleRef.current = false;
        setAmount(0);
        enter.setValue(0);
        leave.setValue(0);
      }
    );
  }, [enter, leave]);

  const show = useCallback(
    (value: number) => {
      setAmount((prev) => (visibleRef.current ? prev + value : value));
      leave.stopAnimation();
      leave.setValue(0);
      if (!visibleRef.current) {
        visibleRef.current = true;
        enter.setValue(0);
        Animated.spring(enter, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
      }
      coinPop.setValue(0.6);
      Animated.spring(coinPop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, HOLD_MS);
    },
    [enter, leave, coinPop, hide]
  );

  useEffect(() => {
    emit = show;
    return () => {
      if (emit === show) emit = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [show]);

  if (amount <= 0) return null;

  const translateY = Animated.add(
    enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [0, -30] })
  );
  const opacity = Animated.multiply(enter, leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View pointerEvents="none" style={[styles.layer, { top: insets.top + 10 }]}>
      <Animated.View style={[styles.pill, { opacity, transform: [{ translateY }, { scale }] }]}>
        <Animated.Text style={[styles.coin, { transform: [{ scale: coinPop }] }]}>🪙</Animated.Text>
        <Text style={styles.text}>
          +{formatAmount(amount)} {amount === 1 ? 'coin' : 'coins'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.85)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '66',
  },
  coin: {
    fontSize: 18,
    marginRight: 6,
  },
  text: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
