import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
      <Ionicons name ="chevron-back" size={24} color="#000000" />
    </TouchableOpacity>
  );
}

export default function SearchLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="music"
        options={{
          title: 'Music',
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="movies"
        options={{
          title: 'Movies',
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="games"
        options={{
          title: 'Games',
          headerLeft: () => <BackButton />,
        }}
      />
    </Stack>
  );
}

//supabase password: RankrProj420!