/**
 * lib/feed.ts
 *
 * Unified Home-feed for the Rankr social layer.
 *
 * The feed is a discriminated union of two event kinds, merged by recency:
 *
 *   1. Posts          — short-form notes from `public.posts` (Phase 4).
 *   2. Ranking events — newly-ranked `list_items` from either the current
 *                       user themselves OR users they follow, provided the
 *                       parent list is public (for followed users) or owned
 *                       by the current user (for their own private items).
 *
 * Sorting: created_at DESC across both kinds. Cursor pagination via
 * `beforeCreatedAt`.
 *
 * Error policy: degrades to `[]` on any error (auth miss, partial query
 * failures, etc.). Consistent with the rest of `lib/` — the Home feed is a
 * non-critical surface; if it can't load, the rest of the app should not
 * break.
 *
 * Dependencies:
 *   - `getFeedPosts` from `lib/posts.ts` for the posts side of the union.
 *     This module imports the existing helper rather than duplicating its
 *     RLS-driven feed logic.
 *   - Direct `list_items + lists + profiles` queries for ranking events.
 *
 * Profile-join strategy:
 *   For ranking events we use a TWO-STEP fetch (list_items + lists first,
 *   then profiles by owner-id) rather than a single PostgREST nested join.
 *   Rationale: in this project's schema, the relationship chain
 *   `list_items.list_id → lists.user_id → auth.users.id ← profiles.id`
 *   is not a direct FK from any column on `list_items` to `profiles`, so
 *   PostgREST's auto-discovered embeds can fail with "Could not embed
 *   because more than one relationship was found" or simply omit the
 *   profile. Two-step is mechanical and predictable.
 */

import { supabase } from '@/lib/supabase';
import { getFeedPosts, type Post } from '@/lib/posts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A ranking event surfaces a `list_items` row that has a non-null `rank`.
 * The synthetic `id` namespaces it so it never collides with a `Post.id`
 * (which is a raw UUID).
 */
export type RankingEvent = {
  /** Synthetic id: `ranking:${list_item.id}`. Stable across re-fetches. */
  id: string;
  /** Owner of the parent list — the "author" of the ranking event. */
  user_id: string;
  /** Wall-clock for the event. `list_item.created_at`. */
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  list_item: {
    /** Real `list_items.id` — use this for navigation, not the synthetic feed id. */
    id: string;
    title: string;
    subtitle: string | null;
    image_url: string | null;
    category: string;
    /** Always non-null — we filter `rank IS NOT NULL` server-side. */
    rank: number;
  };
  list: {
    id: string;
    title: string;
    visibility: 'public' | 'private';
  };
  /** `list_items.notes`. Null or empty when the user didn't add a note. */
  notes: string | null;
};

/** Discriminated union — UI switches on `kind` to pick a renderer. */
export type FeedItem =
  | { kind: 'post'; post: Post }
  | { kind: 'ranking'; event: RankingEvent };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * PostgREST returns to-one relations as either an object or null (or, in
 * some client versions, a single-element array). Normalize both shapes.
 */
function extractOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

/** Shape of the joined `lists` relation in a list_items select. */
type EmbeddedList = {
  id: string;
  user_id: string;
  title: string | null;
  visibility: string | null;
};

/** Slim profile row used to resolve a ranking event's author. */
type ProfileSlim = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Narrow `visibility` to the tagged union. Anything we don't recognise is
 * treated as 'private' (safer default — never accidentally widen exposure).
 */
function normalizeVisibility(v: unknown): 'public' | 'private' {
  return v === 'public' ? 'public' : 'private';
}

/**
 * Pull the current user's "followed user IDs" set, plus the current user
 * themselves. We always include the current user so their OWN ranked items
 * show in their feed (matching the brief: "the user themselves OR users
 * they follow").
 *
 * Returns the set even on partial errors; on total failure returns
 * `{ ids: [myUserId] }` so the user still sees their own activity.
 */
async function fetchFollowedUserIds(myUserId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followed_id')
    .eq('follower_id', myUserId);

  if (error) {
    console.error('[feed] fetchFollowedUserIds', error.message);
    return [myUserId];
  }

  const ids = new Set<string>([myUserId]);
  for (const row of data ?? []) {
    const id = (row as { followed_id?: string }).followed_id;
    if (typeof id === 'string') ids.add(id);
  }
  return Array.from(ids);
}

/**
 * Fetch ranking events visible to `myUserId`:
 *
 *   - parent list owned by myUserId OR by someone myUserId follows,
 *   - parent list is public (for followed-user items) OR owned by myUserId
 *     (so the caller's private ranked items still show in their own feed),
 *   - `rank IS NOT NULL` (only ranked items count as "ranking events"),
 *   - paginated by `created_at < beforeCreatedAt` when provided.
 *
 * We over-fetch by `limit` for each query path so that after the merge in
 * `getFeed` we still have enough rows to fill a page after the union sort.
 */
async function fetchRankingEvents(
  myUserId: string,
  limit: number,
  beforeCreatedAt?: string
): Promise<RankingEvent[]> {
  try {
    const ownerIds = await fetchFollowedUserIds(myUserId);
    if (ownerIds.length === 0) return [];

    // Pull list_items + parent list info. We do the
    // (public-or-mine) visibility filter as an `.or(...)` clause so it's
    // evaluated server-side. PostgREST `or` syntax expects comma-separated
    // conditions inside the parens.
    //
    // Filters by relation columns use the `relation.column` form, which the
    // current Supabase JS client supports.
    let q = supabase
      .from('list_items')
      .select(`
        id,
        title,
        subtitle,
        image_url,
        category,
        rank,
        notes,
        created_at,
        lists!inner ( id, user_id, title, visibility )
      `)
      .not('rank', 'is', null)
      .in('lists.user_id', ownerIds)
      .or(`visibility.eq.public,user_id.eq.${myUserId}`, { foreignTable: 'lists' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeCreatedAt) {
      q = q.lt('created_at', beforeCreatedAt);
    }

    const { data, error } = await q;

    if (error) {
      console.error('[feed] fetchRankingEvents items', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Step 2: resolve profiles for the unique owner IDs we actually saw.
    // (Cheaper than a per-row join and works regardless of PostgREST's
    // FK introspection quirks for the indirect list_items → profiles chain.)
    const seenOwnerIds = new Set<string>();
    const rows: Array<{
      row: Record<string, unknown>;
      list: EmbeddedList;
    }> = [];

    for (const raw of data) {
      const row = raw as Record<string, unknown>;
      const list = extractOne<EmbeddedList>(
        (row as { lists?: EmbeddedList | EmbeddedList[] | null }).lists
      );
      if (!list || typeof list.user_id !== 'string') continue;
      seenOwnerIds.add(list.user_id);
      rows.push({ row, list });
    }

    const profileMap = new Map<string, ProfileSlim>();
    if (seenOwnerIds.size > 0) {
      const { data: profileRows, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', Array.from(seenOwnerIds));

      if (profileErr) {
        console.error('[feed] fetchRankingEvents profiles', profileErr.message);
        // Keep going — events without an author still render, just with
        // null author fields. Better than zero events.
      } else {
        for (const p of profileRows ?? []) {
          const id = (p as { id?: unknown }).id;
          if (typeof id !== 'string') continue;
          profileMap.set(id, {
            id,
            username: ((p as { username?: unknown }).username as string | null) ?? null,
            display_name:
              ((p as { display_name?: unknown }).display_name as string | null) ?? null,
            avatar_url:
              ((p as { avatar_url?: unknown }).avatar_url as string | null) ?? null,
          });
        }
      }
    }

    // Build the final RankingEvent shape.
    const out: RankingEvent[] = [];
    for (const { row, list } of rows) {
      const itemId = row.id;
      const rank = row.rank;
      if (typeof itemId !== 'string' || typeof rank !== 'number') continue;

      const author = profileMap.get(list.user_id);

      out.push({
        id: `ranking:${itemId}`,
        user_id: list.user_id,
        created_at: typeof row.created_at === 'string' ? row.created_at : '',
        author: {
          username: author?.username ?? null,
          display_name: author?.display_name ?? null,
          avatar_url: author?.avatar_url ?? null,
        },
        list_item: {
          id: itemId,
          title: typeof row.title === 'string' ? row.title : '',
          subtitle: (row.subtitle as string | null) ?? null,
          image_url: (row.image_url as string | null) ?? null,
          category: typeof row.category === 'string' ? row.category : '',
          rank,
        },
        list: {
          id: list.id,
          title: list.title ?? 'Unknown List',
          visibility: normalizeVisibility(list.visibility),
        },
        notes: (row.notes as string | null) ?? null,
      });
    }
    return out;
  } catch (err) {
    console.error('[feed] fetchRankingEvents unexpected', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Unified feed: posts visible to the current user PLUS ranking events from
 * the current user and the users they follow.
 *
 * Sorted by created_at DESC. Cursor pagination via `beforeCreatedAt`.
 *
 * @param limit             Max items in the merged result. Default 30.
 * @param beforeCreatedAt   Optional ISO timestamp; only items strictly older
 *                          than this are returned. Use the last visible
 *                          item's `created_at` (from either kind) to paginate.
 *
 * Returns [] when the user is not signed in or on any error.
 */
export async function getFeed(
  limit: number = 30,
  beforeCreatedAt?: string
): Promise<FeedItem[]> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return [];
    const myUserId = userResult.user.id;

    // Run the two sources in parallel. Each is over-fetched up to `limit`
    // so that after merge+slice we have a full page (worst case: all items
    // come from one source, which is fine).
    const [posts, rankings] = await Promise.all([
      getFeedPosts(limit, beforeCreatedAt),
      fetchRankingEvents(myUserId, limit, beforeCreatedAt),
    ]);

    const merged: FeedItem[] = [
      ...posts.map((post): FeedItem => ({ kind: 'post', post })),
      ...rankings.map((event): FeedItem => ({ kind: 'ranking', event })),
    ];

    // Sort by created_at DESC. ISO 8601 timestamps sort correctly as strings.
    merged.sort((a, b) => {
      const aT = a.kind === 'post' ? a.post.created_at : a.event.created_at;
      const bT = b.kind === 'post' ? b.post.created_at : b.event.created_at;
      // localeCompare gives a stable lexicographic order; reverse for DESC.
      return bT.localeCompare(aT);
    });

    return merged.slice(0, limit);
  } catch (err) {
    console.error('[getFeed] unexpected', err);
    return [];
  }
}
