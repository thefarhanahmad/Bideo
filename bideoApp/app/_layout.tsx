import React, { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import api, { setAuthToken } from '../services/api';
import { loginSuccess, loginStart, loginFailure } from '../redux/slices/authSlice';
import { AlertHost } from '../components/AppAlert';
import AppSplash from '../components/AppSplash';
import Constants from 'expo-constants';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function Startup({ onReady }: { onReady: () => void }) {
  const dispatch = useDispatch();

  useEffect(() => {
    const init = async () => {
      const startTime = Date.now();
      try {
        // Initialize AdMob safely (skip in Expo Go or if native module missing)
        const isExpoGo = Constants.appOwnership === 'expo';
        if (!isExpoGo) {
          try {
            // Use dynamic require to prevent crash if native module is missing from binary
            const mobileAds = require('react-native-google-mobile-ads').default;
            if (mobileAds) {
              await mobileAds().initialize();
            }
          } catch (adError) {
            console.log('AdMob native module not found or failed to init:', adError);
          }
        } else {
          console.log('Expo Go detected — skipping AdMob initialization');
        }

        const token = await AsyncStorage.getItem('token');
        if (token) {
          dispatch(loginStart());
          setAuthToken(token);
          // fetch current user
          const res = await api.get('/auth/me');
          const user = res.data && res.data.data ? res.data.data : res.data;
          dispatch(loginSuccess({ user, token } as any));
        }
      } catch (err) {
        dispatch(loginFailure('Session expired'));
        console.warn('Auth bootstrap failed', err);
      } finally {
        // Ensure splash shows for at least 2 seconds
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 2000 - elapsedTime);
        setTimeout(onReady, remainingTime);
      }
    };

    init();
  }, [dispatch]);

  return null;
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  // Hide the native splash as soon as our full-screen branded splash is on
  // screen, so users see a full-bleed splash instead of the small system icon.
  const onSplashLayout = useCallback(() => {
    // Already hidden in render to avoid double splash
  }, []);

  // Hide native splash immediately so our custom AppSplash takes over
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <Provider store={store}>
      <Startup onReady={() => setAppIsReady(true)} />
      {appIsReady ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="channel/[id]" />
            <Stack.Screen name="notifications" />
          </Stack>
          <AlertHost />
        </GestureHandlerRootView>
      ) : (
        <AppSplash onLayout={onSplashLayout} />
      )}
    </Provider>
  );
}
