import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerifiedBadgeProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 14,
  color = '#0095F6',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="checkmark-circle" size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 3,
  },
});

export default VerifiedBadge;
