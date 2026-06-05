/**
 * app/item/_layout.tsx
 * Stack navigator for item detail screens — renders over the tab bar.
 */
import { Stack } from 'expo-router';

export default function ItemLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
