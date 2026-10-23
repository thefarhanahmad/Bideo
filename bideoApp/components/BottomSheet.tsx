import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional one-line title under the grab bar (e.g. the video or playlist name) */
  title?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The app's bottom sheet: slides up over a dark overlay, grab bar, rounded top, safe-area
 * padding. Tapping the overlay closes it; tapping inside the sheet does not.
 */
export default function BottomSheet({ visible, onClose, title, children, contentStyle }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }, contentStyle]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />
          {Boolean(title) && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface SheetItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** One row in a bottom sheet menu (icon + label; destructive rows are shown in the brand colour). */
export function SheetItem({ icon, label, onPress, destructive = false }: SheetItemProps) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <Ionicons name={icon} size={24} color={destructive ? Colors.primary : Colors.text} />
      <Text style={[styles.itemText, destructive && { color: Colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** The grey "Cancel" button at the bottom of a sheet menu. */
export function SheetCancel({ onPress, label = 'Cancel' }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity style={styles.cancel} onPress={onPress}>
      <Text style={styles.cancelText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemText: {
    fontSize: 16,
    marginLeft: 15,
    color: Colors.text,
  },
  cancel: {
    marginTop: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textGray,
  },
});
