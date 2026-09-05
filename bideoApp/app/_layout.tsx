import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import api, { clearAuthSession, setAuthToken } from '../services/api';
import { loginSuccess, loginStart, loginFailure, logout } from '../redux/slices/authSlice';
import { AlertHost, showAlert } from '../components/AppAlert';
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
            const googleMobileAds = require('react-native-google-mobile-ads');
            const mobileAds = googleMobileAds.default || googleMobileAds;
            if (typeof mobileAds === 'function') {
              mobileAds()
                .initialize()
                .then((adapterStatuses: any) => {
                  console.log('AdMob initialized successfully in background:', adapterStatuses);
                })
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
            if (initialUser.isBlocked) {
              clearAuthSession().catch(() => {});
              dispatch(logout());
            } else {
              dispatch(loginSuccess({ user: initialUser, token } as any));
            }
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
                if (freshUser.isBlocked) {
                  console.log('User account is suspended by administrator. Logging out.');
                  clearAuthSession().catch(() => {});
                  dispatch(logout());
                  showAlert(
                    'Account Suspended',
                    freshUser.blockReason || 'Your account has been suspended by an administrator. Please contact support if you believe this was an error.'
                  );
                  return;
                }
                dispatch(loginSuccess({ user: freshUser, token } as any));
                AsyncStorage.setItem('cached_user', JSON.stringify(freshUser)).catch(() => {});
              }
            })
            .catch((err) => {
              if (err?.response?.status === 403 && err?.response?.data?.isBlocked) {
                console.log('User is blocked on server. Logging out.');
                clearAuthSession().catch(() => {});
                dispatch(logout());
                showAlert(
                  'Account Suspended',
                  err.response.data.message || 'Your account has been suspended by an administrator.'
                );
                return;
              }
              // Only clear token if server explicitly rejected with HTTP 401
              if (err?.response?.status === 401) {
                console.log('Token expired or invalid on server. Logging out.');
                clearAuthSession().catch(() => {});
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
  const handleAppReady = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } catch {
      // ignore
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <Startup onReady={handleAppReady} />
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
      </Provider>
    </GestureHandlerRootView>
  );
}
