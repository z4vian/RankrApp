/**
 * lib/pushTokens.ts
 *
 * Expo push-token registration / unregistration for the Rankr app.
 *
 * Each device (iOS, Android, or web push) produces an Expo push token of the
 * form `ExponentPushToken[...]`. We persist them in `public.push_tokens`
 * (see `docs/PHASE-5-MIGRATION.sql`) so that an Edge Function (see
 * `docs/edge-functions/send-push-notification.ts`) can look up every device
 * a user has registered and send to all of them.
 *
 * Schema reference (Phase 5):
 *   push_tokens (
 *     id          uuid PK,
 *     user_id     uuid → auth.users.id (CASCADE),
 *     token       text  UNIQUE NOT NULL,
 *     platform    text  CHECK in ('ios','android','web'),
 *     created_at  timestamptz default now(),
 *     updated_at  timestamptz default now()
 *   )
 *
 * The `token` column has a UNIQUE constraint so a duplicate registration is
 * idempotent — we upsert on conflict against `token` and bump `updated_at`.
 *
 * Error policy: matches the rest of `lib/`. Mutators throw with a friendly
 * message on hard failure (no session, RLS rejection). Idempotent paths
 * swallow the unique-violation rather than throwing.
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Allowed values for the `platform` CHECK constraint. */
type DevicePlatform = 'ios' | 'android' | 'web';

/**
 * Resolve the current device platform into one of the three values the
 * `push_tokens.platform` CHECK accepts. Anything we don't recognise (e.g.
 * future Windows / macOS targets) is mapped to 'web' so the row still
 * inserts — better than erroring out.
 */
function currentPlatform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Resolve the current user's id or throw the standard "not signed in" error.
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
 * Register (or refresh) an Expo push token for the current user / device.
 *
 * Idempotent: if the same token is already in the table we update its
 * `user_id`, `platform`, and `updated_at` instead of throwing. The upsert
 * is keyed on the `token` UNIQUE constraint.
 *
 * Throws:
 *   - "You must be signed in."     if no session.
 *   - "Push token is required."    if `expoPushToken` is empty/whitespace.
 *   - Supabase error message       on any other error.
 */
export async function registerPushToken(expoPushToken: string): Promise<void> {
  if (typeof expoPushToken !== 'string' || !expoPushToken.trim()) {
    throw new Error('Push token is required.');
  }
  const me = await requireCurrentUserId();
  const platform = currentPlatform();

  // Upsert against `token` — the UNIQUE constraint makes this idempotent.
  // We bump `updated_at` explicitly because the DB default only fires on
  // INSERT, not on UPDATE-via-upsert.
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: me,
        token: expoPushToken,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

  if (error) {
    console.error('[registerPushToken]', expoPushToken.slice(0, 16), error.message);
    throw new Error(error.message);
  }
}

/**
 * Remove a push token from the table. Used on logout so a device no longer
 * receives notifications for the previously-signed-in user.
 *
 * Idempotent: if no row matches, the zero-row delete completes silently.
 * RLS scopes the delete to the current user — you can't remove someone
 * else's device token even if you somehow learned its value.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function unregisterPushToken(expoPushToken: string): Promise<void> {
  if (typeof expoPushToken !== 'string' || !expoPushToken.trim()) {
    // Nothing to remove — treat as success rather than spuriously throwing.
    return;
  }
  const me = await requireCurrentUserId();

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', me)
    .eq('token', expoPushToken);

  if (error) {
    console.error('[unregisterPushToken]', expoPushToken.slice(0, 16), error.message);
    throw new Error(error.message);
  }
}
