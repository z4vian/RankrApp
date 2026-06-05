/**
 * lib/posts.ts
 *
 * Twitter-style posts / notes feed for the Rankr social layer.
 *
 * Schema reference: `docs/social-schema.md` §6 + `docs/PHASE-4-MIGRATION.sql`.
 * Table: public.posts (id, user_id, body, list_item_id, visibility, created_at).
 *
 * Visibility tiers (matches the DB CHECK constraint and RLS policies):
 *   - 'private'   → only the author can SELECT
 *   - 'followers' → author + users in public.follows where followed_id = author
 *   - 'public'    → anyone (anon or authed) can SELECT
 *
 * Visibility is enforced server-side by RLS. The helpers in this module just
 * issue queries and let Postgres filter — there's no client-side visibility
 * gate beyond the explicit fields you pass into `createPost`.
 *
 * Error-handling pattern matches the rest of `lib/`:
 *   - Mutators (createPost / deletePost) throw with a friendly user-facing
 *     message — never a raw Postgres error.
 *   - Read helpers (getPostById / getFeedPosts / getPostsByUser) log and
 *     return a safe empty value (null / []) so the UI degrades gracefully.
 *
 * Auth: the current user is resolved per-call via `supabase.auth.getUser()`.
 * Mutators throw "You must be signed in." when no session is present.
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three visibility tiers — mirrors the CHECK on posts.visibility. */
export type PostVisibility = 'private' | 'followers' | 'public';

/**
 * Slim list_item snapshot embedded into a post, for rendering the "attached
 * item" card. Only the fields the UI needs to render the inline preview —
 * full detail can be fetched via `fetchListItemWithOwner(item.id)`.
 */
export type PostAttachedItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  category: string;
  rank: number | null;
};

/**
 * A post row with its author profile and (optional) attached list_item
 * resolved in a single round-trip.
 */
export type Post = {
  id: string;
  user_id: string;
  body: string;
  visibility: PostVisibility;
  created_at: string;
  author: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  attached_item: PostAttachedItem | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Postgres RLS-rejection SQLSTATE — "new row violates row-level security policy". */
const PG_RLS_VIOLATION = '42501';

/** Postgres CHECK-constraint-violation SQLSTATE — used by body / visibility CHECKs. */
const PG_CHECK_VIOLATION = '23514';

/** Max post body length — must match the CHECK in `docs/PHASE-4-MIGRATION.sql`. */
const POST_MAX = 1000;

/**
 * Resolve the current user's id or throw the standard "not signed in" error.
 * Mutators use this; read helpers don't require a session (anon callers can
 * still see public posts via RLS).
 */
async function requireCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You must be signed in.');
  }
  return data.user.id;
}

/**
 * Validate and return a trimmed body. Throws friendly messages on miss.
 * Used by createPost — kept as a free function so future edit support can
 * reuse it without re-implementing the rule.
 */
function normalizePostBody(body: string): string {
  if (typeof body !== 'string') {
    throw new Error('Post body is required.');
  }
  const trimmed = body.trim();
  if (trimmed.length < 1) {
    throw new Error('Post too short.');
  }
  if (trimmed.length > POST_MAX) {
    throw new Error('Post too long.');
  }
  return trimmed;
}

/**
 * Narrow visibility into the tagged union, defaulting to 'private' on any
 * unexpected value. Defensive — RLS will reject inserts with bad values
 * anyway, but normalizing here prevents accidental wider exposure.
 */
function normalizeVisibility(v: unknown): PostVisibility {
  if (v === 'public' || v === 'followers' || v === 'private') return v;
  return 'private';
}

/** Embedded author shape from `profiles:user_id(...)`. */
type EmbeddedAuthor = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/** Embedded list_item shape from `list_items:list_item_id(...)`. */
type EmbeddedItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  category: string | null;
  rank: number | null;
};

/**
 * PostgREST returns to-one relations as either a single object or null, or
 * (in some client versions) a one-element array. Normalize both shapes.
 */
function extractOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

/** The full select shape used everywhere we return a `Post`. Kept as a
 *  template literal so it stays in sync across helpers. */
const POST_SELECT = `
  id,
  user_id,
  body,
  visibility,
  created_at,
  list_item_id,
  author:profiles!user_id ( username, display_name, avatar_url ),
  attached_item:list_items!list_item_id (
    id, title, subtitle, image_url, category, rank
  )
` as const;

/**
 * Map a raw PostgREST row (matching POST_SELECT) into the public `Post` shape.
 * Returns null on a fatally-malformed row (missing id / user_id) so the
 * caller can skip rather than crash on bad data.
 */
function rowToPost(row: unknown): Post | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as {
    id?: unknown;
    user_id?: unknown;
    body?: unknown;
    visibility?: unknown;
    created_at?: unknown;
    author?: EmbeddedAuthor | EmbeddedAuthor[] | null;
    attached_item?: EmbeddedItem | EmbeddedItem[] | null;
  };

  if (typeof r.id !== 'string' || typeof r.user_id !== 'string') return null;

  const author = extractOne<EmbeddedAuthor>(r.author);
  const item = extractOne<EmbeddedItem>(r.attached_item);

  let attached: PostAttachedItem | null = null;
  if (item && typeof item.id === 'string') {
    attached = {
      id: item.id,
      title: (item.title as string | null) ?? '',
      subtitle: (item.subtitle as string | null) ?? null,
      image_url: (item.image_url as string | null) ?? null,
      category: (item.category as string | null) ?? '',
      rank: (item.rank as number | null) ?? null,
    };
  }

  return {
    id: r.id,
    user_id: r.user_id,
    body: typeof r.body === 'string' ? r.body : '',
    visibility: normalizeVisibility(r.visibility),
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    author: {
      username: author?.username ?? null,
      display_name: author?.display_name ?? null,
      avatar_url: author?.avatar_url ?? null,
    },
    attached_item: attached,
  };
}

// ===========================================================================
// Create / delete
// ===========================================================================

/**
 * Create a new post.
 *
 * Throws:
 *   - "You must be signed in."                        if no session.
 *   - "Post too short." / "Post too long."            on validation.
 *   - "Post body must be 1–1000 characters."          on CHECK violation
 *                                                     (defensive — normalize
 *                                                     already filters this).
 *   - Supabase error message                          on any other error.
 *
 * Returns the inserted Post with joined author + attached_item.
 */
export async function createPost(input: {
  body: string;
  visibility: PostVisibility;
  listItemId?: string | null;
}): Promise<Post> {
  const currentUserId = await requireCurrentUserId();
  const trimmed = normalizePostBody(input.body);
  const visibility = normalizeVisibility(input.visibility);
  const listItemId = input.listItemId ?? null;

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: currentUserId,
      body: trimmed,
      visibility,
      list_item_id: listItemId,
    })
    .select(POST_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === PG_RLS_VIOLATION) {
      // Shouldn't happen given we set user_id = auth.uid(), but cover the
      // pathological case anyway.
      throw new Error("You can't create posts on someone else's behalf.");
    }
    if (error?.code === PG_CHECK_VIOLATION) {
      throw new Error('Post body must be 1–1000 characters.');
    }
    throw new Error(error?.message ?? 'Failed to create post.');
  }

  const post = rowToPost(data);
  if (!post) {
    // Defensive: PostgREST returned a row but it's missing critical fields.
    throw new Error('Failed to create post.');
  }
  return post;
}

/**
 * Delete a post. RLS enforces author-only; deleting someone else's post is a
 * zero-row no-op (no throw). Idempotent — repeated taps on a "delete" button
 * after success are harmless.
 *
 * Throws:
 *   - "You must be signed in."   if no session.
 *   - Supabase error message     on any other error.
 */
export async function deletePost(postId: string): Promise<void> {
  await requireCurrentUserId();

  const { error } = await supabase.from('posts').delete().eq('id', postId);

  if (error) {
    if (error.code === PG_RLS_VIOLATION) {
      throw new Error("You can't delete someone else's post.");
    }
    throw new Error(error.message);
  }
}

// ===========================================================================
// Reads
// ===========================================================================

/**
 * Fetch a single post by id, with author + attached_item joined.
 *
 * Returns `null` when the post doesn't exist OR when RLS hides it. The caller
 * can't distinguish; both are surfaced as "not visible to me," which matches
 * the rest of the codebase (`fetchProfileByUsername`, `fetchListItemWithOwner`).
 */
export async function getPostById(postId: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    console.error('[getPostById]', postId, error.message);
    return null;
  }
  if (!data) return null;

  return rowToPost(data);
}

/**
 * Feed of posts visible to the current caller, sorted by created_at DESC.
 *
 * RLS does the heavy lifting — this helper just selects ordered by
 * created_at. The DB applies:
 *   - your own posts (any visibility),
 *   - public posts from anyone,
 *   - followers-visibility posts from users you follow.
 *
 * Cursor-style pagination: pass `beforeCreatedAt` to fetch rows older than
 * that timestamp (i.e. the next page after the last item already shown).
 *
 * @param limit             Max rows to return. Default 30.
 * @param beforeCreatedAt   Optional ISO timestamp; only rows strictly older
 *                          than this are returned. Use the last visible
 *                          row's `created_at` to paginate.
 *
 * Returns [] on error.
 */
export async function getFeedPosts(
  limit: number = 30,
  beforeCreatedAt?: string
): Promise<Post[]> {
  let q = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) {
    q = q.lt('created_at', beforeCreatedAt);
  }

  const { data, error } = await q;

  if (error) {
    console.error('[getFeedPosts]', error.message);
    return [];
  }
  if (!data) return [];

  const out: Post[] = [];
  for (const row of data) {
    const post = rowToPost(row);
    if (post) out.push(post);
  }
  return out;
}

/**
 * Posts authored by a specific user, sorted by created_at DESC.
 *
 * RLS automatically filters by visibility:
 *   - If userId === auth.uid(), returns ALL of the user's posts (any tier).
 *   - Otherwise, returns the subset visible to the caller via the three
 *     SELECT policies: public posts always; followers posts when the caller
 *     follows userId.
 *
 * @param userId  The author whose posts to fetch.
 * @param limit   Max rows to return. Default 30.
 *
 * Returns [] on error.
 */
export async function getPostsByUser(
  userId: string,
  limit: number = 30
): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getPostsByUser]', userId, error.message);
    return [];
  }
  if (!data) return [];

  const out: Post[] = [];
  for (const row of data) {
    const post = rowToPost(row);
    if (post) out.push(post);
  }
  return out;
}
