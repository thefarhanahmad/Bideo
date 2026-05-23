import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken } from '../services/api';
import { loginSuccess, loginStart, loginFailure } from '../redux/slices/authSlice';

function Startup() {
  const dispatch = useDispatch();

  useEffect(() => {
    const init = async () => {
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
      }
    };

    init();
  }, [dispatch]);

  return null;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Startup />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </GestureHandlerRootView>
    </Provider>
  );
}
