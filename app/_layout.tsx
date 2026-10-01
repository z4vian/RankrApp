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

import { ErrorBoundary } from '@/app/_components/ErrorBoundary';
import { ToastProvider } from '@/components';
import { LEGAL_VERSION } from '@/lib/legal';
import { ListProvider } from '@/lib/ListContext';
import { getOnboardingState, type OnboardingState } from '@/lib/onboarding';
import { getGuestDraft } from '@/lib/guestDraft';
import { registerPushToken } from '@/lib/pushTokens';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import Head from 'expo-router/head';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/lib/theme';
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
  // Resolve minimal profile setup separately from the optional walkthrough.
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const offeredDraft = useRef<string | null>(null);
  const previousUser = useRef<string | null>(null);
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (previousUser.current !== (session?.user.id ?? null)) { offeredDraft.current = null; previousUser.current = session?.user.id ?? null; }
      setProfileError(false);
      // Reset the onboarding flag on auth changes so we re-check for the new
      // user. The next effect re-resolves it.
      setOnboardingState(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Resolve the account's setup state after sign-in and metadata changes.
  useEffect(() => {
    if (!session) {
      setOnboardingState(null);
      return;
    }
    if (onboardingState !== null) return;
    let cancelled = false;
    getOnboardingState()
      .then((done) => {
        if (!cancelled) setOnboardingState(done);
      })
      .catch(() => {
        // Show a retry instead of guessing about a failed profile request.
        if (!cancelled) setProfileError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session, onboardingState, retry]);

  useEffect(() => {
    if (loading) return;
    // Legal documents, recovery, and feedback remain reachable without an account.
    if (['privacy', 'terms', 'cookies', 'image-credits', 'feedback', 'reset-password'].includes(segments[0])) return;
    if (session && session.user.user_metadata?.terms_version !== LEGAL_VERSION) {
      if (segments[0] !== 'consent') router.replace('/consent');
      return;
    }
    if (session && segments[0] === 'consent') {
      router.replace('/(tabs)');
      return;
    }
    const inAuthGroup = segments[0] === '(auth)';
    const inLandingGroup = segments[0] === 'landing';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inTry = segments[0] === 'try';
    if (!session) {
      if (!inAuthGroup && !inLandingGroup && !inTry) router.replace(Platform.OS === 'web' ? '/landing' : '/try' as any);
      return;
    }
    if (onboardingState === null) return;
    if (onboardingState === 'profile') {
      if (!inOnboardingGroup) router.replace('/(onboarding)/create-profile' as any);
      return;
    }
    // Walkthroughs are optional and may always be replayed after profile setup.
    if (segments[0] === 'walkthrough' || inTry) return;
    const draft = getGuestDraft();
    if (segments[0] === 'save-list') { offeredDraft.current = draft?.id ?? null; return; }
    const entry = inAuthGroup || inLandingGroup || inTry || (segments[0] === '(tabs)' && segments.length === 1);
    if (draft?.items.length && entry && offeredDraft.current !== draft.id) {
      offeredDraft.current = draft.id;
      router.replace('/save-list' as any);
      return;
    }
    if (onboardingState === 'full' || onboardingState === 'short') {
      router.replace(`/walkthrough?variant=${onboardingState}` as any);
      return;
    }
    if (inAuthGroup || inLandingGroup || inOnboardingGroup) router.replace('/(tabs)' as any);
  }, [session, loading, onboardingState, segments, router]);

  // Phase 5 — set up push when the session becomes available.
  useEffect(() => {
    if (session) {
      setupPush();
    }
  }, [session]);

  if (session && profileError && !['privacy', 'terms', 'cookies', 'feedback', 'reset-password'].includes(segments[0])) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 28, gap: 20 }}>
      <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 18 }}>Your profile could not be loaded. Your starter list is still on this device.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setProfileError(false); setOnboardingState(null); setRetry(n => n + 1); }} style={{ padding: 16, backgroundColor: colors.purple, borderRadius: 8 }}><Text style={{ color: '#fff' }}>Try again</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => { void supabase.auth.signOut(); }} style={{ padding: 16 }}><Text style={{ color: colors.purpleLight }}>Sign out</Text></TouchableOpacity>
    </View>;
  }
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Loading Rankr" color={colors.purpleLight} /></View>;
  return (
    <ErrorBoundary>
      <Head><title>{({ privacy: 'Privacy Policy', terms: 'Terms & Conditions', cookies: 'Cookie & Storage Policy', 'image-credits': 'Image Credits', feedback: 'Send Feedback', signup: 'Create Account', login: 'Log In', 'reset-password': 'Reset Password', consent: 'Your Agreement', try: 'Build Your First List', 'save-list': 'Save Your List', walkthrough: 'Explore Rankr' } as Record<string, string>)[segments[segments.length - 1]] ?? 'Your Favorites'} · Rankr</title></Head>
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
              <Stack.Screen name="try" />
              <Stack.Screen name="save-list" />
              <Stack.Screen name="walkthrough" />
              <Stack.Screen name="discover" />
              <Stack.Screen name="reset-password" />
              <Stack.Screen name="privacy" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="cookies" />
              <Stack.Screen name="image-credits" />
              <Stack.Screen name="consent" />
              <Stack.Screen name="feedback" />
              <Stack.Screen name="blocked-users" />
            </Stack>
          </ToastProvider>
        </ListProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
