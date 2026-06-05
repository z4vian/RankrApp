-- =============================================================================
-- Rankr — Phase 1 Migration
-- =============================================================================
--
-- Purpose:
--   Lays the database groundwork for the Beli-style social rollout. After this
--   migration, the database is CAPABLE of representing public lists/profiles,
--   but no client UI changes ship in Phase 1.
--
-- What this migration does:
--   1. Adds `lists.visibility` (text, 'public' | 'private', default 'private')
--   2. Enforces uniqueness on non-null `profiles.username` (partial unique index)
--   3. Adds `profiles.is_public` (boolean, default true)
--   4. Adds an RLS policy so anyone can SELECT public lists
--   5. Adds an RLS policy so anyone can SELECT list_items belonging to public lists
--   6. Adds an RLS policy so anyone can SELECT public profiles
--
-- How to apply:
--   1. (Recommended) Take a backup of the Supabase project first. From the
--      Supabase dashboard:
--          Database → Backups → "Take a backup now"
--      Or from the CLI:
--          pg_dump --host=db.<project-ref>.supabase.co \
--                  --username=postgres --no-owner \
--                  --file=rankr-pre-phase1.sql postgres
--   2. Open the Supabase dashboard → SQL Editor → "New query".
--   3. Paste this ENTIRE file into the editor.
--   4. Click "Run" (or run each numbered block individually if you prefer to
--      verify step-by-step — see "Verification" comments below each block).
--   5. After running, re-test the app locally. Existing data is unaffected
--      (all new columns have safe defaults).
--
-- Idempotency:
--   This script is safe to re-run. Every statement uses one of:
--     - ADD COLUMN IF NOT EXISTS
--     - DROP INDEX IF EXISTS + CREATE UNIQUE INDEX
--     - DROP POLICY IF EXISTS + CREATE POLICY
--   So running it twice produces the same final state as running it once.
--
-- Rollback:
--   To undo this migration:
--     DROP POLICY IF EXISTS "Public profiles viewable by everyone"   ON public.profiles;
--     DROP POLICY IF EXISTS "Items of public lists viewable by everyone" ON public.list_items;
--     DROP POLICY IF EXISTS "Public lists viewable by everyone"      ON public.lists;
--     ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_public;
--     DROP INDEX IF EXISTS public.profiles_username_key;
--     ALTER TABLE public.lists    DROP COLUMN IF EXISTS visibility;
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. List visibility column
-- -----------------------------------------------------------------------------
--
-- Adds an opt-in visibility flag to every list. Defaults to 'private' so
-- existing lists remain private and no data is unintentionally exposed.

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));

-- Verification (run as a separate query if you want to spot-check):
--   SELECT id, title, visibility FROM public.lists LIMIT 5;
--   -- Expect: every row has visibility = 'private'.


-- -----------------------------------------------------------------------------
-- 2. Profile username uniqueness (partial unique index)
-- -----------------------------------------------------------------------------
--
-- Existing rows may have NULL usernames (legacy users predate the requirement).
-- A column-level UNIQUE constraint would treat multiple NULLs as distinct in
-- Postgres, which is what we want — BUT it would conflict with any pre-existing
-- column constraint named "profiles_username_key". We use a partial unique
-- index instead so we have full control over the name and predicate.
--
-- After this index exists, two new signups cannot claim the same username.
-- Legacy NULL usernames are still allowed (one per row); the onboarding flow
-- (see docs/onboarding-flow-todo.md) will require users to set a username
-- before reaching the main app.

DROP INDEX IF EXISTS public.profiles_username_key;

CREATE UNIQUE INDEX profiles_username_key
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- Verification:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'profiles' AND indexname = 'profiles_username_key';
--   -- Expect one row showing the partial unique index.


-- -----------------------------------------------------------------------------
-- 3. Profile public-toggle
-- -----------------------------------------------------------------------------
--
-- Controls whether a profile page itself is viewable by non-owners. Independent
-- of `lists.visibility` — a user can keep all their lists private but still
-- expose their username/bio/avatar to discoverability.
--
-- Default is TRUE for now; rationale: existing UX already exposes display_name
-- wherever the user appears in the app, so flipping all existing users to
-- "public profile" matches their current effective state. Users who want a
-- private profile can opt-out in settings later.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Verification:
--   SELECT id, username, is_public FROM public.profiles LIMIT 5;
--   -- Expect: every row has is_public = true.


-- -----------------------------------------------------------------------------
-- 4. RLS — public lists readable by everyone
-- -----------------------------------------------------------------------------
--
-- This is an ADDITIVE permissive policy. The existing per-owner SELECT policy
-- ("user_id = auth.uid()") remains in place; Postgres OR's permissive policies,
-- so the owner can still read their own (private or public) lists while
-- everyone else can additionally read public lists.
--
-- If the existing per-owner policy is missing for some reason, owners will
-- still be able to read their own public lists via this new policy. Private
-- lists, however, will be invisible to their own owners until the per-owner
-- policy is restored. Verify with the SELECT after step 6.

DROP POLICY IF EXISTS "Public lists viewable by everyone" ON public.lists;

CREATE POLICY "Public lists viewable by everyone"
  ON public.lists FOR SELECT
  USING (visibility = 'public');

-- Verification (anonymously, via the SQL editor's "anon" role toggle or via
-- a fresh REST request without a JWT):
--   -- Step a: Mark one list public for testing:
--   UPDATE public.lists SET visibility = 'public' WHERE id = '<some-list-id>';
--   -- Step b: From an anon REST request, fetch that list:
--   SELECT id, title, visibility FROM public.lists WHERE id = '<some-list-id>';
--   -- Expect: row visible without auth.


-- -----------------------------------------------------------------------------
-- 5. RLS — list_items of public lists readable by everyone
-- -----------------------------------------------------------------------------
--
-- A public list with invisible items is useless, so this policy mirrors step 4
-- one level down. We EXISTS-join to `lists` rather than denormalizing
-- visibility onto every list_item — keeps the source of truth single.

DROP POLICY IF EXISTS "Items of public lists viewable by everyone" ON public.list_items;

CREATE POLICY "Items of public lists viewable by everyone"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
        AND lists.visibility = 'public'
    )
  );

-- Verification:
--   -- After marking a list public (step 4 verification), an anon request:
--   SELECT id, title FROM public.list_items WHERE list_id = '<that-list-id>';
--   -- Expect: all items returned.


-- -----------------------------------------------------------------------------
-- 6. RLS — public profiles readable by everyone
-- -----------------------------------------------------------------------------
--
-- Mirrors step 4 for profiles. The owner still owns the row (via the existing
-- "id = auth.uid()" SELECT policy, if present); this just opens up the public
-- ones to anon and other authed users.

DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON public.profiles;

CREATE POLICY "Public profiles viewable by everyone"
  ON public.profiles FOR SELECT
  USING (is_public = true);

-- Verification (anonymously):
--   SELECT id, username, display_name, bio, avatar_url
--   FROM public.profiles
--   WHERE is_public = true
--   LIMIT 5;
--   -- Expect: rows returned (since the default is true).


-- =============================================================================
-- End of Phase 1 migration.
-- =============================================================================
--
-- Next phase: Phase 2 (follow graph) — see docs/social-schema.md §4.
-- =============================================================================
