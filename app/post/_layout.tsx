import { Stack } from 'expo-router';

/**
 * Stack for the post compose / detail route group.
 * Slide-from-bottom feels modal-like for the compose screen, matching
 * Twitter/Threads compose UX.
 */
export default function PostLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom',
      }}
    />
  );
}
