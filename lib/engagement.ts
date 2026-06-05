/**
 * lib/engagement.ts
 *
 * Engagement helpers for the Rankr social layer — likes, comments, and
 * "watched/listened/played with" tags on `list_items`.
 *
 * Schema reference: `docs/social-schema.md` §5 and `docs/PHASE-3-MIGRATION.sql`.
 * Tables involved:
 *   - public.likes        (id, user_id, list_item_id, created_at)
 *   - public.comments     (id, user_id, list_item_id, body, created_at, edited_at)
 *   - public.watched_with (id, list_item_id, tagged_user_id, created_at)
 *
 * Error-handling pattern matches the rest of `lib/`:
 *   - Mutators throw with a friendly user-facing message, never a raw PG error.
 *   - Read helpers log and return a safe empty value so the UI degrades gracefully.
 *
 * Auth: the current user is resolved per-call via `supabase.auth.getUser()`.
 * Mutating helpers throw "You must be signed in." when the session is missing.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Postgres unique-violation SQLSTATE — duplicate (user, item) or (item, user) pair. */
const PG_UNIQUE_VIOLATION = '23505';

/** Postgres RLS-rejection SQLSTATE — "new row violates row-level security policy". */
const PG_RLS_VIOLATION = '42501';

/** Postgres CHECK-constraint-violation SQLSTATE — used by the comments length CHECK. */
const PG_CHECK_VIOLATION = '23514';

/** Max comment body length — must match the CHECK in `docs/PHASE-3-MIGRATION.sql`. */
const COMMENT_MAX = 500;

/**
 * Resolve the current user's id or throw the standard "not signed in" error.
 * Used by mutating helpers; read helpers that target a specific item don't
 * need an authed session.
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
 * `select('..., profiles(...)')`. PostgREST resolves to-one relations as
 * either a single object or null (or, in older client versions, a one-element
 * array). Normalize both shapes here.
 *
 * Full profile slice — used by getLikedBy / getWatchedWithUsers which need
 * the profile.id for keying and navigation.
 */
type EmbeddedProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Narrower profile slice used as `Comment.author` — no `id` field because
 * the parent comment row already carries `user_id`. Kept separate from
 * `EmbeddedProfile` so TypeScript can infer the PostgREST select shape
 * without complaining about a missing `id`.
 */
type EmbeddedAuthorProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function extractProfile(
  rel: EmbeddedProfile | EmbeddedProfile[] | null | undefined
): EmbeddedProfile | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

function extractAuthor(
  rel: EmbeddedAuthorProfile | EmbeddedAuthorProfile[] | null | undefined
): EmbeddedAuthorProfile | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

// ===========================================================================
// Likes
// ===========================================================================

/** Slim profile shape returned by `getLikedBy` — no bio, just the avatar row. */
export type LikeUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Like a list item. Idempotent — if the user has already liked it, the
 * duplicate insert is silently swallowed (UNIQUE on (user_id, list_item_id)).
 *
 * Throws:
 *   - "You must be signed in."             if no session.
 *   - "You can't like a private item."     on RLS rejection (item not public).
 *   - Supabase error message               on any other error.
 */
export async function likeItem(listItemId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  const { error } = await supabase.from('likes').insert({
    user_id: currentUserId,
    list_item_id: listItemId,
  });

  if (error) {
    // Already liked → no-op.
    if (error.code === PG_UNIQUE_VIOLATION) return;
    if (error.code === PG_RLS_VIOLATION) {
      throw new Error("You can't like a private item.");
    }
    throw new Error(error.message);
  }
}

/**
 * Unlike a list item. Idempotent — if no like exists for (current user, item),
 * the zero-row delete completes silently.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function unlikeItem(listItemId: string): Promise<void> {
  const currentUserId = await requireCurrentUserId();

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', currentUserId)
    .eq('list_item_id', listItemId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Whether the current user has liked `listItemId`. Returns `false` if not
 * signed in, if the row doesn't exist, or on any error — the UI just needs
 * to know which heart icon to render.
 */
export async function hasUserLiked(listItemId: string): Promise<boolean> {
  try {
    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) return false;

    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userResult.user.id)
      .eq('list_item_id', listItemId)
      .maybeSingle();

    if (error) {
      console.error('[hasUserLiked]', listItemId, error.message);
      return false;
    }
    return data !== null;
  } catch (err) {
    console.error('[hasUserLiked] unexpected', listItemId, err);
    return false;
  }
}

/**
 * Total like count for an item. Uses head/exact-count so no row data is
 * transferred. Returns 0 on error.
 */
export async function getLikeCount(listItemId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('list_item_id', listItemId);

    if (error) {
      console.error('[getLikeCount]', listItemId, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('[getLikeCount] unexpected', listItemId, err);
    return 0;
  }
}

/**
 * People who liked an item. Joins `likes -> profiles` via `user_id`.
 * Ordered by likes.created_at DESC (newest liker first).
 *
 * Returns [] on error.
 */
export async function getLikedBy(
  listItemId: string,
  limit: number = 50
): Promise<LikeUser[]> {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      created_at,
      profiles:user_id ( id, username, display_name, avatar_url )
    `)
    .eq('list_item_id', listItemId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getLikedBy]', listItemId, error.message);
    return [];
  }
  if (!data) return [];

  const out: LikeUser[] = [];
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
    });
  }
  return out;
}

// ===========================================================================
// Comments
// ===========================================================================

/**
 * A comment with its author profile attached. `edited_at` is null when the
 * comment has never been edited.
 */
export type Comment = {
  id: string;
  user_id: string;
  list_item_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

/**
 * Validate comment body and return a trimmed version, or throw a friendly
 * error. Used by addComment and editComment.
 */
function normalizeCommentBody(body: string): string {
  if (typeof body !== 'string') {
    throw new Error('Comment is required.');
  }
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    throw new Error('Comment too short.');
  }
  if (trimmed.length > COMMENT_MAX) {
    throw new Error('Comment too long.');
  }
  return trimmed;
}

/**
 * Map an error from a comments insert/update into a friendly message and
 * throw. Used to centralize "RLS / check / generic" branching.
 */
function throwCommentError(error: { code?: string; message?: string }): never {
  if (error.code === PG_RLS_VIOLATION) {
    throw new Error("You can't comment on a private item.");
  }
  if (error.code === PG_CHECK_VIOLATION) {
    // The DB's length check is the authoritative line; this only fires if our
    // own normalizeCommentBody somehow let an invalid value through.
    throw new Error('Comment must be 1–500 characters.');
  }
  throw new Error(error.message ?? 'Failed to save comment.');
}

/**
 * Add a new comment. Validates body length (trimmed 1..500); throws a
 * friendly message on invalid input or RLS rejection.
 *
 * Returns the inserted Comment with its author profile attached.
 *
 * Throws:
 *   - "You must be signed in."             if no session.
 *   - "Comment too short." / "Comment too long."  on validation.
 *   - "You can't comment on a private item." on RLS rejection.
 *   - Supabase error message               on any other error.
 */
export async function addComment(listItemId: string, body: string): Promise<Comment> {
  const currentUserId = await requireCurrentUserId();
  const trimmed = normalizeCommentBody(body);

  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: currentUserId,
      list_item_id: listItemId,
      body: trimmed,
    })
    .select(`
      id, user_id, list_item_id, body, created_at, edited_at,
      profiles:user_id ( username, display_name, avatar_url )
    `)
    .single();

  if (error || !data) {
    if (error) throwCommentError(error);
    throw new Error('Failed to save comment.');
  }

  const profileRel = (data as {
    profiles: EmbeddedAuthorProfile | EmbeddedAuthorProfile[] | null;
  }).profiles;
  const profile = extractAuthor(profileRel);

  return {
    id: data.id as string,
    user_id: data.user_id as string,
    list_item_id: data.list_item_id as string,
    body: data.body as string,
    created_at: data.created_at as string,
    edited_at: (data.edited_at as string | null) ?? null,
    author: {
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
  };
}

/**
 * Delete a comment by id. RLS enforces that only the author can delete —
 * a delete by anyone else returns 0 rows (no throw), which is fine for a
 * "did this UI button work" check.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function deleteComment(commentId: string): Promise<void> {
  await requireCurrentUserId();

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    if (error.code === PG_RLS_VIOLATION) {
      throw new Error("You can't delete someone else's comment.");
    }
    throw new Error(error.message);
  }
}

/**
 * Edit a comment's body. Also bumps `edited_at` to now() so the UI can render
 * an "(edited)" badge. RLS enforces author == auth.uid().
 *
 * Throws on invalid body length, RLS rejection, or any other Supabase error.
 */
export async function editComment(commentId: string, newBody: string): Promise<void> {
  await requireCurrentUserId();
  const trimmed = normalizeCommentBody(newBody);

  const { error } = await supabase
    .from('comments')
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) {
    if (error.code === PG_RLS_VIOLATION) {
      throw new Error("You can't edit someone else's comment.");
    }
    if (error.code === PG_CHECK_VIOLATION) {
      throw new Error('Comment must be 1–500 characters.');
    }
    throw new Error(error.message);
  }
}

/**
 * Fetch comments for an item, with author profile joined.
 * Ordered by created_at ASC (oldest first — natural threaded-reading order).
 *
 * Returns [] on error.
 */
export async function getComments(
  listItemId: string,
  limit: number = 100
): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id, user_id, list_item_id, body, created_at, edited_at,
      profiles:user_id ( username, display_name, avatar_url )
    `)
    .eq('list_item_id', listItemId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[getComments]', listItemId, error.message);
    return [];
  }
  if (!data) return [];

  const out: Comment[] = [];
  for (const row of data) {
    const profile = extractAuthor(
      (row as {
        profiles: EmbeddedAuthorProfile | EmbeddedAuthorProfile[] | null;
      }).profiles
    );
    out.push({
      id: row.id as string,
      user_id: row.user_id as string,
      list_item_id: row.list_item_id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      edited_at: (row.edited_at as string | null) ?? null,
      author: {
        username: profile?.username ?? null,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    });
  }
  return out;
}

/**
 * Total comment count for an item. Uses head/exact-count.
 * Returns 0 on error.
 */
export async function getCommentCount(listItemId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('list_item_id', listItemId);

    if (error) {
      console.error('[getCommentCount]', listItemId, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('[getCommentCount] unexpected', listItemId, err);
    return 0;
  }
}

// ===========================================================================
// Watched-with (tagged friends)
// ===========================================================================

/** Same slim profile shape as LikeUser — kept distinct for semantic clarity. */
export type TaggedUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Tag another user as "watched/listened/played with" on a list_item.
 * RLS enforces that the caller is the LIST OWNER (you tag friends on YOUR
 * items, not on strangers'). Idempotent — duplicate (item, tagged_user) is
 * silently swallowed.
 *
 * Throws:
 *   - "You must be signed in."                     if no session.
 *   - "You can only tag users on your own items."  on RLS rejection.
 *   - Supabase error message                       on any other error.
 */
export async function tagWatchedWith(
  listItemId: string,
  taggedUserId: string
): Promise<void> {
  await requireCurrentUserId();

  const { error } = await supabase.from('watched_with').insert({
    list_item_id: listItemId,
    tagged_user_id: taggedUserId,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return;
    if (error.code === PG_RLS_VIOLATION) {
      throw new Error('You can only tag users on your own items.');
    }
    throw new Error(error.message);
  }
}

/**
 * Remove a watched-with tag. RLS allows either the list owner OR the tagged
 * user themselves to delete. Idempotent — zero-row delete completes silently.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function untagWatchedWith(
  listItemId: string,
  taggedUserId: string
): Promise<void> {
  await requireCurrentUserId();

  const { error } = await supabase
    .from('watched_with')
    .delete()
    .eq('list_item_id', listItemId)
    .eq('tagged_user_id', taggedUserId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Users tagged on an item. Joins `watched_with -> profiles` via
 * `tagged_user_id`. No limit — the tag list is typically very small.
 *
 * Returns [] on error.
 */
export async function getWatchedWithUsers(listItemId: string): Promise<TaggedUser[]> {
  const { data, error } = await supabase
    .from('watched_with')
    .select(`
      created_at,
      profiles:tagged_user_id ( id, username, display_name, avatar_url )
    `)
    .eq('list_item_id', listItemId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getWatchedWithUsers]', listItemId, error.message);
    return [];
  }
  if (!data) return [];

  const out: TaggedUser[] = [];
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
    });
  }
  return out;
}
