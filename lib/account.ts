/**
 * lib/account.ts
 *
 * Account-level helpers for the current user:
 *  - `exportUserData` — assembles a JSON bundle of all the user's own data
 *    for "download my data" UX.
 *  - `userDataToJSON` — pretty-prints an `ExportedUserData` bundle for
 *    sharing/saving.
 *  - `requestAccountDeletion` — best-effort client-side cleanup of the
 *    user's owned rows, then invokes the `delete-account` Edge Function
 *    (source in `docs/edge-functions/delete-account.ts`) which deletes the
 *    `auth.users` row via the service-role admin API. CASCADE FKs handle
 *    any orphan rows that survived the client-side pass.
 *
 * Edge-function dependency:
 *   `requestAccountDeletion` calls `supabase.functions.invoke('delete-account')`.
 *   The function must be deployed first; see `docs/edge-functions/README.md`.
 *
 * Error policy:
 *   - `exportUserData` never throws — degrades to empty arrays on partial
 *     query failures so the user always gets *some* download.
 *   - `requestAccountDeletion` THROWS with a friendly message on hard failure
 *     (no session, edge-function rejected, network error) so the UI can show
 *     a real "couldn't delete" toast and not falsely tell the user it worked.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportedUserData = {
  exported_at: string;
  user_id: string;
  email: string | null;
  profile: {
    username: string | null;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
  } | null;
  lists: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    visibility: string;
    created_at: string;
  }>;
  list_items: Array<{
    id: string;
    list_id: string;
    title: string;
    subtitle: string | null;
    image_url: string | null;
    rank: number | null;
    sentiment: string | null;
    notes: string | null;
    created_at: string;
  }>;
  posts: Array<{
    id: string;
    body: string;
    visibility: string;
    list_item_id: string | null;
    created_at: string;
  }>;
  follows: {
    /** User IDs the current user is following. */
    following: string[];
    /** User IDs that follow the current user. */
    followers: string[];
  };
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Empty export bundle — used as the safe baseline on auth failure. */
function emptyExport(userId: string, email: string | null): ExportedUserData {
  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    email,
    profile: null,
    lists: [],
    list_items: [],
    posts: [],
    follows: { following: [], followers: [] },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a JSON-safe bundle of every row the current user owns.
 *
 * Runs six queries in parallel. Each is independently degraded on error so
 * one failing table doesn't blank the entire export.
 *
 * Returns an `ExportedUserData` even when not signed in — the caller can
 * still hand it to `userDataToJSON` and the user gets a clearly-empty file
 * rather than a thrown exception.
 */
export async function exportUserData(): Promise<ExportedUserData> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) {
      return emptyExport('', null);
    }
    const me = userResult.user.id;
    const email = userResult.user.email ?? null;

    const [
      profileRes,
      listsRes,
      itemsRes,
      postsRes,
      followingRes,
      followersRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, display_name, bio, avatar_url')
        .eq('id', me)
        .maybeSingle(),
      supabase
        .from('lists')
        .select('id, title, description, category, visibility, created_at')
        .eq('user_id', me)
        .order('created_at', { ascending: true }),
      // list_items via inner-join to lists.user_id — works regardless of any
      // direct user_id column on list_items.
      supabase
        .from('list_items')
        .select(`
          id, list_id, title, subtitle, image_url, rank, sentiment, notes, created_at,
          lists!inner ( user_id )
        `)
        .eq('lists.user_id', me)
        .order('created_at', { ascending: true })
        .limit(10000),
      supabase
        .from('posts')
        .select('id, body, visibility, list_item_id, created_at')
        .eq('user_id', me)
        .order('created_at', { ascending: true }),
      supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', me),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('followed_id', me),
    ]);

    // Per-query error logging (no throws — degrade independently).
    if (profileRes.error) console.error('[exportUserData] profile', profileRes.error.message);
    if (listsRes.error) console.error('[exportUserData] lists', listsRes.error.message);
    if (itemsRes.error) console.error('[exportUserData] list_items', itemsRes.error.message);
    if (postsRes.error) console.error('[exportUserData] posts', postsRes.error.message);
    if (followingRes.error) {
      console.error('[exportUserData] following', followingRes.error.message);
    }
    if (followersRes.error) {
      console.error('[exportUserData] followers', followersRes.error.message);
    }

    const profile = profileRes.data
      ? {
          username: (profileRes.data.username as string | null) ?? null,
          display_name: (profileRes.data.display_name as string | null) ?? null,
          bio: (profileRes.data.bio as string | null) ?? null,
          avatar_url: (profileRes.data.avatar_url as string | null) ?? null,
        }
      : null;

    const lists = (listsRes.data ?? []).map((r) => ({
      id: r.id as string,
      title: (r.title as string | null) ?? '',
      description: (r.description as string | null) ?? null,
      category: (r.category as string | null) ?? '',
      visibility: (r.visibility as string | null) ?? 'private',
      created_at: (r.created_at as string | null) ?? '',
    }));

    const list_items = (itemsRes.data ?? []).map((r) => ({
      id: r.id as string,
      list_id: r.list_id as string,
      title: (r.title as string | null) ?? '',
      subtitle: (r.subtitle as string | null) ?? null,
      image_url: (r.image_url as string | null) ?? null,
      rank: (r.rank as number | null) ?? null,
      sentiment: (r.sentiment as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? '',
    }));

    const posts = (postsRes.data ?? []).map((r) => ({
      id: r.id as string,
      body: (r.body as string | null) ?? '',
      visibility: (r.visibility as string | null) ?? 'private',
      list_item_id: (r.list_item_id as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? '',
    }));

    const following = (followingRes.data ?? [])
      .map((r) => (r as { followed_id?: unknown }).followed_id)
      .filter((id): id is string => typeof id === 'string');
    const followers = (followersRes.data ?? [])
      .map((r) => (r as { follower_id?: unknown }).follower_id)
      .filter((id): id is string => typeof id === 'string');

    return {
      exported_at: new Date().toISOString(),
      user_id: me,
      email,
      profile,
      lists,
      list_items,
      posts,
      follows: { following, followers },
    };
  } catch (err) {
    console.error('[exportUserData] unexpected', err);
    return emptyExport('', null);
  }
}

/**
 * Pretty-print an `ExportedUserData` bundle to a JSON string suitable for
 * saving / sharing. Uses 2-space indentation for readability.
 */
export function userDataToJSON(data: ExportedUserData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Request permanent deletion of the current user's account.
 *
 * Flow:
 *   1. Resolve the current user (throw "You must be signed in." on miss).
 *   2. Best-effort client-side cleanup of the user's own rows, in dependency
 *      order so RLS doesn't reject anything:
 *        a. posts          (top-level, may reference list_items via SET NULL)
 *        b. comments       (depend on list_items)
 *        c. likes          (depend on list_items)
 *        d. watched_with   (depends on list_items + tagged users)
 *        e. list_items     (RLS via parent list ownership)
 *        f. lists          (the parent rows)
 *        g. push_tokens    (per-device tokens)
 *        h. profile        (the per-user row)
 *      Each step logs but does NOT throw on error — CASCADE FKs in
 *      `auth.users` cleanup (step 3) will sweep up anything that survived.
 *   3. Invoke the `delete-account` Edge Function via
 *      `supabase.functions.invoke('delete-account')`. This is the authoritative
 *      step: it deletes the `auth.users` row using the service-role admin
 *      API, and CASCADE FKs propagate to every Phase-1-through-5 table.
 *      Throws on edge-function error with a friendly message.
 *   4. Sign out so the app's auth listener routes to the login screen.
 *
 * Throws:
 *   - "You must be signed in."                            if no session.
 *   - "Couldn't delete your account. Please try again."   on edge-function or
 *                                                         network failure.
 */
export async function requestAccountDeletion(): Promise<void> {
  const { data: userResult, error: authError } = await supabase.auth.getUser();
  if (authError || !userResult.user) {
    throw new Error('You must be signed in.');
  }
  const me = userResult.user.id;

  // Step 2: best-effort client-side cleanup in dependency order. We do NOT
  // throw on any per-table error here — the edge function's auth.users
  // deletion + CASCADE FKs is the authoritative cleanup. Logging only.
  type StepResult = { error: { message?: string } | null };
  const log = (label: string, res: StepResult) => {
    if (res.error) console.error('[requestAccountDeletion]', label, res.error.message);
  };

  // a. posts authored by me
  log('posts', await supabase.from('posts').delete().eq('user_id', me));
  // b. comments authored by me
  log('comments', await supabase.from('comments').delete().eq('user_id', me));
  // c. likes by me
  log('likes', await supabase.from('likes').delete().eq('user_id', me));
  // d. watched_with where I'm the tagged user (the only DELETE I can issue
  //    here under RLS for that table — tags on my own items are removed via
  //    the list_items CASCADE in step (e)/(f)).
  log(
    'watched_with',
    await supabase.from('watched_with').delete().eq('tagged_user_id', me)
  );
  // e. list_items: RLS lets me delete items whose parent list I own. We
  //    don't have user_id on list_items directly, so we use a two-step:
  //    fetch list ids, then delete items by list_id IN (...).
  const { data: myListIds } = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', me);
  const listIds = (myListIds ?? [])
    .map((r) => (r as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
  if (listIds.length > 0) {
    log(
      'list_items',
      await supabase.from('list_items').delete().in('list_id', listIds)
    );
  }
  // f. lists themselves
  log('lists', await supabase.from('lists').delete().eq('user_id', me));
  // g. push_tokens for this user (Phase 5)
  log(
    'push_tokens',
    await supabase.from('push_tokens').delete().eq('user_id', me)
  );
  // h. profile row
  log('profile', await supabase.from('profiles').delete().eq('id', me));

  // Step 3: invoke the edge function for the auth.users deletion. This is
  // the authoritative step — without it the user can sign back in and see
  // a half-empty account.
  const { error: fnError } = await supabase.functions.invoke('delete-account');
  if (fnError) {
    console.error('[requestAccountDeletion] edge function', fnError.message);
    throw new Error("Couldn't delete your account. Please try again.");
  }

  // Step 4: sign out so the root auth listener routes to the login screen.
  // signOut errors are non-fatal at this point — the account is already gone
  // server-side — but we log them.
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    console.error('[requestAccountDeletion] signOut', signOutError.message);
  }
}
