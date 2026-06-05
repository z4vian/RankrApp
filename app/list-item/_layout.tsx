import { Stack } from 'expo-router';

/**
 * Stack for the list-item detail route group.
 * Slide-from-right matches the rest of the app's modal/detail patterns.
 */
export default function ListItemLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
