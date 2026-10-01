import { supabase } from '@/lib/supabase';

import { resolveOnboardingState, WALKTHROUGH_VERSION, type OnboardingState } from './onboardingState';
export { resolveOnboardingState, WALKTHROUGH_VERSION } from './onboardingState';
export type { OnboardingState } from './onboardingState';

export async function getOnboardingState(): Promise<OnboardingState> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Could not check your account. Please try again.');
  // Avoid depending on the older, not necessarily deployed onboarded_at column.
  const result = await supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
  if (result.error) throw new Error('Could not load your profile. Please try again.');
  const state = resolveOnboardingState(data.user.user_metadata, result.data?.username);
  if (state !== 'full') return state;
  const lists = await supabase.from('lists').select('id').eq('user_id', data.user.id).limit(1);
  if (lists.error) throw new Error('Could not check your existing lists. Please try again.');
  return lists.data?.length ? 'short' : 'full';
}

/** Skipping and finishing both persist the preference on the current account. */
export async function markOnboardingComplete(): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: {
    rankr_walkthrough_version: WALKTHROUGH_VERSION,
    rankr_walkthrough_required: false,
  } });
  if (error) throw new Error('Could not save your walkthrough preference. Please try again.');
}

export async function isOnboardingComplete(): Promise<boolean> {
  return (await getOnboardingState()) === 'done';
}
