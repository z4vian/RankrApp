-- =============================================================================
-- Rankr — Hotfix 3: Lock down lists + list_items writes to the owner only
-- =============================================================================
--
-- Problem:
--   A test user reported they could see another user's ranked lists on their
--   own profile. Root cause was a missing user_id filter in the frontend
--   queries (fixed in code). But the underlying schema also has a gap:
--
--     - Phase 1 added "Public lists viewable by everyone" SELECT policy
--     - There are NO explicit INSERT / UPDATE / DELETE policies on `lists` or
--       `list_items` gated on the owner.
--
--   With RLS enabled and no write policies, writes default to deny — which is
--   why the app worked at all. But if Supabase or a future migration ever
--   adds a permissive write policy without a user-scope, anyone could modify
--   any list. This hotfix adds explicit owner-only write policies so the
--   schema is defensive on its own, independent of the frontend.
--
-- Fix:
--   For `lists`: add INSERT / UPDATE / DELETE policies all gated on
--     auth.uid() = user_id.
--   For `list_items`: add the same three, gated on the parent list's owner
--     via EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id
--                                       AND lists.user_id = auth.uid()).
--
-- After applying:
--   - A user can only insert items into THEIR OWN lists, can only update
--     their own list_items, and can only delete from their own lists.
--   - Anyone reading a PUBLIC list via the Discover screen still sees its
--     items (existing "Items of public lists viewable by everyone" policy
--     from Phase 1, unchanged).
--   - No frontend changes required.
--
-- Idempotent (DROP IF EXISTS + CREATE). Safe to re-run.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- lists table — owner-only writes
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can create own lists" ON public.lists;
CREATE POLICY "Users can create own lists"
  ON public.lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
CREATE POLICY "Users can update own lists"
  ON public.lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lists" ON public.lists;
CREATE POLICY "Users can delete own lists"
  ON public.lists FOR DELETE
  USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- list_items table — writes only if you own the parent list
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can add items to own lists" ON public.list_items;
CREATE POLICY "Users can add items to own lists"
  ON public.list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
        AND lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update items in own lists" ON public.list_items;
CREATE POLICY "Users can update items in own lists"
  ON public.list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
        AND lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
        AND lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete items from own lists" ON public.list_items;
CREATE POLICY "Users can delete items from own lists"
  ON public.list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
        AND lists.user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- Existing SELECT policies (from Phase 1) for reference — NOT modified:
--   - "Public lists viewable by everyone"  (visibility = 'public')
--   - "Items of public lists viewable by everyone" (parent list visibility='public')
--
-- These hotfix-3 policies ADD on top: writes are now strictly owner-only
-- regardless of visibility. A user can mark their list public to share, but
-- they're still the only one who can add/edit/delete its contents.
-- -----------------------------------------------------------------------------


-- Reload schema so the policies take effect immediately
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- Verification:
--
--   SELECT policyname, cmd, qual::text AS using_check, with_check::text AS new_row_check
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('lists', 'list_items')
--   ORDER BY tablename, policyname;
--
-- Expect (in addition to existing SELECT policies):
--   list_items  Users can add items to own lists       (INSERT)
--   list_items  Users can delete items from own lists  (DELETE)
--   list_items  Users can update items in own lists    (UPDATE)
--   lists       Users can create own lists             (INSERT)
--   lists       Users can delete own lists             (DELETE)
--   lists       Users can update own lists             (UPDATE)
--
-- Smoke test — as a regular user A trying to modify user B's list:
--   UPDATE public.lists SET title = 'pwned' WHERE id = '<some-other-users-list-id>';
--   -- Expect 0 rows affected (RLS hides them from the UPDATE plan).
-- =============================================================================
--
-- Rollback (uncomment + run if you need to undo):
--
-- DROP POLICY IF EXISTS "Users can delete items from own lists" ON public.list_items;
-- DROP POLICY IF EXISTS "Users can update items in own lists"   ON public.list_items;
-- DROP POLICY IF EXISTS "Users can add items to own lists"      ON public.list_items;
-- DROP POLICY IF EXISTS "Users can delete own lists"            ON public.lists;
-- DROP POLICY IF EXISTS "Users can update own lists"            ON public.lists;
-- DROP POLICY IF EXISTS "Users can create own lists"            ON public.lists;
-- NOTIFY pgrst, 'reload schema';
-- =============================================================================
