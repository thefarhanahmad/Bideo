import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { store } from '../redux/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </GestureHandlerRootView>
    </Provider>
  );
}
