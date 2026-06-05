import { Stack } from 'expo-router';

/**
 * Stack for the public-profile route group.
 * Slide-from-right animation matches the rest of the app's modal/detail flows.
 */
export default function ProfileGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
