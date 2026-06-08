/**
 * lib/queries.ts
 * Optimized Supabase query helpers for the Rankr app.
 *
 * Replaces the N+1 home-screen fetch (fetch items, then fetch each list title
 * individually) with a single nested select that retrieves list_items joined
 * to their parent list's title in one round-trip.
 *
 * Also exports helpers for the "For You" recommendations feed:
 *   - fetchTopRankedByCategory
 *   - fetchAllExternalIdsByCategory
 */

import { supabase } from '@/lib/supabase';
import type { RecCategory } from '@/lib/recommendations';

/** Shape returned by fetchRecentItemsWithListTitles — matches what HomeScreen renders */
export type RecentItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  rank: number | null;
  sentiment: string | null;
  list_title: string;
  created_at: string;
};

/**
 * Fetches the most-recently-created list_items, each enriched with the
 * parent list's title — all in a single Supabase query via a nested select.
 *
 * @param limit  Maximum number of items to return (default 20)
 * @returns      Array of RecentItem sorted by created_at DESC
 *
 * Usage example (HomeScreen):
 *   import { fetchRecentItemsWithListTitles } from '@/lib/queries';
 *   const items = await fetchRecentItemsWithListTitles(20);
 */
export async function fetchRecentItemsWithListTitles(
  limit: number = 20
): Promise<RecentItem[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select(`
      id,
      title,
      subtitle,
      image_url,
      rank,
      sentiment,
      created_at,
      lists ( title )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchRecentItemsWithListTitles]', error.message);
    return [];
  }

  if (!data) return [];

  return data.map((row) => {
    // Supabase returns the joined `lists` as either an object or null.
    // The TypeScript type from the auto-generated client is an array when
    // using a to-one relation without .single(), so we handle both shapes.
    const listsRel = row.lists as { title: string } | { title: string }[] | null;
    let list_title = 'Unknown List';
    if (Array.isArray(listsRel)) {
      list_title = listsRel[0]?.title ?? 'Unknown List';
    } else if (listsRel && typeof listsRel === 'object') {
      list_title = listsRel.title ?? 'Unknown List';
    }

    return {
      id: row.id as string,
      title: row.title as string,
      subtitle: row.subtitle as string | null,
      image_url: row.image_url as string | null,
      rank: row.rank as number | null,
      sentiment: row.sentiment as string | null,
      created_at: row.created_at as string,
      list_title,
    };
  });
}

// ---------------------------------------------------------------------------
// For You — recommendations feed helpers
// ---------------------------------------------------------------------------

/**
 * Top-ranked items in a category across all the user's lists.
 *
 * Joins list_items → lists so it can filter by lists.category. User-scoping
 * is handled automatically by Supabase RLS (lists.user_id = auth.uid()).
 *
 * @param category  One of `RecCategory` ('movies' | 'games' | 'music' | 'books' | 'tv')
 * @param limit     Maximum number of items to return (default 10)
 */
export async function fetchTopRankedByCategory(
  category: RecCategory,
  limit: number = 10
): Promise<{ external_id: string; title: string; rank: number }[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select(`
      external_id,
      title,
      rank,
      lists ( category )
    `)
    .not('rank', 'is', null)
    .order('rank', { ascending: false })
    .limit(limit * 5); // over-fetch then filter, since we can't filter on the relation column directly in all client versions

  if (error) {
    console.error('[fetchTopRankedByCategory]', error.message);
    return [];
  }

  if (!data) return [];

  // Filter by category from the joined lists relation and shape the result.
  const filtered: { external_id: string; title: string; rank: number }[] = [];
  for (const row of data) {
    const listsRel = row.lists as { category: string } | { category: string }[] | null;
    let rowCategory: string | null = null;
    if (Array.isArray(listsRel)) {
      rowCategory = listsRel[0]?.category ?? null;
    } else if (listsRel && typeof listsRel === 'object') {
      rowCategory = (listsRel as { category: string }).category ?? null;
    }

    if (rowCategory !== category) continue;
    if (!row.external_id || row.rank == null) continue;

    filtered.push({
      external_id: row.external_id as string,
      title: row.title as string,
      rank: row.rank as number,
    });

    if (filtered.length >= limit) break;
  }

  return filtered;
}

/**
 * All external_ids the user already has in any list of this category.
 * Used to deduplicate recommendation feeds (don't suggest items they already have).
 *
 * User-scoping is handled automatically by Supabase RLS (lists.user_id = auth.uid()).
 *
 * @param category  One of `RecCategory` ('movies' | 'games' | 'music' | 'books' | 'tv')
 */
export async function fetchAllExternalIdsByCategory(
  category: RecCategory
): Promise<string[]> {
  // Over-fetch to cover large collections; 1000 is well above any reasonable list size.
  const { data, error } = await supabase
    .from('list_items')
    .select(`
      external_id,
      lists ( category )
    `)
    .limit(1000);

  if (error) {
    console.error('[fetchAllExternalIdsByCategory]', error.message);
    return [];
  }

  if (!data) return [];

  const ids: string[] = [];
  for (const row of data) {
    const listsRel = row.lists as { category: string } | { category: string }[] | null;
    let rowCategory: string | null = null;
    if (Array.isArray(listsRel)) {
      rowCategory = listsRel[0]?.category ?? null;
    } else if (listsRel && typeof listsRel === 'object') {
      rowCategory = (listsRel as { category: string }).category ?? null;
    }

    if (rowCategory !== category) continue;
    if (!row.external_id) continue;

    ids.push(row.external_id as string);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Per-list helpers (v2 "For You" per-list feed)
// ---------------------------------------------------------------------------

/**
 * A single list row returned by fetchUserLists.
 * RLS on the `lists` table automatically scopes results to the current user.
 */
export type UserList = {
  id: string;
  title: string;
  category: RecCategory;
  created_at: string;
};

/**
 * All of the current user's lists, optionally filtered to a single category.
 * Ordered by created_at DESC (newest first).
 *
 * RLS filters to the current user automatically — no explicit user_id filter needed.
 *
 * @param category  When provided, only lists of that category are returned.
 */
export async function fetchUserLists(
  category?: RecCategory
): Promise<UserList[]> {
  let query = supabase
    .from('lists')
    .select('id, title, category, created_at')
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[fetchUserLists]', error.message);
    return [];
  }

  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    category: row.category as RecCategory,
    created_at: row.created_at as string,
  }));
}

/**
 * Top-ranked items within a specific list, ordered by rank DESC.
 * Items with a null rank or a falsy external_id are excluded.
 *
 * RLS on list_items (via the parent list) scopes results to the current user.
 *
 * @param listId  UUID of the list.
 * @param limit   Maximum number of items to return (default 10).
 */
export async function fetchTopRankedInList(
  listId: string,
  limit: number = 10
): Promise<{ external_id: string; title: string; rank: number }[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('external_id, title, rank')
    .eq('list_id', listId)
    .not('rank', 'is', null)
    .order('rank', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchTopRankedInList]', listId, error.message);
    return [];
  }

  if (!data) return [];

  const result: { external_id: string; title: string; rank: number }[] = [];
  for (const row of data) {
    // Skip rows with a missing or empty external_id — they cannot be used as
    // recommendation sources and would produce bad API requests.
    if (!row.external_id || row.rank == null) continue;
    result.push({
      external_id: row.external_id as string,
      title: row.title as string,
      rank: row.rank as number,
    });
  }

  return result;
}

/**
 * All external_ids present in a specific list.
 * Used to build the dedup exclude-set for the per-list recommendation feed
 * (we don't want to recommend items the user already has in that list).
 *
 * RLS on list_items scopes results to the current user automatically.
 *
 * @param listId  UUID of the list.
 */
export async function fetchAllExternalIdsInList(listId: string): Promise<string[]> {
  // 1 000 is a generous upper bound; no real list will hit this in practice.
  const { data, error } = await supabase
    .from('list_items')
    .select('external_id')
    .eq('list_id', listId)
    .limit(1000);

  if (error) {
    console.error('[fetchAllExternalIdsInList]', listId, error.message);
    return [];
  }

  if (!data) return [];

  const ids: string[] = [];
  for (const row of data) {
    if (!row.external_id) continue;
    ids.push(row.external_id as string);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Public-profile reads (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Public lists owned by a specific user. Filters to `visibility = 'public'`
 * explicitly even though RLS would already hide private lists from a
 * non-owner — the explicit filter makes the intent clear and means this
 * helper returns the same data whether called by the owner or a stranger.
 *
 * Reuses the existing `UserList` shape so the UI can render public and
 * private lists with the same components.
 *
 * Ordered by created_at DESC (newest first).
 *
 * @param userId  The user whose public lists to fetch.
 * @param limit   Max rows to return. Default 50.
 *
 * Returns [] on error.
 */
export async function fetchPublicListsByUserId(
  userId: string,
  limit: number = 50
): Promise<UserList[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, title, category, created_at')
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[fetchPublicListsByUserId]', userId, error.message);
    return [];
  }

  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    category: row.category as RecCategory,
    created_at: row.created_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Item-detail with owner context (Phase 3)
// ---------------------------------------------------------------------------

/**
 * A list_item enriched with its parent list's id, title, owner, and
 * visibility. Used by the item-detail screen to render context like
 * "from <list-title>" and to decide whether the current user can comment /
 * like (those actions are gated on `list_visibility === 'public'`).
 *
 * Field names match the underlying columns so frontend reconciliation is
 * mechanical:
 *   - list_user_id    → lists.user_id   (parent list's owner)
 *   - list_title      → lists.title
 *   - list_visibility → lists.visibility
 *   - all other fields → list_items.<same name>
 */
export type ListItemDetail = {
  id: string;
  list_id: string;
  list_user_id: string;
  list_title: string;
  list_visibility: 'public' | 'private';
  title: string;
  subtitle: string | null;
  image_url: string | null;
  external_id: string | null;
  /**
   * Loose `string` rather than `RecCategory` because list_items.category is
   * historically unconstrained at the database level — legacy rows may carry
   * unexpected values. Callers should narrow with a `case` switch over
   * `RecCategory` and fall back to a generic renderer for anything else.
   */
  category: string;
  rank: number | null;
  sentiment: string | null;
  notes: string | null;
  photo_urls: string[] | null;
  bookmarked: boolean;
  created_at: string;
};

/**
 * Fetch a single list_item joined with its parent list's owner, title, and
 * visibility. Used by the item-detail screen.
 *
 * Returns `null` when the item is not found OR when RLS hides it (caller can't
 * distinguish; both are surfaced as "not visible to me," which matches the UX).
 *
 * RLS visibility rules (from Phase 1):
 *   - Owners always see their own items via the existing per-owner SELECT
 *     policy on list_items.
 *   - Non-owners see items only when the parent list has visibility='public'.
 *
 * @param itemId  UUID of the list_item.
 */
export async function fetchListItemWithOwner(itemId: string): Promise<ListItemDetail | null> {
  const { data, error } = await supabase
    .from('list_items')
    .select(`
      id, list_id, title, subtitle, image_url, external_id, category,
      rank, sentiment, notes, photo_urls, bookmarked, created_at,
      lists ( id, user_id, title, visibility )
    `)
    .eq('id', itemId)
    .maybeSingle();

  if (error) {
    console.error('[fetchListItemWithOwner]', itemId, error.message);
    return null;
  }
  if (!data) return null;

  // PostgREST returns the joined `lists` as either an object or null (or, in
  // older client versions, a one-element array). Normalize both shapes.
  const listsRel = data.lists as
    | { id: string; user_id: string; title: string; visibility: string }
    | { id: string; user_id: string; title: string; visibility: string }[]
    | null;

  let list: { id: string; user_id: string; title: string; visibility: string } | null = null;
  if (Array.isArray(listsRel)) {
    list = listsRel[0] ?? null;
  } else if (listsRel && typeof listsRel === 'object') {
    list = listsRel;
  }

  // If the parent list relation didn't come back (RLS-filtered parent, broken
  // FK, etc.), treat the item as not visible. The caller renders the same
  // "not found" UI either way.
  if (!list) return null;

  // Normalize visibility into the narrow union. Anything we don't recognise
  // is treated as 'private' — safer default.
  const visibility: 'public' | 'private' = list.visibility === 'public' ? 'public' : 'private';

  // photo_urls is stored as jsonb. The PostgREST client surfaces it as
  // unknown; coerce to string[] when array-shaped, otherwise null.
  let photoUrls: string[] | null = null;
  const rawPhotos = data.photo_urls as unknown;
  if (Array.isArray(rawPhotos)) {
    photoUrls = rawPhotos.filter((u): u is string => typeof u === 'string');
  }

  return {
    id: data.id as string,
    list_id: data.list_id as string,
    list_user_id: list.user_id,
    list_title: list.title ?? 'Unknown List',
    list_visibility: visibility,
    title: data.title as string,
    subtitle: (data.subtitle as string | null) ?? null,
    image_url: (data.image_url as string | null) ?? null,
    external_id: (data.external_id as string | null) ?? null,
    category: data.category as string,
    rank: (data.rank as number | null) ?? null,
    sentiment: (data.sentiment as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    photo_urls: photoUrls,
    bookmarked: Boolean(data.bookmarked),
    created_at: data.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Public-list browse (Phase 7) — used by the discover screen
// ---------------------------------------------------------------------------

/**
 * One row in the discover-screen feed: a public list with its owner profile
 * and item count attached.
 *
 * `category` is `string` rather than `RecCategory` because legacy DB rows
 * may carry unexpected values (matches the loosening done on
 * `ListItemDetail.category`).
 */
export type PublicListSummary = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  item_count: number;
  owner: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
};

/**
 * Browse public lists across the platform. Used by the discover screen.
 *
 * Sort: by `item_count` DESC, then by `created_at` DESC. Lists with more
 * ranked items appear first; ties are broken by recency.
 *
 * Implementation note:
 *   This is a THREE-QUERY pattern, not a one-shot nested-select. Reason:
 *   `lists.user_id` has a direct FK to `auth.users(id)` but NOT to
 *   `profiles(id)` — the Phase-2 hotfix added direct profile FKs for posts,
 *   comments, likes, watched_with, and follows, but deliberately skipped
 *   `lists` (see `docs/HOTFIX-1-PROFILE-FKS.sql`). Without that FK,
 *   PostgREST can't auto-embed `lists → profiles`. The three-query approach
 *   is mechanical and works regardless of which FKs exist.
 *
 *   Query 1: fetch up to `limit` public lists matching the category filter,
 *            sorted by created_at DESC.
 *   Query 2: aggregate item counts via PostgREST's group-by on a `count`
 *            select, scoped to those list ids.
 *   Query 3: fetch the owner profiles in one `in('id', ...)` query.
 *
 * Empty / failed queries degrade independently:
 *   - missing item-count → 0 (the list still renders, just with "0 items").
 *   - missing owner profile → empty owner fields (the list still renders).
 *
 * @param category  Optional category filter ('movies' | 'tv' | 'games' |
 *                  'music' | 'books'; any string accepted at the type level).
 * @param limit     Max rows to return. Default 30.
 *
 * Returns [] on a hard error (auth absent — not required here, since public
 * lists are anon-readable — or the lists query itself failing).
 */
export async function fetchPublicLists(
  category?: string,
  limit: number = 30
): Promise<PublicListSummary[]> {
  try {
    // ---- Query 1: public lists, optionally filtered by category ------------
    let listsQuery = supabase
      .from('lists')
      .select('id, user_id, title, description, category, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) {
      listsQuery = listsQuery.eq('category', category);
    }

    const { data: listsData, error: listsError } = await listsQuery;

    if (listsError) {
      console.error('[fetchPublicLists] lists', listsError.message);
      return [];
    }
    if (!listsData || listsData.length === 0) return [];

    // Collect ids for the next two queries.
    const listIds: string[] = [];
    const ownerIds = new Set<string>();
    for (const row of listsData) {
      const id = (row as { id?: unknown }).id;
      const userId = (row as { user_id?: unknown }).user_id;
      if (typeof id === 'string') listIds.push(id);
      if (typeof userId === 'string') ownerIds.add(userId);
    }

    // ---- Queries 2 + 3: item counts and owner profiles in parallel ---------
    const [countsRes, ownersRes] = await Promise.all([
      // Item-count per list. We fetch (list_id) rows in batch and count
      // client-side rather than relying on PostgREST GROUP BY (which it
      // doesn't expose) or N parallel head-counts (which is wasteful for
      // >5 lists). Cap the row fetch at a large but bounded number so a
      // pathological list with millions of items doesn't bloat the response.
      supabase
        .from('list_items')
        .select('list_id')
        .in('list_id', listIds)
        .limit(100000),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', Array.from(ownerIds)),
    ]);

    if (countsRes.error) {
      console.error('[fetchPublicLists] counts', countsRes.error.message);
    }
    if (ownersRes.error) {
      console.error('[fetchPublicLists] owners', ownersRes.error.message);
    }

    // Aggregate counts by list_id.
    const itemCount = new Map<string, number>();
    for (const row of countsRes.data ?? []) {
      const lid = (row as { list_id?: unknown }).list_id;
      if (typeof lid !== 'string') continue;
      itemCount.set(lid, (itemCount.get(lid) ?? 0) + 1);
    }

    // Index owner profiles by id.
    type OwnerRow = {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
    const ownerMap = new Map<string, OwnerRow>();
    for (const raw of ownersRes.data ?? []) {
      const o = raw as Record<string, unknown>;
      const id = o.id;
      if (typeof id !== 'string') continue;
      ownerMap.set(id, {
        id,
        username: (o.username as string | null) ?? null,
        display_name: (o.display_name as string | null) ?? null,
        avatar_url: (o.avatar_url as string | null) ?? null,
      });
    }

    // ---- Zip ---------------------------------------------------------------
    const out: PublicListSummary[] = [];
    for (const raw of listsData) {
      const r = raw as Record<string, unknown>;
      const id = r.id;
      const userId = r.user_id;
      if (typeof id !== 'string' || typeof userId !== 'string') continue;

      const owner = ownerMap.get(userId) ?? {
        id: userId,
        username: null,
        display_name: null,
        avatar_url: null,
      };

      out.push({
        id,
        title: typeof r.title === 'string' ? r.title : '',
        description: (r.description as string | null) ?? null,
        category: typeof r.category === 'string' ? r.category : '',
        item_count: itemCount.get(id) ?? 0,
        owner,
        created_at: typeof r.created_at === 'string' ? r.created_at : '',
      });
    }

    // Sort: item_count DESC, then created_at DESC (tiebreaker).
    out.sort((a, b) => {
      if (b.item_count !== a.item_count) return b.item_count - a.item_count;
      // ISO 8601 strings sort lexicographically the same as chronologically.
      return b.created_at.localeCompare(a.created_at);
    });

    // Final cap (defensive — listsData was already limited, but explicit
    // limit here matches the documented contract).
    return out.slice(0, limit);
  } catch (err) {
    console.error('[fetchPublicLists] unexpected', err);
    return [];
  }
}
