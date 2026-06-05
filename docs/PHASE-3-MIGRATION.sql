-- =============================================================================
-- Rankr — Phase 3 Migration
-- =============================================================================
--
-- Purpose:
--   Adds the engagement layer: likes, comments, and "watched/listened/played
--   with" tags on list_items, plus a per-profile timestamp used by the in-app
--   notification feed to compute unread badges.
--
-- What this migration does:
--   1. Creates `public.likes`        (id, user_id, list_item_id, created_at)
--        + composite-style UNIQUE on (user_id, list_item_id) — one like per pair
--        + indexes for "likes on this item" and "items I've liked"
--   2. Creates `public.comments`     (id, user_id, list_item_id, body, edited_at)
--        + body length CHECK (trimmed length 1..500)
--        + index for "comments on this item"
--   3. Creates `public.watched_with` (id, list_item_id, tagged_user_id, ...)
--        + UNIQUE on (list_item_id, tagged_user_id) — one tag per pair
--        + indexes for "tags on this item" and "items I'm tagged in"
--   4. Adds `profiles.notifications_last_seen_at` (timestamptz, default now())
--   5. Enables RLS on the three new tables.
--   6. RLS — likes:
--        SELECT visible when the parent list is public OR caller owns the list
--        INSERT only by the liker, only on public items
--        DELETE only by the liker
--   7. RLS — comments:
--        SELECT same shape as likes
--        INSERT only by the author, only on public items
--        UPDATE only by the author (used to edit body; client also sets edited_at)
--        DELETE only by the author
--   8. RLS — watched_with:
--        SELECT visible when parent list is public OR caller owns list OR caller is tagged
--        INSERT only by the LIST OWNER (you tag friends on YOUR items)
--        DELETE by the list owner OR by the tagged user (consent / abuse mitigation)
--
-- How to apply:
--   1. (Recommended) Back up the project first: Supabase dashboard → Database →
--      Backups → "Take a backup now". Or via CLI:
--          pg_dump --host=db.<project-ref>.supabase.co \
--                  --username=postgres --no-owner \
--                  --file=rankr-pre-phase3.sql postgres
--   2. Supabase dashboard → SQL Editor → "New query".
--   3. Paste this ENTIRE file in.
--   4. Click "Run" (or step through each numbered section — per-block
--      verification queries are included as comments below each).
--   5. Re-test the app locally. New tables start empty; no existing data is
--      touched. `profiles.notifications_last_seen_at` defaults to now(), so
--      every existing profile starts with zero "unread" notifications.
--
-- Idempotency:
--   Safe to re-run. Every statement uses one of:
--     - CREATE TABLE IF NOT EXISTS
--     - CREATE INDEX IF NOT EXISTS
--     - ALTER TABLE … ADD COLUMN IF NOT EXISTS
--     - ALTER TABLE … ENABLE ROW LEVEL SECURITY  (no-op if already on)
--     - DROP POLICY IF EXISTS + CREATE POLICY
--
-- Dependencies:
--   - Requires `pgcrypto` for `gen_random_uuid()`. Supabase enables it by
--     default; if you ever see "function gen_random_uuid() does not exist",
--     run:  CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   - Phases 1 and 2 should already be applied. The RLS policies reference
--     `lists.visibility` (Phase 1).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. likes table
-- -----------------------------------------------------------------------------
--
-- One row per (user, list_item) pair. We keep a surrogate uuid PK so the row
-- has a stable URL/handle, but the natural key is the UNIQUE on
-- (user_id, list_item_id) — that's what prevents double-liking.
--
-- ON DELETE CASCADE on both FKs: if a user is deleted, their likes vanish;
-- if a list_item is deleted, its likes vanish. No orphan rows.

CREATE TABLE IF NOT EXISTS public.likes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_item_id  uuid NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, list_item_id)
);

CREATE INDEX IF NOT EXISTS likes_item_idx
  ON public.likes (list_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS likes_user_idx
  ON public.likes (user_id, created_at DESC);

-- Verification:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'likes'
--   ORDER BY ordinal_position;
--   -- Expect: id, user_id, list_item_id, created_at — all NOT NULL.
--
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'likes'
--   ORDER BY indexname;
--   -- Expect:
--   --   likes_item_idx
--   --   likes_pkey
--   --   likes_user_idx
--   --   likes_user_id_list_item_id_key  (the UNIQUE constraint)


-- -----------------------------------------------------------------------------
-- 2. comments table
-- -----------------------------------------------------------------------------
--
-- Surrogate uuid PK. The CHECK uses length(trim(body)) so a comment of pure
-- whitespace is rejected even if it's technically 500 chars of spaces.
-- `edited_at` starts null and is set by the client (or a trigger if we add
-- one later) when the body is updated.

CREATE TABLE IF NOT EXISTS public.comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_item_id  uuid NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz
);

CREATE INDEX IF NOT EXISTS comments_item_idx
  ON public.comments (list_item_id, created_at DESC);

-- Verification:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'comments'
--   ORDER BY ordinal_position;
--   -- Expect: id (NOT NULL), user_id (NOT NULL), list_item_id (NOT NULL),
--   --         body (NOT NULL), created_at (NOT NULL), edited_at (YES).
--
--   -- Spot-check the length CHECK:
--   INSERT INTO public.comments (user_id, list_item_id, body)
--   VALUES (auth.uid(), '<some-public-item-id>', '   ');
--   -- Expect: error — "new row for relation 'comments' violates check constraint".


-- -----------------------------------------------------------------------------
-- 3. watched_with table
-- -----------------------------------------------------------------------------
--
-- "I watched this movie with @alice." A tag pair: (list_item, tagged_user).
-- Owner of the list_item creates the row; the tagged user has no consent step
-- in v1 (untag-themselves is their escape hatch).
--
-- UNIQUE (list_item_id, tagged_user_id) prevents duplicate tags for the same
-- pair. Same CASCADE behaviour on both FKs as the other tables.

CREATE TABLE IF NOT EXISTS public.watched_with (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_item_id    uuid NOT NULL REFERENCES public.list_items(id) ON DELETE CASCADE,
  tagged_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_item_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS watched_with_item_idx
  ON public.watched_with (list_item_id);

CREATE INDEX IF NOT EXISTS watched_with_user_idx
  ON public.watched_with (tagged_user_id, created_at DESC);

-- Verification:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'watched_with'
--   ORDER BY ordinal_position;
--   -- Expect: id, list_item_id, tagged_user_id, created_at — all NOT NULL.


-- -----------------------------------------------------------------------------
-- 4. profiles.notifications_last_seen_at
-- -----------------------------------------------------------------------------
--
-- A per-profile timestamp used to compute the unread-badge count. The client
-- bumps this to now() when the user opens the notifications screen; the
-- notifications feed query treats any (like / comment / tag) created after
-- this timestamp as unread.
--
-- DEFAULT now() means every existing profile starts with zero unread items —
-- we don't retroactively mark every old like/comment as "new" the moment
-- this column is added.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at timestamptz NOT NULL DEFAULT now();

-- Verification:
--   SELECT id, username, notifications_last_seen_at FROM public.profiles LIMIT 5;
--   -- Expect: every row has a non-null timestamp (defaulted to ~now()).


-- -----------------------------------------------------------------------------
-- 5. Enable RLS on the three new tables
-- -----------------------------------------------------------------------------
--
-- RLS must be explicitly enabled or policies below are ignored. Idempotent.

ALTER TABLE public.likes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watched_with ENABLE ROW LEVEL SECURITY;

-- Verification:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('likes', 'comments', 'watched_with')
--     AND relnamespace = 'public'::regnamespace
--   ORDER BY relname;
--   -- Expect: relrowsecurity = true for all three.


-- -----------------------------------------------------------------------------
-- 6. RLS — likes
-- -----------------------------------------------------------------------------
--
-- SELECT: visible when the parent list is public, OR when the caller owns
-- the parent list (so an owner can see who liked their private item, even
-- though no one *should* be able to like a private item under INSERT's rule
-- — keeps things forward-compatible).
--
-- INSERT: must be the liker themselves AND target must be on a public list.
-- DELETE: must be the liker themselves.

DROP POLICY IF EXISTS "Likes on public items readable" ON public.likes;
CREATE POLICY "Likes on public items readable"
  ON public.likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = likes.list_item_id
        AND (l.visibility = 'public' OR l.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can like public items" ON public.likes;
CREATE POLICY "Users can like public items"
  ON public.likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = list_item_id AND l.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "Users can unlike" ON public.likes;
CREATE POLICY "Users can unlike"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

-- Verification (as an authed user, with a known public list_item):
--   INSERT INTO public.likes (user_id, list_item_id)
--   VALUES (auth.uid(), '<public-item-id>');
--   -- Expect: success.
--   INSERT INTO public.likes (user_id, list_item_id)
--   VALUES (auth.uid(), '<private-item-id>');
--   -- Expect: "new row violates row-level security policy".


-- -----------------------------------------------------------------------------
-- 7. RLS — comments
-- -----------------------------------------------------------------------------
--
-- Same shape as likes for SELECT/INSERT, plus UPDATE (used to edit body and
-- bump edited_at) and DELETE — both gated on author == auth.uid().

DROP POLICY IF EXISTS "Comments on public items readable" ON public.comments;
CREATE POLICY "Comments on public items readable"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = comments.list_item_id
        AND (l.visibility = 'public' OR l.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can comment on public items" ON public.comments;
CREATE POLICY "Users can comment on public items"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = list_item_id AND l.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "Users can edit own comments" ON public.comments;
CREATE POLICY "Users can edit own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Verification:
--   INSERT INTO public.comments (user_id, list_item_id, body)
--   VALUES (auth.uid(), '<public-item-id>', 'first!');
--   -- Expect: success.
--   UPDATE public.comments SET body = 'edited', edited_at = now()
--   WHERE id = '<your-comment-id>';
--   -- Expect: 1 row updated.
--   UPDATE public.comments SET body = 'naughty' WHERE id = '<other-users-comment-id>';
--   -- Expect: 0 rows updated (RLS hides it).


-- -----------------------------------------------------------------------------
-- 8. RLS — watched_with
-- -----------------------------------------------------------------------------
--
-- Different shape from likes/comments because the actor and the subject are
-- different people:
--   - INSERT: only the list owner can tag (you tag friends on YOUR items)
--   - DELETE: the list owner OR the tagged user themselves (the tagged user
--             always has an untag-themselves escape hatch for consent reasons)
--   - SELECT: visible when parent list is public, OR caller owns the list,
--             OR caller is the tagged user (so they can find their own tags
--             on otherwise-private items).

DROP POLICY IF EXISTS "Watched-with readable on public items" ON public.watched_with;
CREATE POLICY "Watched-with readable on public items"
  ON public.watched_with FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = watched_with.list_item_id
        AND (
          l.visibility = 'public'
          OR l.user_id = auth.uid()
          OR tagged_user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "List owner can tag" ON public.watched_with;
CREATE POLICY "List owner can tag"
  ON public.watched_with FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = list_item_id AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner or tagged can untag" ON public.watched_with;
CREATE POLICY "Owner or tagged can untag"
  ON public.watched_with FOR DELETE
  USING (
    tagged_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.list_items li
      JOIN public.lists l ON l.id = li.list_id
      WHERE li.id = list_item_id AND l.user_id = auth.uid()
    )
  );

-- Verification:
--   -- As list owner, tag a friend on one of your items:
--   INSERT INTO public.watched_with (list_item_id, tagged_user_id)
--   VALUES ('<your-item-id>', '<friend-user-id>');
--   -- Expect: success.
--
--   -- As a non-owner, try to tag someone on a stranger's item:
--   INSERT INTO public.watched_with (list_item_id, tagged_user_id)
--   VALUES ('<stranger-item-id>', '<friend-user-id>');
--   -- Expect: "new row violates row-level security policy".
--
--   -- As the tagged user, untag yourself:
--   DELETE FROM public.watched_with
--   WHERE list_item_id = '<some-item-id>' AND tagged_user_id = auth.uid();
--   -- Expect: success.


-- =============================================================================
-- End of Phase 3 migration.
-- =============================================================================
--
-- Next phase: Phase 4 (posts / notes feed) — see docs/social-schema.md §6.
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo this migration):
--
-- DROP POLICY IF EXISTS "Owner or tagged can untag"          ON public.watched_with;
-- DROP POLICY IF EXISTS "List owner can tag"                 ON public.watched_with;
-- DROP POLICY IF EXISTS "Watched-with readable on public items" ON public.watched_with;
--
-- DROP POLICY IF EXISTS "Users can delete own comments"      ON public.comments;
-- DROP POLICY IF EXISTS "Users can edit own comments"        ON public.comments;
-- DROP POLICY IF EXISTS "Users can comment on public items"  ON public.comments;
-- DROP POLICY IF EXISTS "Comments on public items readable"  ON public.comments;
--
-- DROP POLICY IF EXISTS "Users can unlike"                   ON public.likes;
-- DROP POLICY IF EXISTS "Users can like public items"        ON public.likes;
-- DROP POLICY IF EXISTS "Likes on public items readable"     ON public.likes;
--
-- DROP INDEX IF EXISTS public.watched_with_user_idx;
-- DROP INDEX IF EXISTS public.watched_with_item_idx;
-- DROP INDEX IF EXISTS public.comments_item_idx;
-- DROP INDEX IF EXISTS public.likes_user_idx;
-- DROP INDEX IF EXISTS public.likes_item_idx;
--
-- DROP TABLE IF EXISTS public.watched_with;
-- DROP TABLE IF EXISTS public.comments;
-- DROP TABLE IF EXISTS public.likes;
--
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS notifications_last_seen_at;
--
-- =============================================================================
