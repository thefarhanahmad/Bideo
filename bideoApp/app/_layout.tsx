import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Fail-safe safeguard: guarantee onReady is triggered within 1500ms max to prevent OS watchdog kills
    const fallbackTimer = setTimeout(() => {
      onReady();
    }, 1500);

    const init = async () => {
      try {
        // 1. Initialize AdMob non-blocking in background (skip in Expo Go)
        const isExpoGo =
          Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          try {
            const mobileAds = require('react-native-google-mobile-ads').default;
            if (mobileAds) {
              mobileAds()
                .initialize()
                .catch((adErr: any) => {
                  console.log('AdMob background init error:', adErr);
                });
            }
          } catch (adError) {
            console.log('AdMob native module not found:', adError);
          }
        }

        // 2. Fast local token & cached user profile hydration
        const token = await AsyncStorage.getItem('token');
        const cachedUserStr = await AsyncStorage.getItem('cached_user');

        if (token) {
          setAuthToken(token);
          let initialUser = null;
          if (cachedUserStr) {
            try {
              initialUser = JSON.parse(cachedUserStr);
            } catch {
              // ignore json parse error
            }
          }

          if (initialUser) {
            dispatch(loginSuccess({ user: initialUser, token } as any));
          } else {
            dispatch(loginStart());
          }

          // Fast unblock splash screen immediately
          clearTimeout(fallbackTimer);
          onReady();

          // Background verification of current user profile (timeout in 6s)
          api
            .get('/auth/me', { timeout: 6000 })
            .then((res) => {
              const freshUser = res.data && res.data.data ? res.data.data : res.data;
              if (freshUser) {
                dispatch(loginSuccess({ user: freshUser, token } as any));
                AsyncStorage.setItem('cached_user', JSON.stringify(freshUser)).catch(() => {});
              }
            })
            .catch((err) => {
              // Only clear token if server explicitly rejected with HTTP 401
              if (err?.response?.status === 401) {
                console.log('Token expired or invalid on server. Logging out.');
                AsyncStorage.multiRemove(['token', 'cached_user']).catch(() => {});
                setAuthToken(null);
                dispatch(loginFailure('Session expired'));
              } else {
                console.log('Background auth check offline / network lag (retaining cached session):', err?.message || err);
              }
            });
          return;
        }
      } catch (err: any) {
        console.warn('Auth bootstrap error:', err?.message || err);
      } finally {
        clearTimeout(fallbackTimer);
        onReady();
      }
    };

    init();

    return () => {
      clearTimeout(fallbackTimer);
    };
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
    try {
      await SplashScreen.hideAsync();
    } catch {
      // ignore
    }
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
