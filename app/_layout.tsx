/**
 * app/_layout.tsx
 *
 * Root layout. Session-driven route guard + global providers:
 *   - GestureHandlerRootView (bottom-sheet drag, draggable list, etc.)
 *   - ListProvider           (active list context)
 *   - ToastProvider          (Phase 5 global toast notifications)
 *
 * Phase 5 additions:
 *   - ToastProvider wraps the Stack so toasts render above modals.
 *   - setupPush() registers an Expo push token after the session loads.
 *   - New stack screens: year-in-review, profile-delete, post (already
 *     registered prior).
 *
 * expo-notifications is loaded via dynamic require so tsc doesn't fail when
 * the package isn't yet installed (package.json declares it; the user runs
 * `npm install` to materialise it). The same pattern is used by the data-
 * export flow in profile-settings.tsx for expo-sharing / expo-file-system /
 * expo-clipboard.
 */

import { ToastProvider } from '@/components';
import { ListProvider } from '@/lib/ListContext';
import { registerPushToken } from '@/lib/pushTokens';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Request push permission and register a token for the current session.
 *
 * No-op on web. Gracefully no-ops when expo-notifications is not installed
 * (we dynamic-require it). When permission is denied, returns without an
 * error — the user just won't receive pushes.
 */
async function setupPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    if (!Notifications) return;

    const current = await Notifications.getPermissionsAsync();
    let finalStatus: string = current.status;
    if (current.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') return;

    const token = await Notifications.getExpoPushTokenAsync();
    if (token?.data) {
      await registerPushToken(token.data);
    }
  } catch (err) {
    // expo-notifications missing or runtime failure → swallow. Pushes simply
    // won't work until the dep is installed.
    console.warn('[setupPush]', err);
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }
  }, [session, loading]);

  // Phase 5 — set up push when the session becomes available.
  useEffect(() => {
    if (session) {
      setupPush();
    }
  }, [session]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ListProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="item" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="users" />
            <Stack.Screen name="list-item" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="post" />
            <Stack.Screen name="year-in-review" />
            <Stack.Screen name="profile-delete" />
          </Stack>
        </ToastProvider>
      </ListProvider>
    </GestureHandlerRootView>
  );
}
