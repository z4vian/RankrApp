-- =============================================================================
-- Rankr — Phase 8 Migration (Pre-Beta Session 1)
-- =============================================================================
--
-- Purpose:
--   Adds the three tables Rankr needs before opening a public beta:
--     1. `user_blocks` — per-user block list (privacy / abuse mitigation).
--     2. `reports`     — UGC moderation queue (App Store + Play Store require
--                        a reporting mechanism for user-generated content).
--     3. `feedback`    — in-app beta feedback + crash-report sink. Lets
--                        anonymous (logged-out) submissions through for crash
--                        reports that fire before the user signs in.
--
-- What this migration does:
--   1. Creates `public.user_blocks` (blocker_id, blocked_id, created_at)
--        - Composite PK on (blocker_id, blocked_id) doubles as "can't block
--          the same user twice."
--        - CHECK (blocker_id <> blocked_id) — no self-blocks.
--        - CASCADE on auth.users delete so account-deletion cleans up.
--   2. Creates `public.reports` with a status workflow
--        ('open' → 'reviewed'/'dismissed'/'actioned').
--   3. Creates `public.feedback` with optional user_id (nullable so
--        anonymous crash reports submit successfully).
--   4. Indexes for the dominant query shapes on each table.
--   5. Enables RLS on all three tables.
--   6. RLS — user_blocks: blocker-only SELECT/INSERT/DELETE.
--   7. RLS — reports: reporter-only INSERT and SELECT (admin UPDATE/DELETE
--      policies will land in Session 2).
--   8. RLS — feedback: INSERT allowed for `auth.uid() = user_id OR
--      user_id IS NULL` (anonymous); SELECT only for the submitter.
--
-- Notes / design rationale:
--   - `reports.reporter_id` is `ON DELETE SET NULL`, NOT CASCADE. Rationale:
--     if a reporter later deletes their account, the moderation queue
--     shouldn't lose the underlying report — admins still need to see /
--     action it. Same for `reports.reviewed_by`.
--   - `feedback.user_id` is also `ON DELETE SET NULL` for the same reason:
--     historical feedback survives account deletion in anonymized form.
--   - No UPDATE/DELETE policies on `reports` or `feedback`. Phase 8 ships
--     read + write for end users only; an admin role (and the policies it
--     unlocks) is explicitly deferred to Session 2.
--   - `reports.target_id` is intentionally untyped at the database level
--     (it's `uuid` with no FK). It points into one of profiles / lists /
--     list_items / posts / comments depending on `target_kind`. A polymorphic
--     FK is hard to model in Postgres without a discriminator-and-CHECK dance
--     that adds churn at every new target table; v1 keeps it loose, and the
--     admin tooling will look up targets by (target_kind, target_id).
--
-- How to apply:
--   1. (Recommended) Back up the project first: Supabase dashboard →
--      Database → Backups → "Take a backup now".
--   2. Supabase dashboard → SQL Editor → "New query".
--   3. Paste this ENTIRE file in.
--   4. Click "Run". The verification SELECTs below each block are quick
--      sanity checks you can run in a separate query.
--   5. After the migration, the three new tables are empty — no data is
--      affected, no app changes are required for safety.
--
-- Idempotency:
--   Safe to re-run. Every statement uses one of:
--     - CREATE TABLE IF NOT EXISTS
--     - CREATE INDEX IF NOT EXISTS
--     - ALTER TABLE … ENABLE ROW LEVEL SECURITY  (no-op if already on)
--     - DROP POLICY IF EXISTS + CREATE POLICY
--
-- Dependencies:
--   - Requires `pgcrypto` for `gen_random_uuid()` (used by `reports` and
--     `feedback`). Supabase enables it by default.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. user_blocks table
-- -----------------------------------------------------------------------------
--
-- One row per (blocker, blocked) pair. Composite PK enforces uniqueness;
-- the CHECK constraint blocks self-blocks at the DB level so the client
-- doesn't have to. CASCADE on both FKs so account deletion cleans up.

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx
  ON public.user_blocks (blocker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
  ON public.user_blocks (blocked_id);

-- Verification:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'user_blocks'
--   ORDER BY ordinal_position;
--   -- Expect three rows: blocker_id (uuid, NO), blocked_id (uuid, NO),
--   --                    created_at (timestamp with time zone, NO).
--
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'user_blocks'
--   ORDER BY indexname;
--   -- Expect:
--   --   user_blocks_blocked_idx
--   --   user_blocks_blocker_idx
--   --   user_blocks_pkey (composite PK on blocker_id, blocked_id)


-- -----------------------------------------------------------------------------
-- 2. reports table
-- -----------------------------------------------------------------------------
--
-- UGC moderation queue. `reporter_id` is SET NULL on user delete so the
-- moderation history survives account deletion (admins still need it for
-- pattern detection). `target_id` is untyped at the DB level — see header
-- notes for rationale.

CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_kind  text NOT NULL
                 CHECK (target_kind IN ('profile','list','list_item','post','comment')),
  target_id    uuid NOT NULL,
  reason       text NOT NULL
                 CHECK (reason IN ('spam','harassment','inappropriate','impersonation','illegal','other')),
  body         text CHECK (length(body) <= 1000),
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','reviewed','dismissed','actioned')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reports_status_created_idx
  ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reporter_idx
  ON public.reports (reporter_id, created_at DESC);

-- Verification:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'reports'
--   ORDER BY ordinal_position;
--   -- Expect:
--   --   id           uuid                       NO  gen_random_uuid()
--   --   reporter_id  uuid                       YES
--   --   target_kind  text                       NO
--   --   target_id    uuid                       NO
--   --   reason       text                       NO
--   --   body         text                       YES
--   --   status       text                       NO  'open'
--   --   created_at   timestamptz                NO  now()
--   --   reviewed_at  timestamptz                YES
--   --   reviewed_by  uuid                       YES


-- -----------------------------------------------------------------------------
-- 3. feedback table
-- -----------------------------------------------------------------------------
--
-- In-app beta feedback + crash-report sink. `user_id` is nullable AND uses
-- SET NULL on delete so:
--   1. anonymous crash reports (fired before the user signs in) submit OK,
--   2. historical feedback survives account deletion.
-- `error_context` is jsonb so the client can dump arbitrary structured
-- error metadata (stack traces, redux state snippets, etc.) without
-- needing a fixed schema.

CREATE TABLE IF NOT EXISTS public.feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body           text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  category       text CHECK (category IN ('bug','feature','question','other')),
  screen_context text,
  error_context  jsonb,
  app_version    text,
  platform       text CHECK (platform IN ('ios','android','web')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_idx
  ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_idx
  ON public.feedback (user_id, created_at DESC);

-- Verification:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'feedback'
--   ORDER BY ordinal_position;
--   -- Expect: id, user_id, body, category, screen_context, error_context,
--   --         app_version, platform, created_at — with body and id NOT NULL
--   --         and user_id YES.


-- -----------------------------------------------------------------------------
-- 4. Enable RLS on all three tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback    ENABLE ROW LEVEL SECURITY;

-- Verification:
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('user_blocks','reports','feedback')
--     AND relnamespace = 'public'::regnamespace
--   ORDER BY relname;
--   -- Expect: relrowsecurity = true for all three.


-- -----------------------------------------------------------------------------
-- 5. RLS — user_blocks (private to the blocker)
-- -----------------------------------------------------------------------------
--
-- A block record is the blocker's private state. The blocked user never
-- sees it — they just notice the blocker's content disappearing.
-- All three operations (SELECT/INSERT/DELETE) gate on
-- `auth.uid() = blocker_id`. No UPDATE policy — blocks are immutable; you
-- DELETE + re-INSERT if you somehow need to "edit" one.

DROP POLICY IF EXISTS "Users see only their own blocks" ON public.user_blocks;
CREATE POLICY "Users see only their own blocks"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users block on their own behalf" ON public.user_blocks;
CREATE POLICY "Users block on their own behalf"
  ON public.user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users unblock on their own behalf" ON public.user_blocks;
CREATE POLICY "Users unblock on their own behalf"
  ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- Verification (as an authed user):
--   INSERT INTO public.user_blocks (blocker_id, blocked_id)
--   VALUES (auth.uid(), '<some-other-user-id>');
--   -- Expect: success.
--
--   INSERT INTO public.user_blocks (blocker_id, blocked_id)
--   VALUES (auth.uid(), auth.uid());
--   -- Expect: CHECK violation "new row violates check constraint".
--
--   INSERT INTO public.user_blocks (blocker_id, blocked_id)
--   VALUES ('<other-user-id>', '<third-user-id>');
--   -- Expect: RLS error "new row violates row-level security policy".


-- -----------------------------------------------------------------------------
-- 6. RLS — reports (reporter-only SELECT + INSERT)
-- -----------------------------------------------------------------------------
--
-- Reporters can submit reports and see their own submission history. No
-- UPDATE/DELETE policies — admins will use a service-role key or the
-- Session 2 admin role to manage the queue.

DROP POLICY IF EXISTS "Reporters see their own reports" ON public.reports;
CREATE POLICY "Reporters see their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users submit reports as themselves" ON public.reports;
CREATE POLICY "Users submit reports as themselves"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Verification:
--   -- Submit a valid report:
--   INSERT INTO public.reports (reporter_id, target_kind, target_id, reason, body)
--   VALUES (auth.uid(), 'post', '<some-post-id>', 'spam', 'looks fishy');
--   -- Expect: success.
--
--   -- Try to submit on someone else's behalf:
--   INSERT INTO public.reports (reporter_id, target_kind, target_id, reason)
--   VALUES ('<other-user-id>', 'post', '<some-post-id>', 'spam');
--   -- Expect: RLS error.
--
--   -- See your own reports:
--   SELECT id, target_kind, status FROM public.reports;
--   -- Expect: only your own rows.


-- -----------------------------------------------------------------------------
-- 7. RLS — feedback (anonymous INSERT allowed, owner-only SELECT)
-- -----------------------------------------------------------------------------
--
-- INSERT allows either:
--   - `auth.uid() = user_id` (signed-in user attributes feedback to themselves), OR
--   - `user_id IS NULL`      (anonymous submission — used by crash reports
--                              that fire before a session exists).
-- SELECT is owner-only so users can review their own past submissions in
-- a "My feedback" screen if we add one. No UPDATE/DELETE.

DROP POLICY IF EXISTS "Users see their own feedback" ON public.feedback;
CREATE POLICY "Users see their own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users submit feedback (or anonymously)" ON public.feedback;
CREATE POLICY "Users submit feedback (or anonymously)"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Verification:
--   -- As an authed user, attributed submission:
--   INSERT INTO public.feedback (user_id, body, category, platform)
--   VALUES (auth.uid(), 'app crashed on the home tab', 'bug', 'ios');
--   -- Expect: success.
--
--   -- Anonymous submission (still authed, but user_id NULL):
--   INSERT INTO public.feedback (user_id, body, platform)
--   VALUES (NULL, 'auto-captured crash from boot', 'ios');
--   -- Expect: success.
--
--   -- Try to attribute to someone else:
--   INSERT INTO public.feedback (user_id, body)
--   VALUES ('<other-user-id>', 'naughty');
--   -- Expect: RLS error.


-- =============================================================================
-- End of Phase 8 migration.
-- =============================================================================
--
-- Next steps:
--   1. See docs/BETA-READINESS.md for the full pre-launch checklist
--      (SMTP config, Sentry setup, edge-function deploy, etc.).
--   2. Session 2 will layer admin policies on top of `reports` / `feedback`
--      for the moderation queue UI.
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo this migration):
--
-- DROP POLICY IF EXISTS "Users submit feedback (or anonymously)" ON public.feedback;
-- DROP POLICY IF EXISTS "Users see their own feedback"           ON public.feedback;
--
-- DROP POLICY IF EXISTS "Users submit reports as themselves"     ON public.reports;
-- DROP POLICY IF EXISTS "Reporters see their own reports"        ON public.reports;
--
-- DROP POLICY IF EXISTS "Users unblock on their own behalf"      ON public.user_blocks;
-- DROP POLICY IF EXISTS "Users block on their own behalf"        ON public.user_blocks;
-- DROP POLICY IF EXISTS "Users see only their own blocks"        ON public.user_blocks;
--
-- DROP INDEX IF EXISTS public.feedback_user_idx;
-- DROP INDEX IF EXISTS public.feedback_created_idx;
-- DROP INDEX IF EXISTS public.reports_reporter_idx;
-- DROP INDEX IF EXISTS public.reports_status_created_idx;
-- DROP INDEX IF EXISTS public.user_blocks_blocked_idx;
-- DROP INDEX IF EXISTS public.user_blocks_blocker_idx;
--
-- DROP TABLE IF EXISTS public.feedback;
-- DROP TABLE IF EXISTS public.reports;
-- DROP TABLE IF EXISTS public.user_blocks;
--
-- =============================================================================
