import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import api, { clearAuthSession, setAuthToken, SESSION_EXPIRED_EVENT } from '../services/api';
import { loginSuccess, loginStart, logout } from '../redux/slices/authSlice';
import { AlertHost, showAlert } from '../components/AppAlert';
import AppErrorScreen from '../components/AppErrorScreen';
import Constants from 'expo-constants';
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../services/notifications';
import { initSocket, disconnectSocket } from '../services/socket';
import { migrateExistingSession, saveAccount } from '../services/accountManager';
import { endExpiredSession, renewTokenIfDue } from '../services/session';
import { AppState, AppStateStatus, StatusBar, LogBox, DeviceEventEmitter } from 'react-native';

LogBox.ignoreLogs([
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'expo-notifications: Android Push notifications',
]);
import { logScreen, logEvent, setAnalyticsUser } from '../services/analytics';

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
        // 0. Migrate existing single-account session to multi-account registry (no-op if already done)
        await migrateExistingSession().catch(() => {});

        // 1. Initialize AdMob non-blocking in background (skip in Expo Go)
        const isExpoGo =
          Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        if (!isExpoGo) {
          (async () => {
            try {
              const googleMobileAds = require('react-native-google-mobile-ads');
              const mobileAds = googleMobileAds.default || googleMobileAds;
              const AdsConsent =
                googleMobileAds.AdsConsent ||
                (googleMobileAds.default && googleMobileAds.default.AdsConsent);

              // Check consent status (Google detects location: silent for Indian users, shows popup only for EEA/UK)
              if (AdsConsent && typeof AdsConsent.requestInfoUpdate === 'function') {
                try {
                  await AdsConsent.requestInfoUpdate();
                  if (typeof AdsConsent.loadAndShowConsentFormIfRequired === 'function') {
                    await AdsConsent.loadAndShowConsentFormIfRequired();
                  }
                } catch (consentError) {
                  console.log('Consent check skipped/failed:', consentError);
                }
              }

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
          })();
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
              setAnalyticsUser(initialUser._id, {
                name: initialUser.name || '',
                channelName: initialUser.channelName || '',
              });
            }
          } else {
            dispatch(loginStart());
          }

          // Fast unblock splash screen immediately
          clearTimeout(fallbackTimer);
          onReady();
          logEvent('app_open');

          // Background verification of current user profile (timeout in 6s)
          api
            .get('/auth/me', { timeout: 6000, skipSessionExpiry: true })
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
                saveAccount(freshUser, token).catch(() => {});
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
              // Only sign out if the server explicitly rejected the login (expired / invalid)
              if (err?.response?.status === 401) {
                console.log('Token expired or invalid on server. Logging out.');
                endExpiredSession(dispatch, initialUser?._id, token);
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

// Signs the user out properly when the server stops accepting their login (anywhere in the
// app), and renews the login at most once a day when the app opens or comes back to the front.
function SessionManager() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SESSION_EXPIRED_EVENT, (expiredToken?: string) => {
      endExpiredSession(dispatch, userRef.current?._id, expiredToken);
    });
    return () => sub.remove();
  }, [dispatch]);

  const renew = useCallback(async () => {
    const signedIn = userRef.current;
    if (!signedIn?._id) return;
    const fresh = await renewTokenIfDue(signedIn._id);
    const current = userRef.current;
    if (fresh && current?._id === signedIn._id) {
      dispatch(loginSuccess({ user: current, token: fresh } as any));
      saveAccount(current, fresh).catch(() => {});
    }
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user?._id) renew();
  }, [isAuthenticated, user?._id, renew]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') renew();
    });
    return () => sub.remove();
  }, [renew]);

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

function NotificationManager({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const lastSyncTimeRef = useRef(0);

  useEffect(() => {
    const cleanup = setupNotificationListeners(router);
    return () => {
      cleanup();
    };
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync();
      lastSyncTimeRef.current = Date.now();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated) {
        // Re-verify push registration at most once every 6 hours on foreground resume
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 6 * 60 * 60 * 1000) {
          lastSyncTimeRef.current = now;
          registerForPushNotificationsAsync();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}

function ChatPresenceManager({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      initSocket();
    } else {
      disconnectSocket();
    }

    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated) {
        initSocket();
      } else if (nextAppState.match(/inactive|background/)) {
        disconnectSocket();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}

function ScreenTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      logScreen(pathname);
    }
  }, [pathname]);

  return <>{children}</>;
}

// A crash in any screen shows a "Try again" screen instead of closing the app
export { AppErrorScreen as ErrorBoundary };

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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <Provider store={store}>
        <Startup onReady={handleAppReady} />
        <SessionManager />
        <DeletionGuard>
          <NotificationManager>
            <ChatPresenceManager>
              <ScreenTracker>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="channel/[id]" />
                  <Stack.Screen name="channel-shorts" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="chat" />
                  <Stack.Screen name="upload-video" />
                  <Stack.Screen name="upload-post" />
                  <Stack.Screen name="settings/privacy" />
                  <Stack.Screen name="settings/delete-profile" />
                  <Stack.Screen name="account-recovery" />
                </Stack>
                <AlertHost />
              </ScreenTracker>
            </ChatPresenceManager>
          </NotificationManager>
        </DeletionGuard>
      </Provider>
    </GestureHandlerRootView>
  );
}
