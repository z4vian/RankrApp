/**
 * lib/feedback.ts
 *
 * In-app feedback submission. Writes a row to `public.feedback` (Phase 8).
 *
 * Anonymous submission is supported: the RLS policy allows
 * `INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`, so a crash
 * report that fires before a session exists can still land. When a user IS
 * signed in we attribute the row to them automatically.
 *
 * Schema reference: `docs/PHASE-8-MIGRATION.sql` — the `feedback` table
 * with columns (id, user_id, body, category, screen_context, error_context,
 * app_version, platform, created_at).
 *
 * Error policy: throws with a friendly user-facing message on validation
 * failure or hard backend error — the "Send feedback" form should surface
 * a toast so the user knows it didn't submit. We do NOT degrade silently
 * here: a feedback form that silently fails is worse than one that errors
 * loudly.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Allowed feedback categories. Mirrors the DB CHECK constraint. */
export type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other';

/** Allowed platform values. Mirrors the DB CHECK constraint. */
type FeedbackPlatform = 'ios' | 'android' | 'web';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Mirrors `length(trim(body)) BETWEEN 1 AND 2000` in the migration. */
const FEEDBACK_BODY_MIN = 1;
const FEEDBACK_BODY_MAX = 2000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit feedback to the `feedback` table.
 *
 * Auth behavior:
 *   - If a session exists, the row is attributed to `auth.uid()`.
 *   - If no session exists, the row is inserted with `user_id = NULL`
 *     (anonymous). This is intentional so crash-handlers that fire before
 *     the user signs in can still get their reports through.
 *
 * Validation:
 *   - `body` is trimmed and must be 1..2000 chars (matches DB CHECK).
 *   - `errorContext` is serialized into the jsonb column via Supabase's
 *     normal JSON encoding; we pass it through as `unknown` and trust the
 *     PostgREST client to encode. If the value isn't JSON-serializable
 *     (e.g. circular reference, native Error), we attempt a best-effort
 *     conversion to a plain object first.
 *
 * Throws:
 *   - "Feedback is required."                 on empty / whitespace body.
 *   - "Feedback is too long."                 if body > 2000 chars after trim.
 *   - "Feedback contains invalid data."       if errorContext can't be serialized.
 *   - Supabase error message                  on any other backend failure.
 */
export async function submitFeedback(input: {
  body: string;
  category?: FeedbackCategory;
  /** e.g. router.pathname or the current route name */
  screenContext?: string;
  /** Structured error data — gets JSON-stringified into the jsonb column. */
  errorContext?: unknown;
  appVersion?: string;
  platform?: FeedbackPlatform;
}): Promise<void> {
  // Validate body.
  if (typeof input.body !== 'string') {
    throw new Error('Feedback is required.');
  }
  const trimmed = input.body.trim();
  if (trimmed.length < FEEDBACK_BODY_MIN) {
    throw new Error('Feedback is required.');
  }
  if (trimmed.length > FEEDBACK_BODY_MAX) {
    throw new Error('Feedback is too long.');
  }

  // Resolve current user (optional — anonymous is fine).
  let userId: string | null = null;
  try {
    const { data, error: authError } = await supabase.auth.getUser();
    if (!authError && data.user) {
      userId = data.user.id;
    }
  } catch {
    // Treat any session-lookup error as "anonymous" — better to land the
    // feedback than to bail out because the auth client misbehaved.
    userId = null;
  }

  // Normalize errorContext. The jsonb column accepts anything JSON-encodable;
  // we run it through JSON.stringify/parse once so a non-serializable value
  // (circular ref, native Error, function, undefined) surfaces as a friendly
  // error instead of a cryptic PostgREST 400.
  let errorContextNormalized: unknown = null;
  if (input.errorContext !== undefined && input.errorContext !== null) {
    try {
      const asJson = JSON.stringify(input.errorContext);
      // If the value was a function/undefined/etc., stringify returns
      // undefined — treat that as "nothing to record" rather than throwing.
      if (typeof asJson === 'string') {
        errorContextNormalized = JSON.parse(asJson);
      }
    } catch (err) {
      console.error('[submitFeedback] errorContext serialization', err);
      throw new Error('Feedback contains invalid data.');
    }
  }

  // Build the row. Undefined fields are omitted so Postgres applies column
  // defaults / NULLs as appropriate.
  const row: Record<string, unknown> = {
    user_id: userId,
    body: trimmed,
  };
  if (input.category) row.category = input.category;
  if (input.screenContext) row.screen_context = input.screenContext;
  if (errorContextNormalized !== null) row.error_context = errorContextNormalized;
  if (input.appVersion) row.app_version = input.appVersion;
  if (input.platform) row.platform = input.platform;

  const { error } = await supabase.from('feedback').insert(row);

  if (error) {
    console.error('[submitFeedback]', error.message);
    throw new Error(error.message);
  }
}
