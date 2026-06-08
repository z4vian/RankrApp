import { Stack } from 'expo-router';

/**
 * Stack for the post-signup onboarding flow (create-profile → first-rank).
 * Phase 7 — gated in app/_layout.tsx via isOnboardingComplete().
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false, // can't swipe back; onboarding is linear
      }}
    />
  );
}
