-- =============================================================================
-- Rankr — Phase 4 Migration
-- =============================================================================
--
-- Purpose:
--   Adds the posts / notes feed: Twitter-style short-form posts with three
--   visibility tiers (private / followers / public), an optional attached
--   list_item, and the RLS policies that power the new Home feed.
--
-- What this migration does:
--   1. Creates `public.posts` (id, user_id, body, list_item_id, visibility, created_at)
--   2. Creates three indexes:
--        - posts_user_created_idx        (profile-page "X's posts" listing)
--        - posts_visibility_created_idx  (the global public feed)
--        - posts_feed_idx                (followed-users feed, leftmost-prefix friendly)
--   3. Enables RLS on the table.
--   4. RLS SELECT — three permissive policies, OR'd at runtime by Postgres:
--        a. Author can read all their own posts (any visibility).
--        b. Anyone can read posts where visibility = 'public'.
--        c. Followers can read posts where visibility = 'followers' AND they
--           follow the author (via a JOIN to `public.follows`).
--   5. RLS INSERT — only the author themselves (`auth.uid() = user_id`).
--   6. RLS DELETE — only the author themselves.
--   7. Intentionally NO UPDATE policy — posts are immutable in v1 (future phase
--      will add edit support).
--
-- Notes / design rationale:
--   - `list_item_id` uses `ON DELETE SET NULL` (not CASCADE). Rationale: if a
--     user later deletes the ranked item they wrote about, the user's POST
--     about it should survive (the narrative content matters; the attachment
--     is decorative). The post will simply render without an embed.
--   - No UPDATE policy. Posts are immutable in v1 — keeps the moderation /
--     edit-history story simple. A future phase will add an `edited_at`
--     column and an UPDATE policy gated on `auth.uid() = user_id`.
--   - Three separate SELECT policies (one per visibility tier) instead of one
--     giant `USING (auth.uid() = user_id OR visibility = 'public' OR ...)`.
--     Rationale: Postgres OR-combines multiple permissive policies on the
--     same operation; splitting them reads better, indexes cleaner per
--     intent, and individual policies can be tightened later in isolation.
--
-- How to apply:
--   1. (Recommended) Back up the project first: Supabase dashboard → Database →
--      Backups → "Take a backup now". Or via CLI:
--          pg_dump --host=db.<project-ref>.supabase.co \
--                  --username=postgres --no-owner \
--                  --file=rankr-pre-phase4.sql postgres
--   2. Supabase dashboard → SQL Editor → "New query".
--   3. Paste this ENTIRE file in.
--   4. Click "Run" (or step through each numbered section — per-block
--      verification queries are included as comments below each).
--   5. Re-test the app locally. New table starts empty; no existing data is
--      touched.
--
-- Idempotency:
--   Safe to re-run. Every statement uses one of:
--     - CREATE TABLE IF NOT EXISTS
--     - CREATE INDEX IF NOT EXISTS
--     - ALTER TABLE … ENABLE ROW LEVEL SECURITY  (no-op if already on)
--     - DROP POLICY IF EXISTS + CREATE POLICY
--
-- Dependencies:
--   - Requires `pgcrypto` for `gen_random_uuid()`. Supabase enables it by
--     default; if you ever see "function gen_random_uuid() does not exist",
--     run:  CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   - Phase 2 must be applied first. The "Followers read followers-visibility
--     posts" policy joins to `public.follows`; that table is created in
--     PHASE-2-MIGRATION.sql. If you somehow run Phase 4 before Phase 2, the
--     follows-visibility SELECT policy will error at evaluation time on
--     "relation public.follows does not exist". The two other SELECT policies
--     (own + public) work without follows, so you'd still get partial
--     functionality.
--   - Phase 1 is implicitly required for the visibility CHECK to make sense
--     in the wider data model (lists / posts both use the same visibility
--     vocabulary), but this migration does not directly depend on Phase 1
--     SQL having run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. posts table
-- -----------------------------------------------------------------------------
--
-- Surrogate uuid PK. Body length CHECK uses `length(trim(body))` so a post of
-- pure whitespace is rejected (matches the comments-table convention in
-- Phase 3). `list_item_id` is nullable: a post may attach an item or not.
-- ON DELETE SET NULL on the list_items FK keeps posts alive when the
-- underlying ranked item is later deleted.

CREATE TABLE IF NOT EXISTS public.posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
  list_item_id  uuid REFERENCES public.list_items(id) ON DELETE SET NULL,
  visibility    text NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('private', 'followers', 'public')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Verification:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'posts'
--   ORDER BY ordinal_position;
--   -- Expect:
--   --   id            uuid                       NO  gen_random_uuid()
--   --   user_id       uuid                       NO
--   --   body          text                       NO
--   --   list_item_id  uuid                       YES
--   --   visibility    text                       NO  'private'
--   --   created_at    timestamp with time zone   NO  now()
--
--   -- Spot-check the length CHECK rejects whitespace-only bodies:
--   INSERT INTO public.posts (user_id, body, visibility)
--   VALUES (auth.uid(), '   ', 'private');
--   -- Expect: error — "new row for relation 'posts' violates check constraint".
--
--   -- Spot-check the visibility CHECK rejects unknown values:
--   INSERT INTO public.posts (user_id, body, visibility)
--   VALUES (auth.uid(), 'test', 'secret');
--   -- Expect: error — "new row for relation 'posts' violates check constraint".


-- -----------------------------------------------------------------------------
-- 2. Indexes for feed queries
-- -----------------------------------------------------------------------------
--
-- Three indexes for the three dominant query shapes:
--
--   posts_user_created_idx        ─ profile-page "@alice's posts" listing.
--                                   Covers (user_id, created_at DESC).
--   posts_visibility_created_idx  ─ global anonymous public feed.
--                                   Covers (visibility, created_at DESC).
--   posts_feed_idx                ─ home feed of "users I follow + my own".
--                                   Covers (user_id, visibility, created_at DESC).
--                                   The leftmost-prefix (user_id) keeps the
--                                   "WHERE user_id IN (...)" path fast;
--                                   secondary visibility narrows further.

CREATE INDEX IF NOT EXISTS posts_user_created_idx
  ON public.posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_visibility_created_idx
  ON public.posts (visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_feed_idx
  ON public.posts (user_id, visibility, created_at DESC);

-- Verification:
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'posts'
--   ORDER BY indexname;
--   -- Expect:
--   --   posts_feed_idx
--   --   posts_pkey
--   --   posts_user_created_idx
--   --   posts_visibility_created_idx


-- -----------------------------------------------------------------------------
-- 3. Enable RLS
-- -----------------------------------------------------------------------------
--
-- Must be on or the policies below are ignored and the table behaves as
-- fully open. Idempotent (no-op if RLS is already enabled).

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Verification:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname = 'posts' AND relnamespace = 'public'::regnamespace;
--   -- Expect: relrowsecurity = true.


-- -----------------------------------------------------------------------------
-- 4. RLS — SELECT policies (three permissive, OR'd by Postgres)
-- -----------------------------------------------------------------------------
--
-- Policy a: the author can always read their own posts at any visibility tier.
-- Policy b: any caller (anon or authed) can read public posts.
-- Policy c: a follower can read a 'followers'-visibility post of someone they
--           follow — checked via a row-EXISTS on the `follows` table.
--
-- Postgres evaluates ALL permissive policies and OR's the results. A row is
-- visible if ANY of the three USING clauses succeeds.

DROP POLICY IF EXISTS "Author reads own posts" ON public.posts;
CREATE POLICY "Author reads own posts"
  ON public.posts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone reads public posts" ON public.posts;
CREATE POLICY "Anyone reads public posts"
  ON public.posts FOR SELECT
  USING (visibility = 'public');

DROP POLICY IF EXISTS "Followers read followers-visibility posts" ON public.posts;
CREATE POLICY "Followers read followers-visibility posts"
  ON public.posts FOR SELECT
  USING (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follows.follower_id = auth.uid()
        AND follows.followed_id = posts.user_id
    )
  );

-- Verification (after seeding three posts at the three visibilities):
--   -- As the author:
--   SELECT count(*) FROM public.posts WHERE user_id = auth.uid();
--   -- Expect: 3 (own posts visible at all tiers).
--
--   -- As a stranger (different auth.uid()):
--   SELECT count(*) FROM public.posts WHERE user_id = '<author-id>';
--   -- Expect: 1 (only the 'public' row).
--
--   -- As a follower of the author (after follows.INSERT):
--   SELECT count(*) FROM public.posts WHERE user_id = '<author-id>';
--   -- Expect: 2 ('public' + 'followers').


-- -----------------------------------------------------------------------------
-- 5. RLS — INSERT + DELETE policies (own posts only)
-- -----------------------------------------------------------------------------
--
-- INSERT: WITH CHECK enforces that the user can't write a post pretending to
--         be someone else.
-- DELETE: USING enforces that a user can't delete someone else's post.
--
-- No UPDATE policy is defined — posts are immutable in v1. Any future
-- "edit post" feature will need to add a separate UPDATE policy and likely
-- an `edited_at` column.

DROP POLICY IF EXISTS "Users create own posts" ON public.posts;
CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own posts" ON public.posts;
CREATE POLICY "Users delete own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- Verification (as an authed user):
--   INSERT INTO public.posts (user_id, body, visibility)
--   VALUES (auth.uid(), 'hello world', 'public');
--   -- Expect: success.
--
--   -- Try to spoof another user:
--   INSERT INTO public.posts (user_id, body, visibility)
--   VALUES ('<other-user-id>', 'naughty', 'public');
--   -- Expect: error — "new row violates row-level security policy".
--
--   -- Try to delete someone else's post:
--   DELETE FROM public.posts WHERE user_id <> auth.uid();
--   -- Expect: 0 rows affected (RLS hides them from the DELETE target set).


-- =============================================================================
-- End of Phase 4 migration.
-- =============================================================================
--
-- This is the final phase in the originally-agreed roadmap (Phases 1–4).
-- Future work (Phase 5+) — see docs/social-schema.md §10 — includes:
--   - notifications table (currently derived on the fly in lib/notifications.ts)
--   - post threading / replies
--   - reposts / quote-posts
--   - post UPDATE policy + edited_at column
--   - block lists
--   - account-deletion endpoint
--   - new media types (books, TV)
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo this migration):
--
-- DROP POLICY IF EXISTS "Users delete own posts"                    ON public.posts;
-- DROP POLICY IF EXISTS "Users create own posts"                    ON public.posts;
-- DROP POLICY IF EXISTS "Followers read followers-visibility posts" ON public.posts;
-- DROP POLICY IF EXISTS "Anyone reads public posts"                 ON public.posts;
-- DROP POLICY IF EXISTS "Author reads own posts"                    ON public.posts;
--
-- DROP INDEX IF EXISTS public.posts_feed_idx;
-- DROP INDEX IF EXISTS public.posts_visibility_created_idx;
-- DROP INDEX IF EXISTS public.posts_user_created_idx;
--
-- DROP TABLE IF EXISTS public.posts;
--
-- =============================================================================
