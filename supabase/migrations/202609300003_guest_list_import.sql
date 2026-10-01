-- Requires existing lists/list_items schema, including visibility and bookmarked.
-- Additive: no existing list content is changed. Run once through migrations.
BEGIN;
CREATE TABLE public.guest_list_imports (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, draft_id),
  UNIQUE (list_id)
);
ALTER TABLE public.guest_list_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_list_imports FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.rankr_import_guest_list(p_draft jsonb)
RETURNS TABLE(id uuid, title text, category text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller uuid := auth.uid();
  v_draft_id uuid;
  list_title text;
  list_category text;
  item jsonb;
  item_id uuid;
  item_ids uuid[] := ARRAY[]::uuid[];
  field text;
  field_limit integer;
  image_ref text;
  count_items integer;
  position integer := 0;
  existing public.lists%ROWTYPE;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR octet_length(p_draft::text) > 131072
    OR p_draft->'version' IS DISTINCT FROM '1'::jsonb
    OR jsonb_typeof(p_draft->'id') IS DISTINCT FROM 'string'
    OR (p_draft->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR jsonb_typeof(p_draft->'title') IS DISTINCT FROM 'string'
    OR length(btrim(p_draft->>'title')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_draft->'category') IS DISTINCT FROM 'string'
    OR (p_draft->>'category') NOT IN ('movies','tv','games','music','books')
    OR jsonb_typeof(p_draft->'items') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Invalid guest draft' USING ERRCODE = '22023'; END IF;
  count_items := jsonb_array_length(p_draft->'items');
  IF count_items NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Guest lists require 1 to 20 items' USING ERRCODE = '22023'; END IF;
  v_draft_id := (p_draft->>'id')::uuid;
  list_title := btrim(p_draft->>'title');
  list_category := p_draft->>'category';
  -- Validate every item before mutations, including retry requests.
  FOR item IN SELECT value FROM jsonb_array_elements(p_draft->'items') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
      OR (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string'
      OR length(btrim(item->>'title')) NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'Invalid guest item' USING ERRCODE = '22023'; END IF;
    item_id := (item->>'id')::uuid;
    IF item_id = ANY(item_ids) THEN RAISE EXCEPTION 'Duplicate guest item' USING ERRCODE = '22023'; END IF;
    item_ids := array_append(item_ids,item_id);
    FOREACH field IN ARRAY ARRAY['subtitle','external_id','notes','image_url'] LOOP
      field_limit := CASE field WHEN 'subtitle' THEN 300 WHEN 'external_id' THEN 200 WHEN 'notes' THEN 4000 ELSE 2048 END;
      IF item ? field AND (jsonb_typeof(item->field) IS DISTINCT FROM 'string' OR length(item->>field) > field_limit)
      THEN RAISE EXCEPTION 'Invalid guest item field' USING ERRCODE = '22023'; END IF;
    END LOOP;
    image_ref := item->>'image_url';
    IF image_ref IS NOT NULL AND image_ref <> '' AND NOT (
      image_ref ~ '^https://[^[:space:]/@?#\\]+([/?#][^[:space:]\\]*)?$'
      OR (image_ref ~ '^/media/[A-Za-z0-9/_.,%-]+$' AND position('..' IN image_ref) = 0 AND image_ref !~* '%(2e|2f|5c)')
    ) THEN RAISE EXCEPTION 'Invalid guest image' USING ERRCODE = '22023'; END IF;
  END LOOP;
  -- Serialize identical draft IDs, including cross-owner attempts. UUID PKs
  -- remain the final collision protection. No client-supplied owner is used.
  PERFORM pg_advisory_xact_lock(hashtextextended('rankr-guest:' || v_draft_id::text, 0));
  SELECT l.* INTO existing FROM public.guest_list_imports g
    JOIN public.lists l ON l.id = g.list_id
    WHERE g.owner_id = caller AND g.draft_id = v_draft_id AND l.user_id = caller;
  IF FOUND THEN
    RETURN QUERY SELECT existing.id, existing.title, existing.category::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.lists l WHERE l.id = v_draft_id) THEN
    RAISE EXCEPTION 'Draft ID unavailable' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.lists(id,user_id,title,category,visibility)
    VALUES(v_draft_id,caller,list_title,list_category,'private');
  FOR item IN SELECT value FROM jsonb_array_elements(p_draft->'items') LOOP
    INSERT INTO public.list_items(id,list_id,title,subtitle,image_url,external_id,category,rank,sentiment,notes,bookmarked)
      VALUES((item->>'id')::uuid,v_draft_id,btrim(item->>'title'),item->>'subtitle',
        CASE WHEN item->>'image_url' LIKE '/media/%' THEN 'https://rankr-app.vercel.app' || (item->>'image_url')
          ELSE nullif(item->>'image_url','') END,
        item->>'external_id',list_category,
        round((10 - position * (9.0 / greatest(count_items - 1,1)))::numeric,2)::double precision,
        NULL,item->>'notes',false);
    position := position + 1;
  END LOOP;
  INSERT INTO public.guest_list_imports(owner_id,draft_id,list_id) VALUES(caller,v_draft_id,v_draft_id);
  RETURN QUERY SELECT v_draft_id,list_title,list_category;
END; $$;
REVOKE ALL ON FUNCTION public.rankr_import_guest_list(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rankr_import_guest_list(jsonb) TO authenticated;
COMMIT;
