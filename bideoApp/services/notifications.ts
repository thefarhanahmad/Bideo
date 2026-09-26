import { Platform, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { getActiveConversationId } from './socket';

// 1. Configure foreground notification behavior: suppress if user is logged out or inside active chat
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // If user is completely logged out, never show foreground alert/sound
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    const data = (notification?.request?.content?.data || {}) as Record<string, any>;
    const activeConv = getActiveConversationId();

    if (
      activeConv &&
      (data?.conversationId?.toString() === activeConv ||
        (typeof data?.screen === 'string' && data.screen.includes(`/chat/${activeConv}`)))
    ) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * Robust notification navigation handler that resolves videos, shorts, posts, channels, and chats
 */
export function handleNotificationNavigation(router: any, data: any) {
  if (!data || !router) return;

  const isShort = data.isShort === true || data.isShort === 'true';
  const videoId =
    data.videoId ||
    (typeof data.screen === 'string'
      ? data.screen.match(/(?:\/video\/|\/v\/|initialShortId=)([a-zA-Z0-9_-]+)/)?.[1]
      : null);
  const postId =
    data.postId ||
    (typeof data.screen === 'string'
      ? data.screen.match(/(?:\/post\/|\/p\/)([a-zA-Z0-9_-]+)/)?.[1]
      : null);
  const channelId =
    data.channelId ||
    (typeof data.screen === 'string'
      ? data.screen.match(/(?:\/channel\/|\/c\/)([a-zA-Z0-9_-]+)/)?.[1]
      : null);
  const conversationId =
    data.conversationId ||
    (typeof data.screen === 'string'
      ? data.screen.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1]
      : null);

  try {
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    } else if ((isShort || (typeof data.screen === 'string' && data.screen.includes('/shorts'))) && videoId) {
      router.push({ pathname: '/shorts', params: { initialShortId: videoId } });
    } else if (videoId) {
      router.push(`/video/${videoId}`);
    } else if (postId) {
      router.push(`/post/${postId}`);
    } else if (channelId) {
      router.push(`/channel/${channelId}`);
    } else if (data.screen) {
      router.push(data.screen);
    } else {
      router.push('/notifications');
    }
  } catch (err) {
    console.error('Error executing notification navigation:', err);
  }
}

/**
 * Register device with Expo & backend for real mobile push notifications
 */
export async function registerForPushNotificationsAsync(retryCount = 0): Promise<string | null> {
  try {
    const isExpoGo =
      Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.log('Skipping remote push notification registration in Expo Go (only supported in standalone/dev builds)');
      return null;
    }

    // 2. Set up Android Notification Channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bideo Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF7A00',
        sound: 'default',
        enableVibrate: true,
      });
    }

    // 3. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permissions denied by user');
      api.post('/auth/push-token-log', { stage: 'permission_denied', status: finalStatus }).catch(() => {});
      return null;
    }

    // 4. Get Expo Push Token using project ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      'c9d54950-dd5f-4e87-bf77-fcc184d8bcf7';

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenData?.data;
    if (!pushToken) {
      api.post('/auth/push-token-log', { stage: 'token_empty' }).catch(() => {});
      return null;
    }

    console.log('Device Push Token acquired:', pushToken);

    // 5. Save locally and send to backend
    await AsyncStorage.setItem('push_token', pushToken);

    // Sync with backend API
    await api.put('/auth/push-token', { pushToken }).catch((err) => {
      console.log('Failed to sync push token with backend:', err?.message || err);
      api.post('/auth/push-token-log', {
        stage: 'backend_sync_failed',
        error: err?.response?.data?.message || err?.message || String(err),
        token: pushToken,
      }).catch(() => {});
    });

    api.post('/auth/push-token-log', { stage: 'registered_successfully', token: pushToken }).catch(() => {});

    return pushToken;
  } catch (err: any) {
    console.warn('Error in registerForPushNotificationsAsync:', err);
    api.post('/auth/push-token-log', {
      stage: 'token_fetch_error',
      error: err?.message || String(err),
    }).catch(() => {});

    // Retry once after 3 seconds if transient
    if (retryCount < 1) {
      setTimeout(() => {
        registerForPushNotificationsAsync(retryCount + 1).catch(() => {});
      }, 3000);
    }
    return null;
  }
}

/**
 * Setup tap handler when user taps a push notification from lock screen or status bar
 */
export function setupNotificationListeners(router: any) {
  const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    return () => {};
  }

  // Check if app was launched from cold-start by tapping a notification
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        setTimeout(() => {
          handleNotificationNavigation(router, data);
        }, 800);
      }
    })
    .catch(() => {});

  // Listener for when a user clicks/taps the notification while app is running/backgrounded
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data = response.notification.request.content.data;
      console.log('User tapped push notification with data:', data);
      handleNotificationNavigation(router, data);
    } catch (err) {
      console.error('Error handling notification tap navigation:', err);
    }
  });

  // Listener for when a notification is received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
    DeviceEventEmitter.emit('refreshNotificationCount');
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}
