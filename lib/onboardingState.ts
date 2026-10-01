export const WALKTHROUGH_VERSION = 'guest-first-v1';
export type OnboardingState = 'profile' | 'full' | 'short' | 'done';

/** Usernames remain a legacy-completion signal, except for new signup flows. */
export function resolveOnboardingState(metadata: Record<string, unknown>, username: unknown, hasList = false): OnboardingState {
  if (typeof username !== 'string' || !username.trim()) return 'profile';
  if (metadata.rankr_walkthrough_version === WALKTHROUGH_VERSION) return 'done';
  return metadata.rankr_walkthrough_required === true ? hasList ? 'short' : 'full' : 'done';
}

