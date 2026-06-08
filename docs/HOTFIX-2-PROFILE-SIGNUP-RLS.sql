-- =============================================================================
-- Rankr — Hotfix 2: Profile signup RLS + auto-create trigger
-- =============================================================================
--
-- Problem reported:
--   New signups fail with the error
--     "new row violates row-level security policy for table 'profiles'"
--   right when the signup form is submitted.
--
-- Root cause:
--   The `profiles` table has RLS enabled, but the migrations only ever added
--   SELECT policies. There is NO INSERT policy and NO UPDATE policy gated
--   on `auth.uid() = id`. With RLS enabled and no INSERT policy, the table
--   defaults to "deny all writes" — so the frontend's `createProfile`
--   upsert is blocked the moment a new user tries to populate their row.
--
-- Existing accounts work because they predate this stricter RLS config
-- (or their profile rows were inserted through some other path before the
-- write policies got cleaned out). New signups have no path to create a
-- profile.
--
-- Fix — two layers, both safe to apply, both idempotent:
--
--   1) Add the missing INSERT and UPDATE policies on `profiles`.
--      Now an authenticated user can write their own row (and ONLY
--      their own, because the policy gates on `auth.uid() = id`).
--
--   2) Add an auth.users INSERT trigger that auto-creates an empty
--      profile shell for every new user. This is the canonical Supabase
--      pattern (see https://supabase.com/docs/guides/auth/managing-user-data).
--      The trigger runs as SECURITY DEFINER (function owner = postgres),
--      bypassing RLS entirely. It handles the email-confirmation edge case
--      where `supabase.auth.signUp` returns `user: null` (because the JWT
--      isn't issued until the email is confirmed) — without the trigger,
--      that flow would leave the user permanently profile-less.
--
--   After applying:
--     - Frontend createProfile() succeeds because the row already exists
--       (created by the trigger) and the UPDATE policy lets the user
--       populate username/display_name/bio.
--     - Email-confirmation signups get a profile shell automatically and
--       can complete onboarding after they click the confirmation link.
--     - All your existing accounts are unaffected — the trigger only fires
--       on FUTURE inserts to auth.users.
--
-- How to apply:
--   1) (Recommended) Take a backup: Supabase dashboard → Database → Backups.
--   2) SQL Editor → New query → paste this entire file → Run.
--   3) After running, refresh the PostgREST schema cache:
--        Supabase dashboard → Settings → API → "Reload schema"
--        (or via SQL: it's NOTIFY'd at the bottom of this file)
--   4) Test the signup flow again. The "RLS violates" error should be gone.
--
-- Idempotency:
--   Every statement uses one of:
--     DROP POLICY IF EXISTS + CREATE POLICY
--     CREATE OR REPLACE FUNCTION
--     DROP TRIGGER IF EXISTS + CREATE TRIGGER
--   Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Layer 1: INSERT + UPDATE policies on public.profiles
-- -----------------------------------------------------------------------------
--
-- Phase 1 already added the SELECT policy ("Public profiles viewable by
-- everyone"). Those are unchanged. We add the missing write-side policies
-- below; both gate strictly on `auth.uid() = id` so a user can only touch
-- their own row.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- Layer 2: Auto-create profile shell on auth.users INSERT
-- -----------------------------------------------------------------------------
--
-- SECURITY DEFINER means this function runs as the function owner
-- (typically `postgres` in Supabase). That's a privileged role that
-- bypasses RLS, so the INSERT into `public.profiles` succeeds even
-- when there's no active session yet.
--
-- The trigger inserts ONLY the id. We deliberately don't pre-populate
-- username from `raw_user_meta_data.intended_username` because that
-- could trigger a unique-violation on the username partial-index if
-- two people sign up with the same desired username simultaneously,
-- which would then abort the auth.users INSERT — i.e. signup would
-- silently fail. Better to let the frontend's `createProfile` set
-- the username after signup completes; that path has proper
-- client-side validation + error UX.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Reload PostgREST schema cache so the new policies take effect immediately
-- -----------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- Verification
-- =============================================================================
--
-- After running, these queries should return what's described:
--
--   -- 1. Confirm both write policies exist
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'profiles'
--     AND policyname LIKE '%own%'
--   ORDER BY policyname;
--   -- Expect 2 rows:
--   --   Users can insert own profile
--   --   Users can update own profile
--
--   -- 2. Confirm the trigger is wired
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'auth.users'::regclass
--     AND tgname = 'on_auth_user_created';
--   -- Expect 1 row.
--
--   -- 3. Smoke test (after creating one new account via the app):
--   SELECT id, username, display_name, bio
--   FROM public.profiles
--   ORDER BY id DESC
--   LIMIT 1;
--   -- Expect a row for the newest auth.users id with whatever username
--   -- the new user set during signup.
--
-- =============================================================================
-- Rollback (uncomment + run if you need to undo this hotfix):
--
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
-- NOTIFY pgrst, 'reload schema';
--
-- =============================================================================
