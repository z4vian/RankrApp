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
import { isOnboardingComplete } from '@/lib/onboarding';
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
  // Phase 7: tri-state onboarding flag.
  //   null    — not yet resolved for the current session
  //   true    — user has completed onboarding (or is a back-compat pre-Phase-7 user)
  //   false   — needs to be routed to /(onboarding)/create-profile
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Reset the onboarding flag on auth changes so we re-check for the new
      // user. The next effect re-resolves it.
      setOnboardingDone(null);
    });
  }, []);

  // Resolve onboarding status whenever a session appears. Runs once per
  // session — onboardingDone moves null → boolean and stays there until the
  // next sign-in/out.
  useEffect(() => {
    if (!session) {
      setOnboardingDone(null);
      return;
    }
    if (onboardingDone !== null) return;
    let cancelled = false;
    isOnboardingComplete()
      .then((done) => {
        if (!cancelled) setOnboardingDone(done);
      })
      .catch(() => {
        // Defensive: treat as done to avoid trapping the user. The
        // back-compat path inside lib/onboarding already treats non-null
        // usernames as onboarded.
        if (!cancelled) setOnboardingDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session, onboardingDone]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inLandingGroup = segments[0] === 'landing';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!session && !inAuthGroup && !inLandingGroup) {
      // Web users see a public Letterboxd-style landing page before being
      // pushed into auth. Native users go straight to login as before — no
      // landing flash on app open.
      if (Platform.OS === 'web') {
        router.replace('/landing' as any);
      } else {
        router.replace('/(auth)/login' as any);
      }
      return;
    }

    if (session && (inAuthGroup || inLandingGroup)) {
      // Signed-in users should never see the unauth surfaces. Covers the case
      // where a web user manually navigates to /landing after logging in.
      router.replace('/(tabs)' as any);
      return;
    }

    // Phase 7 — onboarding gate. Only applies once the session is present
    // AND we've resolved the onboarding flag. While resolving (null) we let
    // the user stay wherever they are to avoid a flash.
    if (session && onboardingDone === false && !inOnboardingGroup) {
      router.replace('/(onboarding)/create-profile' as any);
      return;
    }

    // Don't let a finished user re-enter onboarding by URL.
    if (session && onboardingDone === true && inOnboardingGroup) {
      router.replace('/(tabs)' as any);
      return;
    }
  }, [session, loading, onboardingDone, segments]);

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
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="item" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="users" />
            <Stack.Screen name="list-item" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="post" />
            <Stack.Screen name="year-in-review" />
            <Stack.Screen name="profile-delete" />
            <Stack.Screen name="landing" />
            <Stack.Screen name="discover" />
          </Stack>
        </ToastProvider>
      </ListProvider>
    </GestureHandlerRootView>
  );
}
