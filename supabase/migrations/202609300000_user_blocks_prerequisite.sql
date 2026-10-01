-- Restore the missing Phase 8 prerequisite without changing existing block tables.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.user_blocks') IS NULL THEN
    CREATE TABLE public.user_blocks (
      blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (blocker_id, blocked_id),
      CHECK (blocker_id <> blocked_id)
    );
    CREATE INDEX user_blocks_blocker_idx ON public.user_blocks(blocker_id, created_at DESC);
    CREATE INDEX user_blocks_blocked_idx ON public.user_blocks(blocked_id);
    ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.user_blocks FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
    GRANT ALL ON public.user_blocks TO service_role;
    CREATE POLICY rankr_blocks_select ON public.user_blocks FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = blocker_id);
    CREATE POLICY rankr_blocks_insert ON public.user_blocks FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = blocker_id);
    CREATE POLICY rankr_blocks_delete ON public.user_blocks FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = blocker_id);
  END IF;
END;
$$;
COMMIT;
