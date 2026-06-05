-- =============================================================================
-- Rankr — Phase 5 Migration
-- =============================================================================
--
-- Purpose:
--   Phase 5 adds the schema bits needed for push notifications. Specifically:
--   a `public.push_tokens` table that stores each device's Expo push token
--   alongside the user it belongs to, plus the RLS policy that gates writes
--   to the current user only.
--
-- Independence note:
--   PHASE 5 IS INDEPENDENT OF PHASES 1–4. This file does not reference any
--   table created in Phases 1–4 (other than `auth.users`, which is Supabase-
--   managed). You can apply it on a fresh project or after any subset of the
--   earlier phases.
--
--   The OTHER Phase-5 deliverables — books/TV media support (client-side
--   only, no schema), the year-in-review screen (queries existing tables),
--   the account-deletion flow (uses an Edge Function), and EAS / push-setup
--   docs — do not require any schema changes beyond this file.
--
-- What this migration does:
--   1. Creates `public.push_tokens` (id, user_id, token, platform,
--      created_at, updated_at), with:
--        - UNIQUE on `token` so re-registering the same device upserts
--          rather than duplicates;
--        - CHECK on `platform` restricted to ('ios','android','web');
--        - CASCADE on auth.users delete so account-deletion cleans tokens.
--   2. Index on `user_id` for fast "all of my devices" lookups (used by the
--      `send-push-notification` Edge Function).
--   3. Enables RLS on the table.
--   4. ONE permissive policy `Users manage own push tokens` for ALL ops
--      (SELECT / INSERT / UPDATE / DELETE) gated on `auth.uid() = user_id`.
--      The service-role key (used by the send-push Edge Function) bypasses
--      RLS anyway, so a single per-user policy is sufficient.
--
-- How to apply:
--   1. (Recommended) Back up the project first: Supabase dashboard → Database
--      → Backups → "Take a backup now". Or via CLI:
--          pg_dump --host=db.<project-ref>.supabase.co \
--                  --username=postgres --no-owner \
--                  --file=rankr-pre-phase5.sql postgres
--   2. Supabase dashboard → SQL Editor → "New query".
--   3. Paste this ENTIRE file in.
--   4. Click "Run" (or step through each numbered section — per-block
--      verification queries are included as comments below each).
--   5. Deploy the Edge Functions (see `docs/edge-functions/README.md`) —
--      they expect this table to exist.
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
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. push_tokens table
-- -----------------------------------------------------------------------------
--
-- One row per (device, token) pair. The `token` UNIQUE constraint means the
-- `lib/pushTokens.ts` `registerPushToken` upsert can be keyed on it: a
-- device reinstalling the app gets a new token (new row); the same device
-- re-registering an unchanged token just bumps `updated_at`.
--
-- ON DELETE CASCADE on `user_id` so account-deletion cleans up automatically
-- — the `delete-account` Edge Function deletes the `auth.users` row and
-- everything dangling off it disappears.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Verification:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'push_tokens'
--   ORDER BY ordinal_position;
--   -- Expect:
--   --   id          uuid                       NO  gen_random_uuid()
--   --   user_id     uuid                       NO
--   --   token       text                       NO
--   --   platform    text                       NO
--   --   created_at  timestamp with time zone   NO  now()
--   --   updated_at  timestamp with time zone   NO  now()


-- -----------------------------------------------------------------------------
-- 2. Index for "all of my devices" lookups
-- -----------------------------------------------------------------------------
--
-- The UNIQUE constraint on `token` covers single-token lookups. We add a
-- separate index on `user_id` so the Edge Function's
-- `SELECT token FROM push_tokens WHERE user_id IN (...)` (used to send a
-- notification to every device a user owns) is an index scan.

CREATE INDEX IF NOT EXISTS push_tokens_user_idx
  ON public.push_tokens (user_id);

-- Verification:
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'push_tokens'
--   ORDER BY indexname;
--   -- Expect:
--   --   push_tokens_pkey
--   --   push_tokens_token_key
--   --   push_tokens_user_idx


-- -----------------------------------------------------------------------------
-- 3. Enable RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Verification:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname = 'push_tokens' AND relnamespace = 'public'::regnamespace;
--   -- Expect: relrowsecurity = true.


-- -----------------------------------------------------------------------------
-- 4. RLS — users manage only their own tokens
-- -----------------------------------------------------------------------------
--
-- A single permissive policy for ALL operations. The service-role key used
-- by the `send-push-notification` Edge Function bypasses RLS, so it can
-- still read tokens for any user when delivering a notification.

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verification (as an authed user):
--   INSERT INTO public.push_tokens (user_id, token, platform)
--   VALUES (auth.uid(), 'ExponentPushToken[test-' || gen_random_uuid() || ']', 'ios');
--   -- Expect: success.
--
--   -- Try to register a token for someone else:
--   INSERT INTO public.push_tokens (user_id, token, platform)
--   VALUES ('<other-user-id>', 'ExponentPushToken[spoof]', 'ios');
--   -- Expect: error — "new row violates row-level security policy".
--
--   -- Try to read someone else's tokens:
--   SELECT * FROM public.push_tokens WHERE user_id <> auth.uid();
--   -- Expect: 0 rows (RLS hides them).


-- =============================================================================
-- End of Phase 5 migration.
-- =============================================================================
--
-- Next steps after running this:
--   1. Deploy the two Edge Functions from `docs/edge-functions/`:
--        - delete-account              (used by `lib/account.ts`)
--        - send-push-notification      (used by app triggers / RPCs)
--      See `docs/edge-functions/README.md`.
--   2. Configure EAS Build + APNs/FCM — see `docs/EAS-SETUP.md` and
--      `docs/PUSH-NOTIFICATIONS-SETUP.md`.
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo this migration):
--
-- DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
-- DROP INDEX IF EXISTS public.push_tokens_user_idx;
-- DROP TABLE IF EXISTS public.push_tokens;
--
-- =============================================================================
