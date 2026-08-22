import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import api, { setAuthToken } from '../services/api';
import { loginSuccess, loginStart, loginFailure } from '../redux/slices/authSlice';
import { AlertHost } from '../components/AppAlert';
import Constants from 'expo-constants';

// Keep native splash screen visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {});

function Startup({ onReady }: { onReady: () => void }) {
  const dispatch = useDispatch();

  useEffect(() => {
    const init = async () => {
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
      } catch (err: any) {
        await AsyncStorage.removeItem('token');
        setAuthToken(null);
        dispatch(loginFailure('Session expired'));
        if (err?.response?.status !== 401) {
          console.warn('Auth bootstrap error:', err?.message || err);
        }
      } finally {
        onReady();
      }
    };

    init();
  }, [dispatch, onReady]);

  return null;
}

function DeletionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated && user?.deletionScheduled && pathname !== '/account-recovery') {
      router.replace('/account-recovery');
    }
  }, [isAuthenticated, user?.deletionScheduled, pathname, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  const handleAppReady = useCallback(async () => {
    setAppIsReady(true);
    await SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <Provider store={store}>
      <Startup onReady={handleAppReady} />
      {appIsReady ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <DeletionGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="channel/[id]" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="upload-video" />
              <Stack.Screen name="upload-post" />
              <Stack.Screen name="settings/privacy" />
              <Stack.Screen name="settings/delete-profile" />
              <Stack.Screen name="account-recovery" />
            </Stack>
            <AlertHost />
          </DeletionGuard>
        </GestureHandlerRootView>
      ) : null}
    </Provider>
  );
}
