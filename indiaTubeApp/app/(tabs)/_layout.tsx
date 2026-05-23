import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import Colors from '../../constants/Colors';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textGray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
        },
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerTitleStyle: {
          color: Colors.text,
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'IndiaTube',
          headerTitleStyle: {
            color: Colors.primary,
            fontSize: 22,
            fontWeight: 'bold',
          },
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: 15 }} 
              onPress={() => router.push('/search')}
            >
              <Ionicons name="search" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={40} color={Colors.primary} />
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="followings"
        options={{
          title: 'Followings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="copy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: 15 }} 
              onPress={() => {
                // We'll trigger a logout via a custom event or shared state if needed, 
                // but for now let's keep it simple or use a better way.
                // Actually, it's easier to handle logout in the screen itself if it has its own header.
              }}
            >
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
