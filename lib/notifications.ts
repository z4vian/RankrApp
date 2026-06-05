/**
 * lib/notifications.ts
 *
 * In-app notification feed, derived on-the-fly from existing tables.
 * There is NO `notifications` table — we union three sources:
 *
 *   1. `likes`        WHERE the liked item's list is owned by auth.uid()
 *                     AND likes.user_id != auth.uid()         (don't self-notify)
 *   2. `comments`     WHERE the commented item's list is owned by auth.uid()
 *                     AND comments.user_id != auth.uid()      (don't self-notify)
 *   3. `watched_with` WHERE tagged_user_id = auth.uid()
 *
 * Unread state comes from `profiles.notifications_last_seen_at` (Phase 3
 * column). Anything created after that timestamp is unread.
 *
 * Schema reference: `docs/social-schema.md` §5 + `docs/PHASE-3-MIGRATION.sql`.
 *
 * Error-handling: all helpers degrade to a safe empty value on error (empty
 * array, zero, no-op) rather than throwing — the notification feed is a
 * non-critical secondary surface; if it can't load, the rest of the app
 * should not break.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three flavours of notification the feed currently supports. */
export type NotificationKind = 'like' | 'comment' | 'tagged_watched_with';

/** A single notification row, normalized across the three source tables. */
export type Notification = {
  /**
   * Synthetic stable id: `${kind}:${actor_id}:${list_item_id}:${created_at}`.
   * Useful for FlatList keyExtractor — there's no underlying row id we can
   * point at uniformly across the three sources.
   */
  id: string;
  kind: NotificationKind;
  actor: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  list_item: {
    id: string;
    title: string;
    image_url: string | null;
  };
  /** First ~80 chars of the comment body; null for non-comment notifications. */
  comment_preview: string | null;
  created_at: string;
  /** True when created_at > profiles.notifications_last_seen_at. */
  is_unread: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type EmbeddedActor = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type EmbeddedListItem = {
  id: string;
  title: string;
  image_url: string | null;
  /** Joined parent list, only used to filter by owner during the read. */
  lists:
    | { user_id: string }
    | { user_id: string }[]
    | null;
};

function extractOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

/** First N characters of a string, trimmed, for the comment preview field. */
function preview(body: string, n: number = 80): string {
  const trimmed = body.trim();
  if (trimmed.length <= n) return trimmed;
  return `${trimmed.slice(0, n)}…`;
}

/**
 * Fetch the current user's `notifications_last_seen_at` timestamp.
 * Returns the unix-epoch ISO string ("1970-01-01T00:00:00.000Z") on miss so
 * that EVERY notification gets flagged unread when this read fails — that's
 * the more conservative default than "everything is read."
 */
async function getLastSeenAt(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('notifications_last_seen_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[notifications] getLastSeenAt', userId, error.message);
      return new Date(0).toISOString();
    }
    if (!data?.notifications_last_seen_at) {
      return new Date(0).toISOString();
    }
    return data.notifications_last_seen_at as string;
  } catch (err) {
    console.error('[notifications] getLastSeenAt unexpected', userId, err);
    return new Date(0).toISOString();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the notification feed for the current user.
 *
 * Returns up to `limit` items (default 50), merged from the three sources and
 * sorted by created_at DESC. Returns [] when the user is not signed in or on
 * any error.
 *
 * Implementation notes:
 *   - Each source query joins `profiles` (actor) and `list_items + lists`
 *     (target item, plus its owner for the "is it mine?" filter).
 *   - For likes/comments we filter `lists.user_id = auth.uid()` via the
 *     `lists!inner(...)` PostgREST join trick — same idiom used in
 *     `fetchProfileStats`.
 *   - For watched_with the filter is on `tagged_user_id = auth.uid()`.
 *   - We over-fetch each source by `limit` (so the union has at least `limit`
 *     candidates after dedup-ish merging) then slice to `limit` at the end.
 */
export async function getNotifications(limit: number = 50): Promise<Notification[]> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return [];
    const me = userResult.user.id;

    const lastSeenAt = await getLastSeenAt(me);

    const [likesRes, commentsRes, tagsRes] = await Promise.all([
      // 1. Likes on items where the list owner is me, excluding self-likes.
      supabase
        .from('likes')
        .select(`
          created_at,
          user_id,
          actor:profiles!user_id ( id, username, display_name, avatar_url ),
          list_item:list_items!inner (
            id, title, image_url,
            lists!inner ( user_id )
          )
        `)
        .eq('list_item.lists.user_id', me)
        .neq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(limit),

      // 2. Comments on items where the list owner is me, excluding self-comments.
      supabase
        .from('comments')
        .select(`
          created_at,
          user_id,
          body,
          actor:profiles!user_id ( id, username, display_name, avatar_url ),
          list_item:list_items!inner (
            id, title, image_url,
            lists!inner ( user_id )
          )
        `)
        .eq('list_item.lists.user_id', me)
        .neq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(limit),

      // 3. watched_with rows where I'm the tagged user. The actor is the list
      //    owner (whoever tagged me) — joined via list_items.lists.user_id
      //    -> profiles. PostgREST can't chain a profile join through two
      //    inner joins in one select, so we fetch and resolve actor below
      //    using the list owner id.
      supabase
        .from('watched_with')
        .select(`
          created_at,
          list_item:list_items!inner (
            id, title, image_url,
            lists!inner ( user_id )
          )
        `)
        .eq('tagged_user_id', me)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const out: Notification[] = [];

    // ---- Likes
    if (likesRes.error) {
      console.error('[getNotifications] likes', likesRes.error.message);
    } else if (likesRes.data) {
      for (const row of likesRes.data) {
        const actor = extractOne<EmbeddedActor>(
          (row as { actor: EmbeddedActor | EmbeddedActor[] | null }).actor
        );
        const li = extractOne<EmbeddedListItem>(
          (row as { list_item: EmbeddedListItem | EmbeddedListItem[] | null }).list_item
        );
        if (!actor || !li) continue;
        const createdAt = row.created_at as string;
        out.push({
          id: `like:${actor.id}:${li.id}:${createdAt}`,
          kind: 'like',
          actor: {
            id: actor.id,
            username: actor.username ?? null,
            display_name: actor.display_name ?? null,
            avatar_url: actor.avatar_url ?? null,
          },
          list_item: {
            id: li.id,
            title: li.title,
            image_url: li.image_url ?? null,
          },
          comment_preview: null,
          created_at: createdAt,
          is_unread: createdAt > lastSeenAt,
        });
      }
    }

    // ---- Comments
    if (commentsRes.error) {
      console.error('[getNotifications] comments', commentsRes.error.message);
    } else if (commentsRes.data) {
      for (const row of commentsRes.data) {
        const actor = extractOne<EmbeddedActor>(
          (row as { actor: EmbeddedActor | EmbeddedActor[] | null }).actor
        );
        const li = extractOne<EmbeddedListItem>(
          (row as { list_item: EmbeddedListItem | EmbeddedListItem[] | null }).list_item
        );
        if (!actor || !li) continue;
        const createdAt = row.created_at as string;
        const body = (row as { body: string }).body ?? '';
        out.push({
          id: `comment:${actor.id}:${li.id}:${createdAt}`,
          kind: 'comment',
          actor: {
            id: actor.id,
            username: actor.username ?? null,
            display_name: actor.display_name ?? null,
            avatar_url: actor.avatar_url ?? null,
          },
          list_item: {
            id: li.id,
            title: li.title,
            image_url: li.image_url ?? null,
          },
          comment_preview: body ? preview(body) : null,
          created_at: createdAt,
          is_unread: createdAt > lastSeenAt,
        });
      }
    }

    // ---- Watched-with tags
    if (tagsRes.error) {
      console.error('[getNotifications] watched_with', tagsRes.error.message);
    } else if (tagsRes.data) {
      // Collect the list-owner ids so we can resolve their profile rows in
      // one round-trip (avoid N+1 profile fetches).
      const ownerIds = new Set<string>();
      const tagRows: { createdAt: string; li: EmbeddedListItem; ownerId: string }[] = [];
      for (const row of tagsRes.data) {
        const li = extractOne<EmbeddedListItem>(
          (row as { list_item: EmbeddedListItem | EmbeddedListItem[] | null }).list_item
        );
        if (!li) continue;
        const parentList = extractOne<{ user_id: string }>(li.lists);
        const ownerId = parentList?.user_id ?? null;
        if (!ownerId) continue;
        // A user tagging themselves makes no sense as a notification (they'd
        // see "you tagged you"). Skip just in case.
        if (ownerId === me) continue;
        ownerIds.add(ownerId);
        tagRows.push({ createdAt: row.created_at as string, li, ownerId });
      }

      if (ownerIds.size > 0) {
        const { data: actorRows, error: actorErr } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', Array.from(ownerIds));

        if (actorErr) {
          console.error('[getNotifications] watched_with actors', actorErr.message);
        } else {
          const actorMap = new Map<string, EmbeddedActor>();
          for (const a of actorRows ?? []) {
            actorMap.set(a.id as string, {
              id: a.id as string,
              username: (a.username as string | null) ?? null,
              display_name: (a.display_name as string | null) ?? null,
              avatar_url: (a.avatar_url as string | null) ?? null,
            });
          }
          for (const { createdAt, li, ownerId } of tagRows) {
            const actor = actorMap.get(ownerId);
            if (!actor) continue;
            out.push({
              id: `tagged_watched_with:${actor.id}:${li.id}:${createdAt}`,
              kind: 'tagged_watched_with',
              actor,
              list_item: {
                id: li.id,
                title: li.title,
                image_url: li.image_url ?? null,
              },
              comment_preview: null,
              created_at: createdAt,
              is_unread: createdAt > lastSeenAt,
            });
          }
        }
      }
    }

    // Merge + sort by created_at DESC, then cap at limit.
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return out.slice(0, limit);
  } catch (err) {
    console.error('[getNotifications] unexpected', err);
    return [];
  }
}

/**
 * Total count of unread notifications across the three sources.
 *
 * Uses three parallel head/exact-count queries with a `created_at > last_seen`
 * filter — no row data is transferred, just the counts.
 *
 * Returns 0 when not signed in or on any error.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return 0;
    const me = userResult.user.id;

    const lastSeenAt = await getLastSeenAt(me);

    const [likesRes, commentsRes, tagsRes] = await Promise.all([
      supabase
        .from('likes')
        .select('list_item:list_items!inner(lists!inner(user_id))', {
          count: 'exact',
          head: true,
        })
        .eq('list_item.lists.user_id', me)
        .neq('user_id', me)
        .gt('created_at', lastSeenAt),

      supabase
        .from('comments')
        .select('list_item:list_items!inner(lists!inner(user_id))', {
          count: 'exact',
          head: true,
        })
        .eq('list_item.lists.user_id', me)
        .neq('user_id', me)
        .gt('created_at', lastSeenAt),

      supabase
        .from('watched_with')
        .select('*', { count: 'exact', head: true })
        .eq('tagged_user_id', me)
        .gt('created_at', lastSeenAt),
    ]);

    if (likesRes.error) {
      console.error('[getUnreadNotificationCount] likes', likesRes.error.message);
    }
    if (commentsRes.error) {
      console.error('[getUnreadNotificationCount] comments', commentsRes.error.message);
    }
    if (tagsRes.error) {
      console.error('[getUnreadNotificationCount] tags', tagsRes.error.message);
    }

    return (
      (likesRes.count ?? 0) +
      (commentsRes.count ?? 0) +
      (tagsRes.count ?? 0)
    );
  } catch (err) {
    console.error('[getUnreadNotificationCount] unexpected', err);
    return 0;
  }
}

/**
 * Mark all notifications as seen by bumping `profiles.notifications_last_seen_at`
 * to now(). Call this when the user opens the notifications screen.
 *
 * No-op (logged) when not signed in or on error — the badge stays "wrong"
 * for a moment but the app doesn't break.
 */
export async function markNotificationsAsSeen(): Promise<void> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return;
    const me = userResult.user.id;

    const { error } = await supabase
      .from('profiles')
      .update({ notifications_last_seen_at: new Date().toISOString() })
      .eq('id', me);

    if (error) {
      console.error('[markNotificationsAsSeen]', me, error.message);
    }
  } catch (err) {
    console.error('[markNotificationsAsSeen] unexpected', err);
  }
}
