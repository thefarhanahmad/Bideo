import React, { useEffect, useState, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TouchableOpacity, DeviceEventEmitter, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useSelector } from 'react-redux';
import Colors from '../../constants/Colors';
import { RootState } from '../../redux/store';
import api from '../../services/api';

export default function TabsLayout() {
  const router = useRouter();
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
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textGray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
        },
        headerStyle: {
          backgroundColor: Colors.white,
        },
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={40} color={Colors.primary} />
          ),
          tabBarLabel: () => null,
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
          title: 'Followings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="copy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: 15 }} 
              onPress={() => {
                // We'll trigger a logout via a custom event or shared state if needed, 
                // but for now let's keep it simple or use a better way.
                // Actually, it's easier to handle logout in the screen itself if it has its own header.
              }}
            >
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
