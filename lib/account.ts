/** Account export (legacy partial bundle) and authoritative server deletion.
 * Export completeness limitations are tracked in docs/BACKEND-REVIEW.md.
 * Deletion never removes client rows before the server acknowledges success.
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

/** The server deletes storage first, then auth + cascading rows. Retry on failure. */
export async function requestAccountDeletion(): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('You must be signed in.');
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error || data?.ok !== true) throw new Error("Couldn't finish deleting your account. Please try again.");
  await supabase.auth.signOut({ scope: 'local' });
}
