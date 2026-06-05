-- =============================================================================
-- Rankr — Hotfix 1: PostgREST profile-embed foreign keys
-- =============================================================================
--
-- Problem:
--   The app throws: "Could not find a relationship between 'posts' and
--   'profiles' in the schema cache" (and the equivalent for `comments`,
--   `notifications` actor lookups, etc.).
--
-- Root cause:
--   `posts.user_id`, `comments.user_id`, `likes.user_id`, `follows.follower_id`,
--   `follows.followed_id`, and `watched_with.tagged_user_id` all have FKs to
--   `auth.users.id`. The `profiles` table ALSO has its PK referencing
--   `auth.users.id`. PostgREST can't auto-resolve embeds like
--   `posts.select('*, author:profiles!user_id(...)')` because there's no
--   DIRECT FK between the table and `profiles`.
--
-- Fix:
--   Add an explicit (additional) FK constraint from each `user_id`-like column
--   to `profiles.id`. Since `profiles.id = auth.users.id` 1:1, and these
--   columns are already FK'd to `auth.users.id`, the new constraint is
--   semantically a no-op — but PostgREST uses it to resolve the embed.
--
--   Each constraint is added with `NOT VALID` first, which skips the check on
--   existing rows. Then `VALIDATE CONSTRAINT` runs. If any row's user_id
--   doesn't have a corresponding profile, VALIDATE will fail and you'll need
--   to backfill profiles before retrying.
--
-- How to apply:
--   1. Open Supabase dashboard → SQL Editor → "New query"
--   2. Paste this entire file → Run
--   3. After running, refresh PostgREST's schema cache:
--        - Easiest: Supabase dashboard → Settings → API → "Reload schema"
--        - Or via SQL: NOTIFY pgrst, 'reload schema';
--   4. Re-open the app and verify the feed loads without the schema-cache error
--
-- Idempotency:
--   Safe to re-run. Each constraint check uses `IF NOT EXISTS` semantics via
--   a DO $$ block that catches duplicate_object errors.
-- =============================================================================


-- Helper: add FK to profiles, idempotently, then validate.
-- We wrap in DO blocks so duplicate-constraint errors don't abort the file.

DO $$
BEGIN
  ALTER TABLE public.posts
    ADD CONSTRAINT posts_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.posts VALIDATE CONSTRAINT posts_user_id_profiles_fkey;


DO $$
BEGIN
  ALTER TABLE public.comments
    ADD CONSTRAINT comments_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.comments VALIDATE CONSTRAINT comments_user_id_profiles_fkey;


DO $$
BEGIN
  ALTER TABLE public.likes
    ADD CONSTRAINT likes_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.likes VALIDATE CONSTRAINT likes_user_id_profiles_fkey;


DO $$
BEGIN
  ALTER TABLE public.watched_with
    ADD CONSTRAINT watched_with_tagged_user_id_profiles_fkey
    FOREIGN KEY (tagged_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.watched_with VALIDATE CONSTRAINT watched_with_tagged_user_id_profiles_fkey;


DO $$
BEGIN
  ALTER TABLE public.follows
    ADD CONSTRAINT follows_follower_id_profiles_fkey
    FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.follows VALIDATE CONSTRAINT follows_follower_id_profiles_fkey;


DO $$
BEGIN
  ALTER TABLE public.follows
    ADD CONSTRAINT follows_followed_id_profiles_fkey
    FOREIGN KEY (followed_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.follows VALIDATE CONSTRAINT follows_followed_id_profiles_fkey;


-- Tell PostgREST to reload its schema cache so the new relationships are visible.
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- Verification:
--
-- Run this in the SQL Editor to confirm all six constraints exist:
--
--   SELECT conname, conrelid::regclass::text AS table_name
--   FROM pg_constraint
--   WHERE conname LIKE '%_profiles_fkey'
--   ORDER BY table_name, conname;
--
-- Expect six rows:
--   comments_user_id_profiles_fkey               | comments
--   follows_followed_id_profiles_fkey            | follows
--   follows_follower_id_profiles_fkey            | follows
--   likes_user_id_profiles_fkey                  | likes
--   posts_user_id_profiles_fkey                  | posts
--   watched_with_tagged_user_id_profiles_fkey    | watched_with
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo this hotfix):
--
-- ALTER TABLE public.follows      DROP CONSTRAINT IF EXISTS follows_followed_id_profiles_fkey;
-- ALTER TABLE public.follows      DROP CONSTRAINT IF EXISTS follows_follower_id_profiles_fkey;
-- ALTER TABLE public.watched_with DROP CONSTRAINT IF EXISTS watched_with_tagged_user_id_profiles_fkey;
-- ALTER TABLE public.likes        DROP CONSTRAINT IF EXISTS likes_user_id_profiles_fkey;
-- ALTER TABLE public.comments     DROP CONSTRAINT IF EXISTS comments_user_id_profiles_fkey;
-- ALTER TABLE public.posts        DROP CONSTRAINT IF EXISTS posts_user_id_profiles_fkey;
-- NOTIFY pgrst, 'reload schema';
-- =============================================================================
