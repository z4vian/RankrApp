/**
 * lib/moderation.ts
 *
 * Moderation helpers for the Rankr social layer:
 *   - Blocks  (read/write `public.user_blocks`)
 *   - Reports (write-only for end users; read for self-submitted)
 *
 * Schema reference: `docs/PHASE-8-MIGRATION.sql`.
 *
 * Error-handling pattern matches the rest of `lib/`:
 *   - Mutators throw with a friendly user-facing message on hard failure
 *     (no session, non-idempotent error, RLS rejection). Idempotent paths
 *     (re-block, re-unblock) swallow the unique-violation rather than throwing.
 *   - Read helpers log and return a safe empty value on error so the UI
 *     degrades gracefully — settings screens shouldn't break just because
 *     the blocks list failed to load.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Postgres unique-violation SQLSTATE — composite PK collision on re-block. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Resolve the current user's id or throw the standard "not signed in" error.
 * Used by mutators. Read helpers handle missing sessions inline so they can
 * degrade to a safe empty value.
 */
async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You must be signed in.');
  }
  return data.user.id;
}

/**
 * PostgREST returns to-one relations as either a single object or null (or,
 * in some client versions, a one-element array). Normalize.
 */
function extractOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

// ===========================================================================
// Blocks
// ===========================================================================

/** Slim profile row returned by `getBlockedUsers` — what the settings screen renders. */
export type BlockedUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Block another user. Inserts `(auth.uid(), targetUserId)` into `user_blocks`.
 * Idempotent — re-blocking an already-blocked user is a no-op (the duplicate
 * insert hits the composite PK and we swallow the unique-violation).
 *
 * Throws:
 *   - "You must be signed in."        if no session.
 *   - "You can't block yourself."     if targetUserId equals current user.
 *   - Supabase error message          on any other error.
 */
export async function blockUser(targetUserId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  if (targetUserId === currentUserId) {
    throw new Error("You can't block yourself.");
  }

  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: currentUserId,
    blocked_id: targetUserId,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return; // already blocked — fine.
    console.error('[blockUser]', targetUserId, error.message);
    throw new Error(error.message);
  }
}

/**
 * Unblock another user. Idempotent — if no block row exists, the zero-row
 * delete completes silently. RLS makes "delete a block I don't own" a
 * no-op rather than an error.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function unblockUser(targetUserId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', currentUserId)
    .eq('blocked_id', targetUserId);

  if (error) {
    console.error('[unblockUser]', targetUserId, error.message);
    throw new Error(error.message);
  }
}

/**
 * Whether the current user has blocked `targetUserId`. Returns `false`
 * when not signed in, when the row doesn't exist, or on any error — the
 * UI just needs to know which button label to render.
 */
export async function isBlocked(targetUserId: string): Promise<boolean> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return false;

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocker_id', userResult.user.id)
      .eq('blocked_id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('[isBlocked]', targetUserId, error.message);
      return false;
    }
    return data !== null;
  } catch (err) {
    console.error('[isBlocked] unexpected', targetUserId, err);
    return false;
  }
}

/**
 * All user IDs the current user has blocked. Returns the IDs only — useful
 * for client-side filtering of feeds and search results (e.g. "hide posts
 * by anyone in this set"). Use `getBlockedUsers` for the full profile rows.
 *
 * Returns [] on any error.
 */
export async function getBlockedUserIds(): Promise<string[]> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return [];

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userResult.user.id);

    if (error) {
      console.error('[getBlockedUserIds]', error.message);
      return [];
    }

    const out: string[] = [];
    for (const row of data ?? []) {
      const id = (row as { blocked_id?: unknown }).blocked_id;
      if (typeof id === 'string') out.push(id);
    }
    return out;
  } catch (err) {
    console.error('[getBlockedUserIds] unexpected', err);
    return [];
  }
}

/**
 * Full profile rows of the users the current user has blocked, ordered by
 * most-recent block first. Used by the "Blocked users" screen in settings.
 *
 * Joins `user_blocks -> profiles` via `blocked_id`. PostgREST's FK
 * introspection finds the path through `auth.users.id ← profiles.id`.
 *
 * Returns [] on error.
 *
 * @param limit  Max rows to return. Default 100 (a power-user might have a
 *               lot of blocks; the UI can paginate if needed).
 */
export async function getBlockedUsers(limit: number = 100): Promise<BlockedUser[]> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return [];

    const { data, error } = await supabase
      .from('user_blocks')
      .select(`
        created_at,
        profiles:blocked_id ( id, username, display_name, avatar_url )
      `)
      .eq('blocker_id', userResult.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[getBlockedUsers]', error.message);
      return [];
    }

    type EmbeddedProfile = {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };

    const out: BlockedUser[] = [];
    for (const row of data ?? []) {
      const profile = extractOne<EmbeddedProfile>(
        (row as { profiles?: EmbeddedProfile | EmbeddedProfile[] | null }).profiles
      );
      if (!profile) continue;
      out.push({
        id: profile.id,
        username: profile.username ?? null,
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
      });
    }
    return out;
  } catch (err) {
    console.error('[getBlockedUsers] unexpected', err);
    return [];
  }
}

// ===========================================================================
// Reports
// ===========================================================================

/** Kinds of content the user can report. Mirrors the DB CHECK constraint. */
export type ReportKind = 'profile' | 'list' | 'list_item' | 'post' | 'comment';

/** Allowed report reasons. Mirrors the DB CHECK constraint. */
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'impersonation'
  | 'illegal'
  | 'other';

const REPORT_BODY_MAX = 1000;

/**
 * Submit a moderation report against another user's content. Inserts a row
 * into `public.reports` with `reporter_id = auth.uid()`; the moderation
 * queue (admin tooling in Session 2) reads from there.
 *
 * The optional `body` field gives the reporter room to add context. It's
 * capped at 1000 characters at the DB level; we trim and validate here too
 * so users get a friendly message rather than a raw CHECK violation.
 *
 * Throws:
 *   - "You must be signed in to report content."  if no session.
 *   - "Report details too long."                  if body > 1000 chars.
 *   - Supabase error message                       on any other error.
 *
 * Idempotent? No — a user can submit multiple reports against the same
 * target (e.g. for different reasons over time). The moderation queue
 * dedupes on the admin side.
 */
export async function submitReport(input: {
  targetKind: ReportKind;
  targetId: string;
  reason: ReportReason;
  body?: string;
}): Promise<void> {
  const { data: userResult, error: authError } = await supabase.auth.getUser();
  if (authError || !userResult.user) {
    throw new Error('You must be signed in to report content.');
  }
  const reporterId = userResult.user.id;

  // Normalize body. Empty strings or whitespace-only become null so we
  // don't waste a row's body column on noise.
  let bodyToInsert: string | null = null;
  if (typeof input.body === 'string') {
    const trimmed = input.body.trim();
    if (trimmed.length > REPORT_BODY_MAX) {
      throw new Error('Report details too long.');
    }
    if (trimmed.length > 0) bodyToInsert = trimmed;
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_kind: input.targetKind,
    target_id: input.targetId,
    reason: input.reason,
    body: bodyToInsert,
  });

  if (error) {
    console.error('[submitReport]', input.targetKind, input.targetId, error.message);
    throw new Error(error.message);
  }
}
