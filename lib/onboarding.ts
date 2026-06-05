/**
 * lib/onboarding.ts
 *
 * Helpers for the onboarding flow (signup → username → bio → first-rank
 * tutorial → main app).
 *
 * Schema reference: `docs/PHASE-7-MIGRATION.sql` — adds the single
 * `profiles.onboarded_at timestamptz` column. NULL means "not yet
 * onboarded"; a non-null timestamp records when the user finished the flow.
 *
 * Back-compat:
 *   Users who signed up BEFORE Phase 7 shipped have a non-null `username`
 *   (set during the existing Phase 1 signup flow) but a null `onboarded_at`
 *   (because the column didn't exist when they joined). `isOnboardingComplete`
 *   treats those users as already-onboarded so they don't get force-routed
 *   into the new onboarding screens on next launch.
 *
 * Error policy: matches the rest of `lib/`.
 *   - `markOnboardingComplete` throws with a friendly message on failure
 *     (no session, Supabase error). The UI surfaces a toast and offers a
 *     retry rather than silently letting the user think they're done.
 *   - `isOnboardingComplete` never throws — returns `false` on any error.
 *     A false-negative routes the user back into onboarding, which is
 *     annoying but recoverable; a false-positive would leave them stuck
 *     with a half-set-up account, which is worse.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the current user's id or throw the standard "not signed in" error.
 * Used by the mutator; the read helper handles missing sessions inline so
 * it can degrade to `false` instead of throwing.
 */
async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You must be signed in.');
  }
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mark the current user as having completed onboarding.
 *
 * Updates `profiles.onboarded_at` to `now()` (ISO string from the client).
 * Idempotent — calling twice just bumps the timestamp to the later value,
 * which is harmless. The existing profile UPDATE RLS policy
 * (`auth.uid() = id`) gates the write; the user can only ever set their
 * own `onboarded_at`.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function markOnboardingComplete(): Promise<void> {
  const me = await requireCurrentUserId();

  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', me);

  if (error) {
    console.error('[markOnboardingComplete]', me, error.message);
    throw new Error(error.message);
  }
}

/**
 * Whether the current user has completed onboarding.
 *
 * Returns `true` when EITHER:
 *   - `profiles.onboarded_at` is non-null (the new Phase-7 signal), OR
 *   - `profiles.username` is non-null (back-compat for users who finished
 *     Phase-1 signup before Phase 7 shipped).
 *
 * Returns `false` when there's no session, the profile row is hidden by
 * RLS, the row doesn't exist, or any query error occurs — anything other
 * than a definite "yes" routes the user into onboarding, which is the safe
 * default for a flow-completion check.
 */
export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return false;
    const me = userResult.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('onboarded_at, username')
      .eq('id', me)
      .maybeSingle();

    if (error) {
      console.error('[isOnboardingComplete]', me, error.message);
      return false;
    }
    if (!data) return false;

    const onboardedAt = (data as { onboarded_at?: unknown }).onboarded_at;
    if (typeof onboardedAt === 'string' && onboardedAt.length > 0) {
      return true;
    }

    // Back-compat: pre-Phase-7 users have a non-null username but no
    // onboarded_at. Treat them as already onboarded.
    const username = (data as { username?: unknown }).username;
    if (typeof username === 'string' && username.length > 0) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('[isOnboardingComplete] unexpected', err);
    return false;
  }
}
