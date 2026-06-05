/**
 * lib/profile.ts
 *
 * Helpers for creating, updating, and validating user profiles.
 *
 * Schema reference: `docs/social-schema.md` §3. The `profiles` table has:
 *   id (uuid, PK, FK → auth.users.id)
 *   display_name (text, nullable)
 *   username (text, nullable, UNIQUE on non-null — see Phase 1 migration)
 *   bio (text, nullable)
 *   avatar_url (text, nullable)
 *   is_public (boolean, default true — added in Phase 1)
 *
 * Notes on username casing:
 *   The database-level partial unique index is case-sensitive (`Alice` and
 *   `alice` are distinct rows). To prevent confusing collisions we enforce
 *   lowercase via `validateUsername`. Callers should pass the normalized
 *   (lowercased, trimmed) string into `createProfile` / `isUsernameAvailable`.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateProfileInput = {
  userId: string;
  username: string;
  displayName?: string | null;
  bio?: string | null;
};

// ---------------------------------------------------------------------------
// Username validation
// ---------------------------------------------------------------------------

const USERNAME_REGEX = /^[a-z0-9_]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

/**
 * Validate a username string. Returns `null` if valid, or a user-facing error
 * message if invalid. Frontend reuses this for live form validation; the same
 * function is called inside `createProfile` as a defensive check before
 * hitting Supabase.
 *
 * Rules:
 *   - 3–20 characters
 *   - lowercase letters, digits, underscore only
 *   - no leading/trailing whitespace (whitespace is rejected as an invalid character)
 */
export function validateUsername(name: string): string | null {
  if (typeof name !== 'string' || name.length === 0) {
    return 'Username is required.';
  }
  if (name.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (name.length > USERNAME_MAX) {
    return `Username must be at most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_REGEX.test(name)) {
    return 'Username can only contain lowercase letters, numbers, and underscores.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Availability check (advisory, not authoritative)
// ---------------------------------------------------------------------------

/**
 * Check whether a username is currently available (case-insensitive).
 *
 * IMPORTANT: This is advisory only. There's an inherent race between the check
 * and the subsequent insert — two users typing the same username at the same
 * moment will both see "available." The authoritative check is the database
 * unique-violation thrown by `createProfile`. Use this for instant in-form
 * feedback; never rely on it for correctness.
 *
 * Returns `true` if available (or on transient error — see below).
 *
 * Error policy: on any Supabase error we return `true` so the user isn't
 * blocked by transient network failures. The real check happens at insert.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .maybeSingle();

    if (error) {
      // PGRST116 = "no rows" is fine; maybeSingle should already return null.
      // For any other error, fall through to optimistic-true so the UI doesn't
      // get stuck. The insert will be the source of truth.
      console.warn('[isUsernameAvailable] supabase error (treating as available)', error.message);
      return true;
    }

    return data === null;
  } catch (err) {
    console.warn('[isUsernameAvailable] unexpected error (treating as available)', err);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Create / upsert
// ---------------------------------------------------------------------------

/**
 * Postgres unique-violation SQLSTATE. Supabase surfaces this in `error.code`
 * for constraint conflicts (e.g. the `profiles_username_key` partial unique
 * index on `profiles.username`).
 */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Create or upsert a profile row.
 *
 * Used during signup after the `auth.users` row exists. Performs a defensive
 * `validateUsername` call so callers don't have to remember to do it; throws
 * with the validation message on invalid input.
 *
 * Throws on:
 *   - invalid username (message from `validateUsername`)
 *   - unique-violation on username (message: "That username is already taken.")
 *   - any other Supabase error (message: from Supabase)
 *
 * On success, returns void.
 */
export async function createProfile(input: CreateProfileInput): Promise<void> {
  const { userId, username, displayName = null, bio = null } = input;

  // Defensive validation — keeps the contract tight even if the caller
  // forgot to validate upstream.
  const validationError = validateUsername(username);
  if (validationError) {
    throw new Error(validationError);
  }

  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    username,
    display_name: displayName,
    bio,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new Error('That username is already taken.');
    }
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Public profile reads (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Shape of a profile row when read by someone other than its owner. Distinct
 * from `CreateProfileInput` — `username` is non-null here because lookups by
 * username can only succeed when one exists.
 *
 * `is_public` is included so callers can render an explicit "this profile is
 * private" UI if they ever fetch a profile they happen to own (RLS will let
 * the owner read their own private profile via the existing per-owner SELECT
 * policy).
 */
export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
};

/**
 * Look up a profile by username (case-insensitive).
 *
 * Returns `null` when no matching profile is found OR when the matched
 * profile is private (RLS hides it from non-owners — by design, the caller
 * cannot distinguish "doesn't exist" from "exists but private"). This
 * matches Beli-style behaviour: a private user is effectively invisible to
 * non-followers.
 *
 * Returns `null` on transient errors as well (logged); callers should show a
 * "couldn't find that profile" UI in both cases.
 */
export async function fetchProfileByUsername(username: string): Promise<PublicProfile | null> {
  if (!username || !username.trim()) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, is_public')
    .ilike('username', username)
    .maybeSingle();

  if (error) {
    console.error('[fetchProfileByUsername]', username, error.message);
    return null;
  }
  if (!data) return null;

  // Defensive: skip rows with a null username (legacy data). The query already
  // filters on username via ilike, so this is purely a type-narrowing guard.
  if (!data.username) return null;

  return {
    id: data.id as string,
    username: data.username as string,
    display_name: (data.display_name as string | null) ?? null,
    bio: (data.bio as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    is_public: Boolean(data.is_public),
  };
}

/**
 * Aggregate stats for a profile page.
 *
 * Returns the four counts the profile screen needs in a single round trip
 * (four parallel head/exact counts). Each individual count silently degrades
 * to 0 on error — the profile page should render *something* even if one of
 * the four queries fails.
 *
 * Notes:
 *   - `listsCount` counts ALL lists owned by `userId` regardless of visibility.
 *     RLS will hide private lists from non-owners, so when this is called by
 *     a non-owner via the anon/authed key, the count reflects only the
 *     publicly visible lists. The caller decides whether that's the intent.
 *   - `itemsCount` counts list_items joined to lists where the parent list is
 *     owned by `userId`. Same RLS-visibility caveat applies. We use the
 *     PostgREST `lists!inner(user_id)` join trick to filter on the parent.
 *   - `followersCount` and `followingCount` come from the `follows` table
 *     (Phase 2 — make sure PHASE-2-MIGRATION.sql has been applied or these
 *     two will return 0 because the table doesn't exist).
 */
export async function fetchProfileStats(userId: string): Promise<{
  listsCount: number;
  itemsCount: number;
  followersCount: number;
  followingCount: number;
}> {
  try {
    const [listsRes, itemsRes, followersRes, followingRes] = await Promise.all([
      supabase
        .from('lists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      // Filter list_items via an inner join to lists.user_id. The select shape
      // doesn't matter (head: true skips the body); we just need PostgREST to
      // emit the JOIN so the eq filter on the joined column works.
      supabase
        .from('list_items')
        .select('lists!inner(user_id)', { count: 'exact', head: true })
        .eq('lists.user_id', userId),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', userId),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    if (listsRes.error) console.error('[fetchProfileStats] lists', userId, listsRes.error.message);
    if (itemsRes.error) console.error('[fetchProfileStats] items', userId, itemsRes.error.message);
    if (followersRes.error) {
      console.error('[fetchProfileStats] followers', userId, followersRes.error.message);
    }
    if (followingRes.error) {
      console.error('[fetchProfileStats] following', userId, followingRes.error.message);
    }

    return {
      listsCount: listsRes.count ?? 0,
      itemsCount: itemsRes.count ?? 0,
      followersCount: followersRes.count ?? 0,
      followingCount: followingRes.count ?? 0,
    };
  } catch (err) {
    console.error('[fetchProfileStats] unexpected', userId, err);
    return { listsCount: 0, itemsCount: 0, followersCount: 0, followingCount: 0 };
  }
}

/**
 * Search public profiles by username OR display_name (case-insensitive
 * prefix-and-substring match via ILIKE %query%).
 *
 * Empty / whitespace-only queries return [] without hitting the network —
 * matches the UX convention of "search shows nothing until you type."
 *
 * Only `is_public = true` profiles are returned. RLS will already hide
 * private profiles, but we filter explicitly so the result is deterministic
 * even if RLS is misconfigured.
 *
 * @param query  Search term.
 * @param limit  Max rows to return. Default 20.
 */
export async function searchUsers(
  query: string,
  limit: number = 20
): Promise<PublicProfile[]> {
  if (!query || !query.trim()) return [];

  // Escape PostgREST `%` / `,` wildcards in the user-supplied term so they
  // can't break the `or(...)` filter syntax. We allow letters/digits/spaces
  // through, but any literal `%`, `*`, `(`, `)`, `,` could change semantics.
  const safe = query.trim().replace(/[%,*()]/g, '');
  if (!safe) return [];

  const pattern = `%${safe}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, is_public')
    .eq('is_public', true)
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .order('username', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[searchUsers]', query, error.message);
    return [];
  }
  if (!data) return [];

  const out: PublicProfile[] = [];
  for (const row of data) {
    // Skip rows with a null username — they don't have a stable handle to
    // navigate to, so they shouldn't appear in search results.
    if (!row.username) continue;
    out.push({
      id: row.id as string,
      username: row.username as string,
      display_name: (row.display_name as string | null) ?? null,
      bio: (row.bio as string | null) ?? null,
      avatar_url: (row.avatar_url as string | null) ?? null,
      is_public: Boolean(row.is_public),
    });
  }
  return out;
}
