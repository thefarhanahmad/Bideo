import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertData = {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
};

// Singleton bridge so any module can trigger an alert with the same call shape
// as React Native's Alert.alert(title, message, buttons).
let emit: ((data: AlertData) => void) | null = null;

export function showAlert(title?: string, message?: string, buttons?: AlertButton[]) {
  if (emit) emit({ title, message, buttons });
  // If the host isn't mounted yet (extremely early), fail silently rather than crash.
}

const pickIcon = (data: AlertData | null): { name: any; color: string; bg: string } => {
  const hasDestructive = data?.buttons?.some((b) => b.style === 'destructive');
  const t = (data?.title || '').toLowerCase();
  if (hasDestructive || t.includes('delete') || t.includes('remove')) {
    return { name: 'warning', color: '#EF4444', bg: '#FEE2E2' };
  }
  if (t.includes('success') || t.includes('published') || t.includes('uploaded') || t.includes('updated')) {
    return { name: 'checkmark-circle', color: '#10B981', bg: '#D1FAE5' };
  }
  if (
    t.includes('fail') ||
    t.includes('error') ||
    t.includes('denied') ||
    t.includes('invalid') ||
    t.includes('unable') ||
    t.includes('limit')
  ) {
    return { name: 'alert-circle', color: '#EF4444', bg: '#FEE2E2' };
  }
  return { name: 'information-circle', color: Colors.primary, bg: Colors.primary + '1A' };
};

export function AlertHost() {
  const [data, setData] = useState<AlertData | null>(null);

  useEffect(() => {
    emit = (d) => setData(d);
    return () => {
      emit = null;
    };
  }, []);

  const close = useCallback(() => setData(null), []);

  const buttons: AlertButton[] =
    data?.buttons && data.buttons.length ? data.buttons : [{ text: 'OK' }];

  const handlePress = (btn: AlertButton) => {
    close();
    // Defer so the modal can dismiss before any navigation in onPress runs.
    if (btn.onPress) setTimeout(btn.onPress, 0);
  };

  const icon = pickIcon(data);
  const isRow = buttons.length === 2;

  return (
    <Modal visible={!!data} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={22} color={icon.color} />
          </View>

          {!!data?.title && <Text style={styles.title}>{data.title}</Text>}
          {!!data?.message && <Text style={styles.message}>{data.message}</Text>}

          <View style={[styles.actions, isRow ? styles.actionsRow : styles.actionsCol]}>
            {buttons.map((btn, i) => {
              const destructive = btn.style === 'destructive';
              const cancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={`${btn.text}-${i}`}
                  activeOpacity={0.85}
                  onPress={() => handlePress(btn)}
                  style={[
                    styles.btn,
                    isRow && styles.btnFlex,
                    cancel ? styles.btnCancel : destructive ? styles.btnDestructive : styles.btnPrimary,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      cancel ? styles.btnCancelText : styles.btnSolidText,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Compact dialog: 16px corners, 44px icon, 17/14px text, 42px buttons with 10px corners
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textGray,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    marginTop: 18,
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionsCol: {
    flexDirection: 'column',
  },
  btn: {
    minHeight: 42,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFlex: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnDestructive: {
    backgroundColor: '#EF4444',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnSolidText: {
    color: Colors.white,
  },
  btnCancelText: {
    color: Colors.text,
  },
});

export default AlertHost;
