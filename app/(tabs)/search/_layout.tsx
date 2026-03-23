import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

const PURPLE = '#7C3AED';
const BG = '#0f0f13';
const CARD = '#1a1a24';

function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.back()}
      style={{ marginLeft: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}
    >
      <Ionicons name="chevron-back" size={22} color="#fff" />
    </TouchableOpacity>
  );
}

export default function SearchLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="movies"
        options={{
          title: 'Movies',
          headerLeft: () => <BackButton />,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="music"
        options={{
          title: 'Music',
          headerLeft: () => <BackButton />,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="games"
        options={{
          title: 'Video Games',
          headerLeft: () => <BackButton />,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="detail"
        options={{
          title: 'Add to List',
          headerLeft: () => <BackButton />,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}