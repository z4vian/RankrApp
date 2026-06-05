-- =============================================================================
-- Rankr — Phase 2 Migration
-- =============================================================================
--
-- Purpose:
--   Adds the follow graph: a single `follows` table connecting users to other
--   users they follow, plus the RLS policies that govern who can read/write
--   those rows.
--
-- What this migration does:
--   1. Creates `public.follows` (follower_id, followed_id, created_at)
--        - composite PK on (follower_id, followed_id) — enforces "can't follow
--          the same person twice"
--        - CHECK (follower_id <> followed_id) — no self-follows
--        - both FK columns CASCADE on delete of the auth.users row
--   2. Creates two single-column indexes for fast "who follows X / who does X
--      follow" lookups (sorted by created_at DESC for paginated feeds)
--   3. Enables RLS on the table
--   4. RLS: anyone can SELECT (the follow graph is public, Beli-style)
--   5. RLS: a user can INSERT only rows where follower_id = auth.uid()
--   6. RLS: a user can DELETE only rows where follower_id = auth.uid()
--   (No UPDATE policy — follow rows are immutable; you delete + re-create.)
--
-- How to apply:
--   1. (Recommended) Take a backup of the Supabase project first. From the
--      Supabase dashboard: Database → Backups → "Take a backup now".
--      Or via CLI:
--          pg_dump --host=db.<project-ref>.supabase.co \
--                  --username=postgres --no-owner \
--                  --file=rankr-pre-phase2.sql postgres
--   2. Open Supabase dashboard → SQL Editor → "New query".
--   3. Paste this ENTIRE file into the editor.
--   4. Click "Run" (or run each numbered block individually to spot-check —
--      see "Verification" comments below each block).
--   5. After running, re-test the app locally. No existing data is touched;
--      the new table starts empty.
--
-- Idempotency:
--   This script is safe to re-run. Every statement uses one of:
--     - CREATE TABLE IF NOT EXISTS
--     - CREATE INDEX IF NOT EXISTS
--     - ALTER TABLE ... ENABLE ROW LEVEL SECURITY  (idempotent in Postgres)
--     - DROP POLICY IF EXISTS + CREATE POLICY
--   So running it twice produces the same final state as running it once.
--
-- Dependency:
--   None beyond standard Supabase. Phase 1 does not have to be applied first,
--   but the social-schema doc assumes you've applied them in order.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. follows table
-- -----------------------------------------------------------------------------
--
-- One row per (follower, followed) pair. Composite PK doubles as a uniqueness
-- constraint so you can't follow the same person twice. ON DELETE CASCADE
-- ensures that when an auth.users row is removed (account deletion), all
-- follow rows referencing that user are cleaned up automatically — no orphans.

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

-- Verification:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'follows'
--   ORDER BY ordinal_position;
--   -- Expect three rows: follower_id (uuid, NO), followed_id (uuid, NO),
--   --                    created_at (timestamp with time zone, NO).


-- -----------------------------------------------------------------------------
-- 2. Indexes for fast follower / following lookups
-- -----------------------------------------------------------------------------
--
-- The composite PK (follower_id, followed_id) covers leftmost-prefix lookups
-- by follower_id only — but it doesn't help "who follows X?" (a followed_id
-- scan). We add both directions explicitly, ordered by created_at DESC so
-- paginated "newest followers" / "newest following" feeds are index-only
-- scans without an extra sort step.

CREATE INDEX IF NOT EXISTS follows_follower_idx
  ON public.follows (follower_id, created_at DESC);

CREATE INDEX IF NOT EXISTS follows_followed_idx
  ON public.follows (followed_id, created_at DESC);

-- Verification:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'follows'
--   ORDER BY indexname;
--   -- Expect three rows:
--   --   follows_followed_idx (followed_id, created_at DESC)
--   --   follows_follower_idx (follower_id, created_at DESC)
--   --   follows_pkey         (follower_id, followed_id) — composite PK


-- -----------------------------------------------------------------------------
-- 3. Enable RLS
-- -----------------------------------------------------------------------------
--
-- RLS must be explicitly enabled on every new table; otherwise the policies
-- defined below are ignored and the table behaves as fully open. This call
-- is idempotent (no-op if RLS is already on).

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Verification:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname = 'follows' AND relnamespace = 'public'::regnamespace;
--   -- Expect: relrowsecurity = true.


-- -----------------------------------------------------------------------------
-- 4. RLS — anyone can read the follow graph
-- -----------------------------------------------------------------------------
--
-- Following is public information in the Beli model. Anyone (anon or authed)
-- can answer "who follows X?" and "who does X follow?". If we later decide to
-- support Twitter-style protected accounts, this is the policy to tighten.

DROP POLICY IF EXISTS "Follows readable by everyone" ON public.follows;

CREATE POLICY "Follows readable by everyone"
  ON public.follows FOR SELECT
  USING (true);

-- Verification (anonymously, after inserting a test row as an authed user):
--   SELECT follower_id, followed_id, created_at FROM public.follows LIMIT 5;
--   -- Expect: rows visible without auth.


-- -----------------------------------------------------------------------------
-- 5. RLS — users can follow on their own behalf
-- -----------------------------------------------------------------------------
--
-- INSERTs must have follower_id = auth.uid(). The CHECK constraint on the
-- table already blocks self-follows; this policy makes sure no one can write
-- a follow row pretending to be a different follower.

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Verification (as an authed user):
--   INSERT INTO public.follows (follower_id, followed_id)
--   VALUES (auth.uid(), '<some-other-user-id>');
--   -- Expect: success.
--   -- Then try to spoof another user:
--   INSERT INTO public.follows (follower_id, followed_id)
--   VALUES ('<some-other-user-id>', auth.uid());
--   -- Expect: error "new row violates row-level security policy".


-- -----------------------------------------------------------------------------
-- 6. RLS — users can unfollow on their own behalf
-- -----------------------------------------------------------------------------
--
-- Symmetric with INSERT: a user can only DELETE rows where they are the
-- follower. No one can force-remove a follow from someone else's graph.

DROP POLICY IF EXISTS "Users can unfollow others" ON public.follows;

CREATE POLICY "Users can unfollow others"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Verification (as an authed user):
--   DELETE FROM public.follows
--   WHERE follower_id = auth.uid() AND followed_id = '<some-other-user-id>';
--   -- Expect: success (or zero-rows if not following).
--   -- Then try to delete a follow you don't own:
--   DELETE FROM public.follows
--   WHERE follower_id = '<some-other-user-id>';
--   -- Expect: zero rows affected (RLS hides them).


-- =============================================================================
-- End of Phase 2 migration.
-- =============================================================================
--
-- Next phase: Phase 3 (likes, comments, watched_with) — see
-- docs/social-schema.md §5.
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo this migration):
--
-- DROP POLICY IF EXISTS "Users can unfollow others"   ON public.follows;
-- DROP POLICY IF EXISTS "Users can follow others"     ON public.follows;
-- DROP POLICY IF EXISTS "Follows readable by everyone" ON public.follows;
-- DROP INDEX IF EXISTS public.follows_followed_idx;
-- DROP INDEX IF EXISTS public.follows_follower_idx;
-- DROP TABLE IF EXISTS public.follows;
--
-- =============================================================================
