import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import api from '../../services/api';

export default function DeepLinkVideoRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!id) {
      router.replace('/');
      return;
    }

    let isMounted = true;
    api
      .get(`/videos/${id}`)
      .then((res) => {
        if (!isMounted) return;
        const video = res.data?.data;
        if (video?.isShort) {
          router.replace({ pathname: '/shorts', params: { initialShortId: id } });
        } else {
          router.replace(`/video/${id}`);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        router.replace(`/video/${id}`);
      });

    return () => {
      isMounted = false;
    };
  }, [id, router]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="small" color={Colors.primary} />
    </View>
  );
}
