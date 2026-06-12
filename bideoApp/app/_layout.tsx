import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import api, { setAuthToken } from '../services/api';
import { loginSuccess, loginStart, loginFailure } from '../redux/slices/authSlice';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function Startup({ onReady }: { onReady: () => void }) {
  const dispatch = useDispatch();

  useEffect(() => {
    const init = async () => {
      const startTime = Date.now();
      try {
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

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  return (
    <Provider store={store}>
      <Startup onReady={() => setAppIsReady(true)} />
      {appIsReady && (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="channel/[id]" />
            <Stack.Screen name="notifications" />
          </Stack>
        </GestureHandlerRootView>
      )}
    </Provider>
  );
}
