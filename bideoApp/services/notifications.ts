import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// 1. Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register device with Expo & backend for real mobile push notifications
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const isExpoGo =
      Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.log('Skipping remote push notification registration in Expo Go (only supported in standalone/dev builds)');
      return null;
    }

    // Push notifications require a physical device on Android
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
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
    if (!pushToken) return null;

    console.log('Device Push Token acquired:', pushToken);

    // 5. Save locally and send to backend
    const cachedToken = await AsyncStorage.getItem('push_token');
    if (cachedToken !== pushToken) {
      await AsyncStorage.setItem('push_token', pushToken);
    }

    // Sync with backend API
    await api.put('/auth/push-token', { pushToken }).catch((err) => {
      console.log('Failed to sync push token with backend:', err?.message || err);
    });

    return pushToken;
  } catch (err) {
    console.warn('Error in registerForPushNotificationsAsync:', err);
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
        if (data?.videoId) {
          setTimeout(() => {
            try {
              router.push(`/video/${data.videoId}`);
            } catch (err) {
              console.error('Error navigating on cold-start notification:', err);
            }
          }, 800);
        } else if (data?.screen) {
          setTimeout(() => {
            try {
              router.push(data.screen);
            } catch (err) {
              console.error('Error navigating on cold-start notification:', err);
            }
          }, 800);
        }
      }
    })
    .catch(() => {});

  // Listener for when a user clicks/taps the notification while app is running/backgrounded
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data = response.notification.request.content.data;
      console.log('User tapped push notification with data:', data);

      if (data?.videoId) {
        router.push(`/video/${data.videoId}`);
      } else if (data?.screen) {
        router.push(data.screen);
      } else {
        router.push('/notifications');
      }
    } catch (err) {
      console.error('Error handling notification tap navigation:', err);
    }
  });

  return () => {
    responseSubscription.remove();
  };
}
