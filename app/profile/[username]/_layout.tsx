import { Stack } from 'expo-router';

/**
 * Stack for the nested per-username routes:
 *   /profile/[username]            -> index.tsx
 *   /profile/[username]/followers  -> followers.tsx
 *   /profile/[username]/following  -> following.tsx
 */
export default function UsernameLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
