/**
 * lib/social.ts
 *
 * Follow-graph helpers for the Rankr social layer.
 *
 * Wraps the `public.follows` table introduced in Phase 2 (see
 * `docs/PHASE-2-MIGRATION.sql`). Row shape: (follower_id, followed_id, created_at).
 *
 * Error-handling pattern matches the rest of `lib/`:
 *   - Mutators (followUser / unfollowUser) throw on unexpected errors with a
 *     friendly user-facing message — never a raw Postgres error.
 *   - Read helpers (isFollowing / getFollowers / getFollowing / getFollowCounts)
 *     log and return a safe empty value on error so the UI degrades gracefully.
 *
 * Auth: the current user is resolved per-call via `supabase.auth.getUser()`.
 * Operations that require a session throw "You must be signed in." when the
 * session is missing.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The slice of a `profiles` row returned by follower/following list queries.
 * Username is nullable because legacy pre-onboarding rows may not have one;
 * the UI typically falls back to display_name or a generic placeholder.
 */
export type FollowUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Postgres unique-violation SQLSTATE — thrown when the composite PK collides. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Resolve the current user's id or throw the standard "not signed in" error.
 * Used by mutating helpers; read helpers that target a specific userId don't
 * need to call this.
 */
async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You must be signed in.');
  }
  return data.user.id;
}

/**
 * The shape Supabase returns when a foreign-key relation is embedded via
 * `select('..., profiles!...(...)')`. PostgREST resolves to-one relations as
 * either a single object or null (or, in older client versions, a one-element
 * array). We normalize both shapes via `extractProfile`.
 */
type EmbeddedProfile = Pick<
  FollowUser,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'bio'
>;

function extractProfile(
  rel: EmbeddedProfile | EmbeddedProfile[] | null | undefined
): EmbeddedProfile | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

// ---------------------------------------------------------------------------
// Mutators
// ---------------------------------------------------------------------------

/**
 * Follow another user. Inserts `(auth.uid(), targetUserId)` into `follows`.
 *
 * Throws:
 *   - "You must be signed in."                if no session.
 *   - "You can't follow yourself."            if targetUserId === current user.
 *   - "You're already following this user."   on PG unique-violation (23505).
 *   - Supabase error message                  on any other error.
 */
export async function followUser(targetUserId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  if (targetUserId === currentUserId) {
    throw new Error("You can't follow yourself.");
  }

  const { error } = await supabase.from('follows').insert({
    follower_id: currentUserId,
    followed_id: targetUserId,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new Error("You're already following this user.");
    }
    throw new Error(error.message);
  }
}

/**
 * Unfollow another user. Deletes the matching row. Idempotent — if no row
 * exists for (current user, targetUserId), this completes silently without
 * throwing. RLS makes "delete a row I don't own" a no-op rather than an
 * error, which matches what we want for repeated taps on an unfollow button.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function unfollowUser(targetUserId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', currentUserId)
    .eq('followed_id', targetUserId);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Whether the current user follows `targetUserId`. Returns `false` if not
 * signed in, if the row doesn't exist, or on any error — callers shouldn't
 * need to handle errors here, just render an "Unfollow" / "Follow" button.
 */
export async function isFollowing(targetUserId: string): Promise<boolean> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return false;

    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', userResult.user.id)
      .eq('followed_id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('[isFollowing]', targetUserId, error.message);
      return false;
    }

    return data !== null;
  } catch (err) {
    console.error('[isFollowing] unexpected', targetUserId, err);
    return false;
  }
}

/**
 * People who follow `userId`. Joins `follows -> profiles` via `follower_id`.
 * Ordered by the follows row's `created_at` DESC (newest follower first).
 *
 * @param userId  The user being looked up (the one being followed).
 * @param limit   Max rows to return. Default 50.
 *
 * Returns [] on error.
 */
export async function getFollowers(userId: string, limit: number = 50): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      created_at,
      profiles:follower_id ( id, username, display_name, avatar_url, bio )
    `)
    .eq('followed_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getFollowers]', userId, error.message);
    return [];
  }

  if (!data) return [];

  const out: FollowUser[] = [];
  for (const row of data) {
    const profile = extractProfile(
      (row as { profiles: EmbeddedProfile | EmbeddedProfile[] | null }).profiles
    );
    if (!profile) continue;
    out.push({
      id: profile.id,
      username: profile.username ?? null,
      display_name: profile.display_name ?? null,
      avatar_url: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
    });
  }
  return out;
}

/**
 * People `userId` is following. Joins `follows -> profiles` via `followed_id`.
 * Ordered by the follows row's `created_at` DESC (most recently followed first).
 *
 * @param userId  The user being looked up (the one doing the following).
 * @param limit   Max rows to return. Default 50.
 *
 * Returns [] on error.
 */
export async function getFollowing(userId: string, limit: number = 50): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      created_at,
      profiles:followed_id ( id, username, display_name, avatar_url, bio )
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getFollowing]', userId, error.message);
    return [];
  }

  if (!data) return [];

  const out: FollowUser[] = [];
  for (const row of data) {
    const profile = extractProfile(
      (row as { profiles: EmbeddedProfile | EmbeddedProfile[] | null }).profiles
    );
    if (!profile) continue;
    out.push({
      id: profile.id,
      username: profile.username ?? null,
      display_name: profile.display_name ?? null,
      avatar_url: profile.avatar_url ?? null,
      bio: profile.bio ?? null,
    });
  }
  return out;
}

/**
 * Count of followers and following for `userId`. Two parallel count queries
 * using `head: true` to skip transferring row data — the count comes back in
 * the `count` field of the response.
 *
 * Returns { followers: 0, following: 0 } on error.
 */
export async function getFollowCounts(
  userId: string
): Promise<{ followers: number; following: number }> {
  try {
    const [followersRes, followingRes] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', userId),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    if (followersRes.error) {
      console.error('[getFollowCounts] followers', userId, followersRes.error.message);
    }
    if (followingRes.error) {
      console.error('[getFollowCounts] following', userId, followingRes.error.message);
    }

    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
    };
  } catch (err) {
    console.error('[getFollowCounts] unexpected', userId, err);
    return { followers: 0, following: 0 };
  }
}

// ---------------------------------------------------------------------------
// Suggested users ("Who to follow" widget)
// ---------------------------------------------------------------------------

/**
 * Suggest public profiles for the current user to follow.
 *
 * V1 algorithm: pull a wider window of eligible public profiles (excluding
 * the current user and anyone they already follow), then return a random
 * subset of size `limit`. The randomization is intentional — it makes the
 * widget feel fresh between renders without needing per-user activity data.
 *
 * Excluded:
 *   - The current user themselves.
 *   - Users the current user already follows.
 *   - Profiles without a username (legacy / un-onboarded rows — they have
 *     no stable handle to navigate to).
 *
 * Future iterations could rank by mutual-follow count, taste similarity, or
 * activity recency. For v1, simple wins.
 *
 * Returns up to `limit` profiles (default 5). Degrades to empty array on any
 * error (no session, query failure, etc.) — the widget should render empty
 * rather than break the page.
 *
 * Schema note:
 *   `profiles` has no `created_at` column in this project (verified against
 *   `docs/database-schema.md`). Ordering by UUID `id` ASC would be stable
 *   but boring — the same N users would dominate forever — so we over-fetch
 *   a larger candidate window and shuffle client-side instead.
 */
export async function getSuggestedUsers(limit: number = 5): Promise<FollowUser[]> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return [];
    const me = userResult.user.id;

    // Step 1: collect the user IDs the current user already follows.
    const { data: followsData, error: followsErr } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', me);

    if (followsErr) {
      console.error('[getSuggestedUsers] follows', followsErr.message);
      // Don't bail — degrade by treating the exclude-set as just {me}.
    }

    const excludeIds = new Set<string>([me]);
    for (const row of followsData ?? []) {
      const id = (row as { followed_id?: unknown }).followed_id;
      if (typeof id === 'string') excludeIds.add(id);
    }

    // Step 2: pull a candidate window of public profiles.
    //
    // Over-fetch by ~5x the requested limit so the random-shuffle (step 3)
    // can vary outputs across calls. Hard cap at 100 to keep the round-trip
    // small. PostgREST's `.not('id', 'in', '(uuid,uuid,...)')` syntax takes
    // a paren-wrapped comma-separated list; we build that string explicitly.
    const candidateLimit = Math.min(100, Math.max(limit, limit * 5));
    let q = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('is_public', true)
      .not('username', 'is', null)
      .limit(candidateLimit);

    // PostgREST `not.in` requires `(a,b,c)` — empty `()` is a syntax error,
    // so only attach the filter when there's at least one ID to exclude.
    if (excludeIds.size > 0) {
      const formatted = `(${Array.from(excludeIds).join(',')})`;
      q = q.not('id', 'in', formatted);
    }

    const { data, error } = await q;

    if (error) {
      console.error('[getSuggestedUsers]', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Step 3: shuffle and slice. Fisher–Yates so the distribution is uniform
    // and we don't depend on Math.random() bias in any one slot.
    const pool: FollowUser[] = [];
    for (const row of data) {
      const id = (row as { id?: unknown }).id;
      const username = (row as { username?: unknown }).username;
      if (typeof id !== 'string' || typeof username !== 'string') continue;
      pool.push({
        id,
        username,
        display_name: ((row as { display_name?: unknown }).display_name as string | null) ?? null,
        avatar_url: ((row as { avatar_url?: unknown }).avatar_url as string | null) ?? null,
        bio: ((row as { bio?: unknown }).bio as string | null) ?? null,
      });
    }

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, limit);
  } catch (err) {
    console.error('[getSuggestedUsers] unexpected', err);
    return [];
  }
}
