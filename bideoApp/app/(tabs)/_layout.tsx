import React, { useEffect, useState, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  TouchableOpacity,
  DeviceEventEmitter,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformPressable } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import api from '../../services/api';
import { hapticSelection } from '../../utils/haptics';

const CustomUploadTabButton: React.FC<{ onPress?: () => void }> = ({ onPress }) => {
  return (
    <View style={styles.centerTabSlot} pointerEvents="box-none">
      <TouchableOpacity
        onPress={() => {
          hapticSelection();
          onPress?.();
        }}
        activeOpacity={0.85}
        style={styles.uploadButtonTouchable}
        accessibilityRole="button"
        accessibilityLabel="Upload"
      >
        {/* Same row as the other tabs: icon on the icon line, label on the label line */}
        <LinearGradient
          colors={['#FFA033', '#FF7A00', '#F35500']}
          style={styles.uploadButtonGradient}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.uploadButtonLabel}>Upload</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 0);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data?.success && typeof res.data?.count === 'number') {
        setUnreadCount(res.data.count);
      }
    } catch {
      // ignore network errors
    }
  }, [isAuthenticated]);

  const fetchUnreadChatCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadChatCount(0);
      return;
    }
    try {
      const res = await api.get('/chat/unread-count');
      if (res.data?.success && typeof res.data?.count === 'number') {
        setUnreadChatCount(res.data.count);
      }
    } catch {
      // ignore network errors
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnreadCount();
    fetchUnreadChatCount();

    const subViewed = DeviceEventEmitter.addListener('notificationsViewed', () => {
      setUnreadCount(0);
    });

    const subRefresh = DeviceEventEmitter.addListener('refreshNotificationCount', () => {
      fetchUnreadCount();
    });

    const subChatCount = DeviceEventEmitter.addListener('chatUnreadCountUpdated', (count: number) => {
      setUnreadChatCount(count);
    });

    const subChatMsg = DeviceEventEmitter.addListener('chatMessageReceived', () => {
      fetchUnreadChatCount();
    });

    const subChatConv = DeviceEventEmitter.addListener('chatConversationUpdated', () => {
      fetchUnreadChatCount();
    });

    const subChatViewed = DeviceEventEmitter.addListener('chatViewed', () => {
      fetchUnreadChatCount();
    });

    const interval = setInterval(() => {
      if (isAuthenticated) {
        fetchUnreadCount();
        fetchUnreadChatCount();
      }
    }, 30000);

    return () => {
      subViewed.remove();
      subRefresh.remove();
      subChatCount.remove();
      subChatMsg.remove();
      subChatConv.remove();
      subChatViewed.remove();
      clearInterval(interval);
    };
  }, [fetchUnreadCount, fetchUnreadChatCount, isAuthenticated]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF7A00',
        tabBarInactiveTintColor: '#1E293B',
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            style={[
              props.style,
              styles.tabBarItemButton,
            ]}
          />
        ),
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          marginTop: 1,
          marginBottom: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '600',
          marginTop: 0,
          marginBottom: 1,
          letterSpacing: 0.1,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEEEE',
          height: 54 + safeBottom,
          paddingTop: 2,
          paddingBottom: safeBottom,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
          overflow: 'visible',
        },
        headerStyle: {
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: '#EEEEEE',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: Colors.text,
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => DeviceEventEmitter.emit('scrollHomeToTop')}
            >
              <Image
                source={require('../../assets/app-logo.png')}
                style={{ width: 120, height: 40 }}
                contentFit="contain"
              />
            </TouchableOpacity>
          ),
          headerTitleAlign: 'left',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={{ marginRight: 12 }} onPress={() => router.push('/search')}>
                <Ionicons name="search" size={24} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginRight: 14, position: 'relative' }}
                onPress={() => router.push('/chat')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="comment-text-multiple-outline" size={24} color="#EA580C" />
                {unreadChatCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -7,
                      minWidth: 17,
                      height: 17,
                      borderRadius: 8.5,
                      backgroundColor: '#FF3B30',
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 3,
                      borderWidth: 1.5,
                      borderColor: Colors.white,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}
                    >
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginRight: 15, position: 'relative' }}
                onPress={() => {
                  setUnreadCount(0);
                  router.push('/notifications');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={24} color={Colors.text} />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -7,
                      minWidth: 17,
                      height: 17,
                      borderRadius: 8.5,
                      backgroundColor: '#FF3B30',
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 3,
                      borderWidth: 1.5,
                      borderColor: Colors.white,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.white,
                        fontSize: 9.5,
                        fontWeight: '800',
                        textAlign: 'center',
                        includeFontPadding: false,
                      }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ),
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={26} color={color} />
          ),
        }}
        listeners={() => ({
          tabPress: () => {
            DeviceEventEmitter.emit('scrollHomeToTop');
          },
        })}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="play-circle-outline" size={26} color={color} />
          ),
        }}
        listeners={() => ({
          tabPress: () => {
            DeviceEventEmitter.emit('resetShortsFeedToGlobal');
          },
        })}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarLabel: () => null,
          tabBarButton: () => (
            <CustomUploadTabButton onPress={() => router.push('/upload')} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Ensure we go to the upload screen without any params
            e.preventDefault();
            router.push('/upload');
          },
        }}
      />
      <Tabs.Screen
        name="followings"
        options={{
          title: 'Following',
          tabBarIcon: ({ color }) => (
            <Ionicons name="copy-outline" size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => (
            <Ionicons name="library-outline" size={25} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarItemButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  uploadButtonTouchable: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sized like the other tab icons so the row lines up
  uploadButtonGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  // Matches tabBarLabelStyle and the inactive tint used by the other tabs
  uploadButtonLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: '#1E293B',
  },
});
