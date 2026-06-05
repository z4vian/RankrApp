/**
 * lib/insights.ts
 *
 * Year-in-review insights for the current user.
 *
 * Computes per-year aggregates from the user's `lists`, `list_items`, and
 * `posts` tables. PostgREST doesn't expose GROUP BY in a clean way, so the
 * "breakdown" stats (sentiment, category, most-active-month) are computed
 * client-side from a single fetch of the relevant rows. The other counts use
 * `count: 'exact', head: true` for speed.
 *
 * Error policy: matches the rest of `lib/`. Never throws — returns a fully
 * shaped `YearInsights` with sensible zero/empty defaults on any failure.
 * The "year in review" screen should always render *something*, even if one
 * of the underlying queries fails.
 *
 * Date boundaries:
 *   - Inclusive lower bound: Jan 1, 00:00:00 UTC of `year`.
 *   - Exclusive upper bound: Jan 1, 00:00:00 UTC of `year + 1`.
 *   This avoids ambiguity around month end-of-day and leap years.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type YearInsights = {
  year: number;
  total_items_ranked: number;
  total_lists_created: number;
  top_5_items: Array<{
    list_item_id: string;
    title: string;
    image_url: string | null;
    rank: number;
    category: string;
    list_title: string;
  }>;
  sentiment_breakdown: {
    liked: number;
    didnt_care: number;
    didnt_like: number;
  };
  /** Counts keyed by category name (e.g. { movies: 42, games: 7, books: 3 }). */
  category_breakdown: Record<string, number>;
  /** Month is 1–12 (Jan = 1). Null when there's no activity in the year. */
  most_active_month: { month: number; count: number } | null;
  /** Mean of all non-null ranks created in the year. Null when zero ranks. */
  average_rank: number | null;
  posts_made: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the half-open UTC range [start, end) for a given calendar year.
 * Half-open avoids the "is 23:59:59.999 inclusive?" trap.
 */
function yearBoundsUtc(year: number): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Default empty result so error paths always return a valid shape. */
function emptyInsights(year: number): YearInsights {
  return {
    year,
    total_items_ranked: 0,
    total_lists_created: 0,
    top_5_items: [],
    sentiment_breakdown: { liked: 0, didnt_care: 0, didnt_like: 0 },
    category_breakdown: {},
    most_active_month: null,
    average_rank: null,
    posts_made: 0,
  };
}

/** PostgREST returns to-one relations as object or array; normalize. */
function extractOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute year-in-review stats for the current user.
 *
 * All queries are RLS-scoped: `list_items` is filtered via a join to
 * `lists.user_id = me`; `lists` and `posts` are filtered directly by
 * `user_id`. RLS would already restrict everything to the current user, but
 * the explicit `user_id` filters are kept for clarity and to keep query
 * plans tight.
 *
 * @param year  Calendar year (e.g. 2026). Defaults to the current UTC year.
 *
 * Never throws. Returns zero/empty defaults on any error.
 */
export async function getYearInsights(year?: number): Promise<YearInsights> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) {
      return emptyInsights(year ?? new Date().getUTCFullYear());
    }
    const me = userResult.user.id;

    const resolvedYear = year ?? new Date().getUTCFullYear();
    const { startIso, endIso } = yearBoundsUtc(resolvedYear);

    // -------------------------------------------------------------------------
    // Five parallel queries:
    //   1. Total items ranked       — count via head/exact
    //   2. Total lists created      — count via head/exact
    //   3. Top 5 items              — joined select
    //   4. All list_items in year   — for sentiment / category / month / avg
    //   5. Posts made               — count via head/exact
    // -------------------------------------------------------------------------
    const [
      itemsCountRes,
      listsCountRes,
      topItemsRes,
      itemsForAggRes,
      postsCountRes,
    ] = await Promise.all([
      // 1. total_items_ranked: list_items with non-null rank, parent list owned by me,
      //    created in the year window.
      supabase
        .from('list_items')
        .select('lists!inner(user_id)', { count: 'exact', head: true })
        .eq('lists.user_id', me)
        .not('rank', 'is', null)
        .gte('created_at', startIso)
        .lt('created_at', endIso),

      // 2. total_lists_created: lists owned by me, created in the year window.
      supabase
        .from('lists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', me)
        .gte('created_at', startIso)
        .lt('created_at', endIso),

      // 3. top 5 ranked items in the year, joined with parent list for title +
      //    category. Order by rank DESC, limit 5.
      supabase
        .from('list_items')
        .select(`
          id, title, image_url, rank, category,
          lists!inner ( user_id, title )
        `)
        .eq('lists.user_id', me)
        .not('rank', 'is', null)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('rank', { ascending: false })
        .limit(5),

      // 4. All items created in the year (with rank or not) — used to build
      //    the sentiment / category / month / average aggregates client-side.
      //    Cap at 5000 — generous; year-in-review for a power user with more
      //    than that is rare and we'd rather degrade gracefully than time out.
      supabase
        .from('list_items')
        .select(`
          rank, sentiment, category, created_at,
          lists!inner ( user_id )
        `)
        .eq('lists.user_id', me)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .limit(5000),

      // 5. posts_made: posts authored by me in the year window. The `posts`
      //    table is Phase 4 — if it doesn't exist yet, this query errors and
      //    we surface 0 (logged below).
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', me)
        .gte('created_at', startIso)
        .lt('created_at', endIso),
    ]);

    // Per-query error logging (no throws — degrade each field independently).
    if (itemsCountRes.error) {
      console.error('[insights] total_items_ranked', itemsCountRes.error.message);
    }
    if (listsCountRes.error) {
      console.error('[insights] total_lists_created', listsCountRes.error.message);
    }
    if (topItemsRes.error) {
      console.error('[insights] top_5_items', topItemsRes.error.message);
    }
    if (itemsForAggRes.error) {
      console.error('[insights] aggregates fetch', itemsForAggRes.error.message);
    }
    if (postsCountRes.error) {
      console.error('[insights] posts_made', postsCountRes.error.message);
    }

    // --- top_5_items ----------------------------------------------------------
    const top5: YearInsights['top_5_items'] = [];
    for (const row of topItemsRes.data ?? []) {
      const list = extractOne<{ user_id: string; title: string | null }>(
        (row as { lists?: { user_id: string; title: string | null } | { user_id: string; title: string | null }[] | null }).lists
      );
      const id = (row as { id?: unknown }).id;
      const rank = (row as { rank?: unknown }).rank;
      if (typeof id !== 'string' || typeof rank !== 'number') continue;
      top5.push({
        list_item_id: id,
        title: ((row as { title?: unknown }).title as string | null) ?? '',
        image_url: ((row as { image_url?: unknown }).image_url as string | null) ?? null,
        rank,
        category: ((row as { category?: unknown }).category as string | null) ?? '',
        list_title: list?.title ?? 'Unknown List',
      });
    }

    // --- aggregates from the full year rowset ---------------------------------
    const sentiment: YearInsights['sentiment_breakdown'] = {
      liked: 0,
      didnt_care: 0,
      didnt_like: 0,
    };
    const categoryCounts: Record<string, number> = {};
    const monthCounts = new Map<number, number>(); // 1..12
    let rankSum = 0;
    let rankCount = 0;

    for (const row of itemsForAggRes.data ?? []) {
      const s = (row as { sentiment?: unknown }).sentiment;
      if (s === 'liked') sentiment.liked += 1;
      else if (s === 'didnt_care') sentiment.didnt_care += 1;
      else if (s === 'didnt_like') sentiment.didnt_like += 1;

      const c = (row as { category?: unknown }).category;
      if (typeof c === 'string' && c.length > 0) {
        categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
      }

      const createdRaw = (row as { created_at?: unknown }).created_at;
      if (typeof createdRaw === 'string') {
        const d = new Date(createdRaw);
        if (!Number.isNaN(d.getTime())) {
          const m = d.getUTCMonth() + 1; // 1..12
          monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
        }
      }

      const r = (row as { rank?: unknown }).rank;
      if (typeof r === 'number' && Number.isFinite(r)) {
        rankSum += r;
        rankCount += 1;
      }
    }

    let mostActive: YearInsights['most_active_month'] = null;
    for (const [month, count] of monthCounts) {
      if (!mostActive || count > mostActive.count) {
        mostActive = { month, count };
      }
    }

    const averageRank = rankCount > 0 ? rankSum / rankCount : null;

    return {
      year: resolvedYear,
      total_items_ranked: itemsCountRes.count ?? 0,
      total_lists_created: listsCountRes.count ?? 0,
      top_5_items: top5,
      sentiment_breakdown: sentiment,
      category_breakdown: categoryCounts,
      most_active_month: mostActive,
      average_rank: averageRank,
      posts_made: postsCountRes.count ?? 0,
    };
  } catch (err) {
    console.error('[getYearInsights] unexpected', err);
    return emptyInsights(year ?? new Date().getUTCFullYear());
  }
}
